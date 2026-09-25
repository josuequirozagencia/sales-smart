import { Request, Response } from "express";

import AppError from "../errors/AppError";
import GoogleCalendarIntegration from "../models/GoogleCalendarIntegration";
import {
  isConfigured,
  getAuthUrl,
  handleCallback,
  disconnect
} from "../services/GoogleCalendarServices/OAuthService";
import { pullFromGoogle } from "../services/GoogleCalendarServices/PullService";

/**
 * Conexion con Google Calendar.
 *
 * Nunca se reciben ni se devuelven credenciales de Google. El unico dato
 * sensible —el permiso— vive en la base y no sale de ella: `status` cuenta
 * si hay conexion y con que cuenta, nada mas.
 */

export const status = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const integracion = await GoogleCalendarIntegration.findOne({
    where: { companyId }
  });

  return res.json({
    // Si falta la configuracion del servidor, la pantalla debe explicar
    // que hay que crear las credenciales, no ofrecer un boton que fallara.
    configured: isConfigured(),
    connected: !!(integracion && integracion.active && integracion.refreshToken),
    email: integracion ? integracion.email : null,
    calendarId: integracion ? integracion.calendarId : null,
    lastSyncAt: integracion ? integracion.lastSyncAt : null
  });
};

export const authUrl = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile } = req.user;

  // Conectar el calendario de la empresa afecta a todos: solo el
  // administrador.
  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return res.json({ url: getAuthUrl(companyId) });
};

/**
 * Vuelta desde Google.
 *
 * No lleva isAuth: quien llega aqui es el navegador redirigido por Google,
 * sin la cabecera de sesion del CRM. La empresa se identifica por el
 * `state` que se envio al iniciar, que es justamente para lo que existe.
 */
export const callback = async (req: Request, res: Response): Promise<void> => {
  const { code, state, error } = req.query as {
    code?: string;
    state?: string;
    error?: string;
  };

  const frontend = process.env.FRONTEND_URL || "http://localhost:3000";

  if (error || !code || !state) {
    res.redirect(`${frontend}/connections?google=error`);
    return;
  }

  try {
    await handleCallback(String(code), Number(state));
    res.redirect(`${frontend}/connections?google=ok`);
  } catch (err) {
    res.redirect(`${frontend}/connections?google=error`);
  }
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile } = req.user;

  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await disconnect(companyId);

  return res.json({ message: "Disconnected" });
};

/**
 * Sincroniza a peticion del usuario.
 *
 * Existe ademas del sondeo automatico para no obligar a esperar a la
 * siguiente pasada cuando alguien acaba de cambiar algo en Google.
 */
export const sync = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile } = req.user;

  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const resultado = await pullFromGoogle(companyId);

  if (!resultado) {
    throw new AppError("ERR_GOOGLE_NOT_CONNECTED", 400);
  }

  return res.json(resultado);
};
