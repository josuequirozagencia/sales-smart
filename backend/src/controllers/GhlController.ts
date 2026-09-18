import { Request, Response } from "express";
import AppError from "../errors/AppError";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import {
  verConfiguracion,
  guardarConfiguracion,
  buscarIntegracion
} from "../services/GhlServices/GhlConfigService";
import {
  clienteDeEmpresa,
  listarFlujos,
  inscribirEnFlujo,
  listarCamposPersonalizados
} from "../services/GhlServices/GhlApiClient";
import { resolverContactoGhl } from "../services/GhlServices/SendGhlMessage";
import {
  enviarPlantillaGhl,
  guardarMapa,
  leerMapa,
  plantillasEnviables
} from "../services/GhlServices/PlantillasGhlService";

/**
 * Administracion del canal de GoHighLevel.
 *
 * Todo lo de aqui es de administrador de la empresa: credenciales (tambien
 * las de Meta, para leer las plantillas) y flujos. El envio de mensajes NO
 * pasa por este controlador, va por
 * el de siempre (MessageController), que es lo que permite que el asesor
 * no note ninguna diferencia.
 */

const soloAdmin = (req: Request) => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

// ---------------------------------------------------------------------------
// Configuracion
// ---------------------------------------------------------------------------

export const show = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  const { companyId } = req.user;

  const config = await verConfiguracion(companyId);

  // La URL se arma aqui y no en el frontend para que quien configure no
  // tenga que componerla a mano. Este es el valor que hay que pegar en
  // GHL, en la accion "Webhook" de un Workflow. Con un Private Integration
  // Token no hay otra via: la suscripcion a eventos es de las apps del
  // Marketplace, y GHL no tiene API para crearla.
  const base = process.env.BACKEND_URL || "";
  const urlWebhook =
    config.conectado && (config as any).webhookSecret
      ? `${base}/ghl/webhook/${companyId}/${(config as any).webhookSecret}`
      : "";

  return res.status(200).json({ ...config, urlWebhook });
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  const { companyId } = req.user;
  const { token, locationId, isActive, metaBusinessId, metaAccessToken, quitarMeta } = req.body;

  if (!locationId) {
    throw new AppError("ERR_GHL_FALTA_LOCATION", 400);
  }
  // El ID de una cuenta de WhatsApp Business es numerico.
  if (typeof metaBusinessId === "string" && metaBusinessId.trim() && !/^\d{5,30}$/.test(metaBusinessId.trim())) {
    throw new AppError("ERR_GHL_META_BUSINESS_ID_INVALIDO", 400);
  }

  await guardarConfiguracion({
    companyId,
    // Cadena vacia significa "no lo cambies", no "borralo": la pantalla
    // nunca muestra el token guardado, asi que un campo vacio es lo normal
    // al editar cualquier otra cosa.
    token: token || undefined,
    locationId,
    isActive: isActive !== false,
    metaBusinessId: typeof metaBusinessId === "string" ? metaBusinessId : undefined,
    metaAccessToken: typeof metaAccessToken === "string" ? metaAccessToken : undefined,
    quitarMeta: quitarMeta === true
  });

  return show(req, res);
};

// ---------------------------------------------------------------------------
// Flujos
// ---------------------------------------------------------------------------

/**
 * Flujos disponibles.
 *
 * Se leen del API de GHL, que si los expone. Si la llamada falla se cae en
 * los anotados a mano en la configuracion, para que la funcion siga siendo
 * usable con el token en revision o sin conexion.
 */
export const workflows = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const cliente = await clienteDeEmpresa(companyId);
  const desdeApi = await listarFlujos(cliente);

  if (desdeApi) {
    return res.status(200).json({ origen: "api", workflows: desdeApi });
  }

  const config = await verConfiguracion(companyId);
  return res
    .status(200)
    .json({ origen: "manual", workflows: config.workflows || [] });
};

/** Inscribe el contacto de un ticket en un flujo de GHL. */
export const enroll = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { ticketId, workflowId } = req.body;

  if (!ticketId || !workflowId) {
    throw new AppError("ERR_GHL_FALTAN_DATOS", 400);
  }

  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId },
    include: ["contact"]
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  const cliente = await clienteDeEmpresa(companyId);
  const contactIdGhl = await resolverContactoGhl(cliente, ticket.contact);

  if (!contactIdGhl) {
    throw new AppError("ERR_GHL_CONTACTO_NO_RESUELTO", 400);
  }

  const resultado = await inscribirEnFlujo(cliente, contactIdGhl, workflowId);

  if (!resultado.ok) {
    throw new AppError(`ERR_GHL_INSCRIPCION: ${resultado.error}`, 400);
  }

  return res.status(200).json({ ok: true });
};

// ---------------------------------------------------------------------------
// Plantillas de WhatsApp enviadas con un Workflow de GHL
// ---------------------------------------------------------------------------
//
// GHL no documenta el envio de plantillas por su API de mensajes; la via
// documentada es un Workflow con la accion "Send WhatsApp". Ver
// PlantillasGhlService.

/** Campos personalizados de contacto, para elegir donde van las variables. */
export const customFields = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  const cliente = await clienteDeEmpresa(req.user.companyId);
  const campos = await listarCamposPersonalizados(cliente);
  // null = GHL no los dio (p. ej. token sin permiso): la pantalla deja
  // escribir la clave a mano.
  return res.status(200).json({ disponible: campos !== null, campos: campos || [] });
};

/** Plantillas aprobadas con su Workflow y sus variables, para configurarlas. */
export const templateWorkflows = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  const { companyId } = req.user;
  const [plantillas, fila] = await Promise.all([plantillasEnviables(companyId), buscarIntegracion(companyId)]);
  return res.status(200).json({ plantillas, mapa: leerMapa(fila?.templateWorkflows) });
};

export const updateTemplateWorkflows = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  const mapa = await guardarMapa(req.user.companyId, req.body?.mapa);
  return res.status(200).json({ mapa });
};

/**
 * Plantillas que se pueden enviar desde un ticket de GHL. Cualquier usuario
 * de la empresa: es lo que ve quien responde.
 */
export const sendableTemplates = async (req: Request, res: Response): Promise<Response> => {
  const plantillas = await plantillasEnviables(req.user.companyId);
  return res.status(200).json(plantillas.filter(p => p.enviable));
};

export const sendTemplate = async (req: Request, res: Response): Promise<Response> => {
  const ticketId = Number(req.params.ticketId);
  if (!Number.isInteger(ticketId) || ticketId < 1) throw new AppError("ERR_NO_TICKET_FOUND", 404);
  const { name, language, values } = req.body || {};
  if (typeof name !== "string" || typeof language !== "string") {
    throw new AppError("ERR_GHL_PLANTILLAS_INVALIDAS", 400);
  }
  await enviarPlantillaGhl({
    ticketId,
    companyId: req.user.companyId,
    name,
    language,
    valores: values && typeof values === "object" ? values : {}
  });
  return res.status(200).json({ ok: true });
};

export default {
  show,
  update,
  workflows,
  enroll,
  customFields,
  templateWorkflows,
  updateTemplateWorkflows,
  sendableTemplates,
  sendTemplate
};
