import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  listarAgentes,
  verAgente,
  crearAgente,
  actualizarAgente,
  eliminarAgente,
  canalesDisponibles,
  asignarCanales,
  agentesParaFlujos
} from "../services/AiAgentServices/AiAgentService";
import { extraerTextoDocumento } from "../services/AiAgentServices/ExtraerTextoDocumento";
import { listarModelos } from "../services/AiAgentServices/ModelosDisponibles";
import { capacidadesDelFormulario, probarMensaje, reiniciarSandbox } from "../services/AiAgentServices/Sandbox";
import { cambiarEstadoDesdeAsesor, estadoParaAsesor } from "../services/AiAgentServices/AtenderConAgente";
import ShowTicketService from "../services/TicketServices/ShowTicketService";

/**
 * Agentes IA de la empresa. De administrador, como Prompts y Meta. La empresa
 * sale SIEMPRE del token (req.user.companyId): un companyId en el cuerpo se
 * ignora. Ninguna respuesta incluye claves, solo sus 4 ultimos caracteres.
 */

const soloAdmin = (req: Request) => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

const idDe = (req: Request): number => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError("ERR_AI_AGENT_NOT_FOUND", 404);
  return id;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  return res.status(200).json(await listarAgentes(req.user.companyId));
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  return res.status(200).json(await verAgente(req.user.companyId, idDe(req)));
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  return res.status(201).json(await crearAgente(req.user.companyId, req.body));
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  return res.status(200).json(await actualizarAgente(req.user.companyId, idDe(req), req.body));
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  await eliminarAgente(req.user.companyId, idDe(req));
  return res.status(204).send();
};

export const channels = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  return res.status(200).json(await canalesDisponibles(req.user.companyId));
};

export const updateChannels = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  const { whatsappIds } = req.body;
  if (!Array.isArray(whatsappIds)) throw new AppError("ERR_AI_AGENT_INVALID_CHANNEL", 400);
  return res.status(200).json(await asignarCanales(req.user.companyId, idDe(req), whatsappIds));
};

/**
 * Lista minima para el selector "Elegir agente existente" de los nodos del
 * Flow Builder: quien edita flujos no tiene por que ser administrador, y aqui
 * solo sale id, nombre, proveedor y modelo.
 */
export const flowOptions = async (req: Request, res: Response): Promise<Response> => {
  return res.status(200).json(await agentesParaFlujos(req.user.companyId));
};

/**
 * Modelos que ofrece el proveedor, para el desplegable del formulario. La
 * clave llega en el cuerpo solo si se acaba de escribir; si no, se usa la que
 * ya tiene guardada el agente. Nunca se devuelve ninguna clave.
 */
export const models = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  const { provider, apiKey, agentId } = req.body;
  const id = Number(agentId);
  return res.status(200).json(
    await listarModelos(req.user.companyId, provider, typeof apiKey === "string" ? apiKey : undefined, {
      agentId: Number.isInteger(id) && id > 0 ? id : undefined
    })
  );
};

export const extractKnowledge = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  const archivo = req.file as Express.Multer.File | undefined;
  if (!archivo) throw new AppError("ERR_AI_AGENT_KNOWLEDGE_EMPTY", 400);
  return res
    .status(200)
    .json(await extraerTextoDocumento(archivo.buffer, archivo.originalname, archivo.mimetype));
};

const ticketIdDe = (req: Request): number => {
  const id = Number(req.params.ticketId);
  if (!Number.isInteger(id) || id < 1) throw new AppError("ERR_NO_TICKET_FOUND", 404);
  return id;
};

/**
 * Estado del agente IA en una conversacion (activo / pausado). Lo usa quien
 * puede escribir en la conversacion, igual que el envio de mensajes: basta con
 * ser de la empresa del ticket (ShowTicketService filtra por companyId).
 */
export const ticketState = async (req: Request, res: Response): Promise<Response> => {
  const ticket = await ShowTicketService(ticketIdDe(req), req.user.companyId);
  return res.status(200).json(await estadoParaAsesor(ticket));
};

/** Activar o pausar. Solo cambia el estado de la IA: nunca la asignacion. */
export const updateTicketState = async (req: Request, res: Response): Promise<Response> => {
  const { enabled } = req.body;
  if (typeof enabled !== "boolean") throw new AppError("ERR_AI_AGENT_INVALID_STATE", 400);
  const estado = await cambiarEstadoDesdeAsesor(ticketIdDe(req), req.user.companyId, enabled, Number(req.user.id));
  return res.status(200).json(estado);
};

/** Id de agente opcional que llega como texto (multipart) o numero (JSON). */
const agenteOpcional = (valor: unknown): number | undefined => {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

/** La configuracion del formulario viaja como JSON en un campo de texto (multipart). */
const configDe = (valor: unknown): Record<string, any> => {
  if (valor && typeof valor === "object") return valor as Record<string, any>;
  try {
    return JSON.parse(String(valor || "{}"));
  } catch (err) {
    throw new AppError("ERR_AI_AGENT_INVALID_CONFIG", 400);
  }
};

/**
 * Chat de prueba del formulario: responde con la configuracion que hay en
 * pantalla, aunque no este guardada, y no toca contactos, tickets ni mensajes.
 */
export const testMessage = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  const archivos = (req.files || {}) as Record<string, Express.Multer.File[]>;
  const adjunto = (f?: Express.Multer.File) =>
    f ? { buffer: f.buffer, mimetype: f.mimetype, fileName: f.originalname } : undefined;

  const respuesta = await probarMensaje({
    companyId: req.user.companyId,
    userId: Number(req.user.id),
    sessionId: String(req.body.sessionId || ""),
    config: configDe(req.body.config),
    agentId: agenteOpcional(req.body.agentId),
    texto: typeof req.body.text === "string" ? req.body.text : undefined,
    imagen: adjunto(archivos.image?.[0]),
    audio: adjunto(archivos.audio?.[0])
  });
  return res.status(200).json(respuesta);
};

export const resetTest = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  await reiniciarSandbox(req.user.companyId, Number(req.user.id), String(req.params.sessionId || ""));
  return res.status(204).send();
};

/** Que puede hacer el modelo elegido (imagenes, audio, herramientas), con avisos. */
export const capabilities = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  return res
    .status(200)
    .json(await capacidadesDelFormulario(req.user.companyId, configDe(req.body.config), agenteOpcional(req.body.agentId)));
};
