import { Request, Response } from "express";
import AppError from "../errors/AppError";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import GhlTemplate from "../models/GhlTemplate";
import {
  verConfiguracion,
  guardarConfiguracion
} from "../services/GhlServices/GhlConfigService";
import {
  clienteDeEmpresa,
  listarFlujos,
  inscribirEnFlujo
} from "../services/GhlServices/GhlApiClient";
import { resolverContactoGhl } from "../services/GhlServices/SendGhlMessage";

/**
 * Administracion del canal de GoHighLevel.
 *
 * Todo lo de aqui es de administrador de la empresa: credenciales, flujos
 * y plantillas. El envio de mensajes NO pasa por este controlador, va por
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
  // GHL: Settings > Integrations > Webhooks, o una accion "Webhook" de un
  // Workflow. GHL no tiene API para crear esa suscripcion.
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
  const { token, locationId, isActive } = req.body;

  if (!locationId) {
    throw new AppError("ERR_GHL_FALTA_LOCATION", 400);
  }

  await guardarConfiguracion({
    companyId,
    // Cadena vacia significa "no lo cambies", no "borralo": la pantalla
    // nunca muestra el token guardado, asi que un campo vacio es lo normal
    // al editar cualquier otra cosa.
    token: token || undefined,
    locationId,
    isActive: isActive !== false
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
// Plantillas
// ---------------------------------------------------------------------------
//
// GHL no expone las plantillas aprobadas por Meta, asi que se anotan a
// mano. Esta lista es un espejo de lo que ya esta aprobado alli; aqui no
// se valida nada contra Meta.

export const listTemplates = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const templates = await GhlTemplate.findAll({
    where: { companyId },
    order: [["name", "ASC"]]
  });

  return res.status(200).json(templates);
};

export const storeTemplate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  soloAdmin(req);
  const { companyId } = req.user;
  const { name, language, body, variables, isActive } = req.body;

  if (!name || !body) {
    throw new AppError("ERR_GHL_PLANTILLA_INCOMPLETA", 400);
  }

  const template = await GhlTemplate.create({
    companyId,
    name,
    language: language || "es",
    body,
    variables: JSON.stringify(variables || []),
    isActive: isActive !== false
  } as any);

  return res.status(201).json(template);
};

export const updateTemplate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  soloAdmin(req);
  const { companyId } = req.user;
  const { templateId } = req.params;
  const { name, language, body, variables, isActive } = req.body;

  const template = await GhlTemplate.findOne({
    where: { id: templateId, companyId }
  });

  if (!template) {
    throw new AppError("ERR_GHL_PLANTILLA_NO_ENCONTRADA", 404);
  }

  await template.update({
    ...(name ? { name } : {}),
    ...(language ? { language } : {}),
    ...(body ? { body } : {}),
    ...(variables ? { variables: JSON.stringify(variables) } : {}),
    ...(isActive !== undefined ? { isActive } : {})
  });

  return res.status(200).json(template);
};

export const removeTemplate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  soloAdmin(req);
  const { companyId } = req.user;
  const { templateId } = req.params;

  const template = await GhlTemplate.findOne({
    where: { id: templateId, companyId }
  });

  if (!template) {
    throw new AppError("ERR_GHL_PLANTILLA_NO_ENCONTRADA", 404);
  }

  await template.destroy();

  return res.status(200).json({ ok: true });
};

export default {
  show,
  update,
  workflows,
  enroll,
  listTemplates,
  storeTemplate,
  updateTemplate,
  removeTemplate
};
