import { google } from "googleapis";

import AppError from "../../errors/AppError";
import GoogleCalendarIntegration from "../../models/GoogleCalendarIntegration";

/**
 * Conexion con Google Calendar mediante OAuth 2.0.
 *
 * En ningun momento se pide ni se guarda la contraseña de Google, y no es
 * una limitacion sino el proposito del mecanismo: el usuario se identifica
 * EN GOOGLE, autoriza solo el calendario, y lo que llega aqui es un
 * permiso acotado que puede retirar cuando quiera desde su cuenta.
 */

/** Solo el calendario. Ni correo, ni contactos, ni nada mas. */
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email"
];

export const isConfigured = (): boolean =>
  !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const redirectUri = (): string =>
  process.env.GOOGLE_REDIRECT_URI ||
  `${process.env.BACKEND_URL || "http://localhost:8080"}/google/callback`;

export const buildClient = () => {
  if (!isConfigured()) {
    throw new AppError("ERR_GOOGLE_NOT_CONFIGURED");
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri()
  );
};

/**
 * URL a la que se manda al usuario para que autorice.
 *
 * `access_type: offline` y `prompt: consent` no son opcionales aqui:
 * Google solo entrega el refreshToken —el unico que permite seguir
 * funcionando sin volver a molestar a nadie— cuando se piden los dos. Sin
 * ellos la conexion dejaria de servir en una hora.
 *
 * El companyId viaja en `state` para saber a quien pertenece la respuesta
 * cuando Google devuelva al usuario.
 */
export const getAuthUrl = (companyId: number): string => {
  const client = buildClient();

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: String(companyId)
  });
};

/**
 * Cierra la conexion: cambia el codigo que devuelve Google por los tokens
 * y los guarda.
 */
export const handleCallback = async (
  code: string,
  companyId: number
): Promise<GoogleCalendarIntegration> => {
  const client = buildClient();

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Correo de la cuenta, solo para poder mostrar cual esta conectada.
  let email: string = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const info = await oauth2.userinfo.get();
    email = info.data.email;
  } catch (err) {
    // Si no se puede leer, la conexion sirve igual: es un dato de adorno.
  }

  const existente = await GoogleCalendarIntegration.findOne({
    where: { companyId }
  });

  const datos: any = {
    companyId,
    email,
    accessToken: tokens.access_token,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    active: true
  };

  // Al reconectar, Google puede no devolver refreshToken. Sobrescribirlo
  // con null dejaria la conexion muerta en una hora, asi que solo se toca
  // cuando viene uno nuevo.
  if (tokens.refresh_token) {
    datos.refreshToken = tokens.refresh_token;
  }

  if (existente) {
    await existente.update(datos);
    return existente;
  }

  return GoogleCalendarIntegration.create(datos);
};

/**
 * Cliente listo para llamar a la API, renovando el acceso si hace falta.
 *
 * Devuelve null si no hay conexion: quien lo use debe tratar ese caso, no
 * suponer que siempre hay calendario.
 */
export const getAuthorizedClient = async (companyId: number) => {
  if (!isConfigured()) return null;

  const integracion = await GoogleCalendarIntegration.findOne({
    where: { companyId, active: true }
  });

  if (!integracion || !integracion.refreshToken) return null;

  const client = buildClient();
  client.setCredentials({
    access_token: integracion.accessToken,
    refresh_token: integracion.refreshToken,
    expiry_date: integracion.expiresAt
      ? new Date(integracion.expiresAt).getTime()
      : null
  });

  // La libreria renueva sola el acceso cuando caduca; aqui se guarda el
  // nuevo para no repetir la renovacion en cada llamada.
  client.on("tokens", async nuevos => {
    try {
      const cambios: any = {};
      if (nuevos.access_token) cambios.accessToken = nuevos.access_token;
      if (nuevos.expiry_date) cambios.expiresAt = new Date(nuevos.expiry_date);
      if (nuevos.refresh_token) cambios.refreshToken = nuevos.refresh_token;
      if (Object.keys(cambios).length) await integracion.update(cambios);
    } catch (err) {
      // Que no se pueda guardar el token nuevo no impide usarlo ahora.
    }
  });

  return client;
};

/**
 * Retira la conexion.
 *
 * Se intenta revocar tambien en Google, para que el permiso desaparezca de
 * verdad y no solo deje de usarse aqui.
 */
export const disconnect = async (companyId: number): Promise<void> => {
  const integracion = await GoogleCalendarIntegration.findOne({
    where: { companyId }
  });

  if (!integracion) return;

  if (integracion.refreshToken && isConfigured()) {
    try {
      const client = buildClient();
      await client.revokeToken(integracion.refreshToken);
    } catch (err) {
      // Si Google rechaza la revocacion —por ejemplo porque ya se retiro
      // desde su cuenta— igualmente hay que borrarlo de aqui.
    }
  }

  await integracion.destroy();
};

export default {
  isConfigured,
  getAuthUrl,
  handleCallback,
  getAuthorizedClient,
  disconnect
};
