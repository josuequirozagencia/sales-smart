import axios, { AxiosInstance } from "axios";
import { obtenerCredenciales } from "./GhlConfigService";
import logger from "../../utils/logger";

/**
 * Cliente de la API v2 de GoHighLevel.
 *
 * Se autentica con el Private Integration Token de la empresa. El token NO
 * se registra en ningun log: los errores se recortan al mensaje y al
 * codigo, nunca a la configuracion de la peticion, que lleva la cabecera
 * Authorization dentro.
 *
 * La cabecera `Version` es obligatoria en la v2; sin ella GHL responde 401
 * y parece un problema de credenciales cuando no lo es.
 */

const BASE = "https://services.leadconnectorhq.com";
const VERSION_API = "2021-07-28";

/** Ninguna llamada a GHL debe colgar una peticion del asesor. */
const TIEMPO_LIMITE = 15000;

export const crearCliente = (token: string): AxiosInstance =>
  axios.create({
    baseURL: BASE,
    timeout: TIEMPO_LIMITE,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: VERSION_API,
      Accept: "application/json",
      "Content-Type": "application/json"
    }
  });

/**
 * Resume un fallo de axios sin filtrar el token.
 *
 * `err.config.headers` lleva la cabecera Authorization, asi que volcar el
 * error entero —que es lo que se hace en otras partes del proyecto— lo
 * dejaria escrito en el log.
 */
export const resumirError = (err: any): string => {
  const estado = err?.response?.status;
  const detalle =
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    "error desconocido";
  return estado ? `GHL ${estado}: ${detalle}` : `GHL: ${detalle}`;
};

export interface ClienteGhl {
  api: AxiosInstance;
  locationId: string;
}

/** Cliente ya autenticado para una empresa. */
export const clienteDeEmpresa = async (
  companyId: number
): Promise<ClienteGhl> => {
  const { token, locationId } = await obtenerCredenciales(companyId);
  return { api: crearCliente(token), locationId };
};

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

/**
 * Busca o crea el contacto en GHL a partir del telefono.
 *
 * `upsert` en vez de create: si el contacto ya existe en la location, GHL
 * devuelve el que hay en lugar de fallar con un duplicado. Es lo que hace
 * falta cuando el contacto pudo nacer en cualquiera de los dos lados.
 */
export const upsertContacto = async (
  cliente: ClienteGhl,
  datos: { phone: string; name?: string; email?: string }
): Promise<string | null> => {
  try {
    const { data } = await cliente.api.post("/contacts/upsert", {
      locationId: cliente.locationId,
      phone: datos.phone,
      ...(datos.name ? { name: datos.name } : {}),
      ...(datos.email ? { email: datos.email } : {})
    });
    return data?.contact?.id || data?.id || null;
  } catch (err) {
    logger.error(`[GHL] upsert de contacto: ${resumirError(err)}`);
    return null;
  }
};

/**
 * Manda un mensaje saliente por la conversacion de GHL.
 *
 * Requiere el scope conversations/message.write en el token.
 *
 * El `type` es el canal por el que GHL debe sacarlo. Se deja como
 * parametro porque una misma location puede tener WhatsApp y SMS, y quien
 * llama sabe cual corresponde al ticket.
 */
export const enviarMensaje = async (
  cliente: ClienteGhl,
  datos: {
    contactId: string;
    message: string;
    type?: string;
    attachments?: string[];
  }
): Promise<{ ok: boolean; messageId?: string; error?: string }> => {
  try {
    const { data } = await cliente.api.post("/conversations/messages", {
      type: datos.type || "WhatsApp",
      contactId: datos.contactId,
      message: datos.message,
      ...(datos.attachments?.length ? { attachments: datos.attachments } : {})
    });
    return { ok: true, messageId: data?.messageId || data?.id };
  } catch (err) {
    const error = resumirError(err);
    logger.error(`[GHL] envio de mensaje: ${error}`);
    return { ok: false, error };
  }
};

/** Anade etiquetas al contacto. Requiere el scope contacts.write. */
export const anadirEtiquetas = async (
  cliente: ClienteGhl,
  contactId: string,
  tags: string[]
): Promise<boolean> => {
  try {
    await cliente.api.post(`/contacts/${contactId}/tags`, { tags });
    return true;
  } catch (err) {
    logger.error(`[GHL] anadir etiquetas: ${resumirError(err)}`);
    return false;
  }
};

/**
 * Quita etiquetas del contacto.
 *
 * El cuerpo va en `data` porque axios no manda cuerpo en un DELETE si se
 * pasa como segundo argumento, que es el sitio donde iria en un POST. Sin
 * esto la peticion sale sin etiquetas y GHL no borra nada, en silencio.
 */
export const quitarEtiquetas = async (
  cliente: ClienteGhl,
  contactId: string,
  tags: string[]
): Promise<boolean> => {
  try {
    await cliente.api.delete(`/contacts/${contactId}/tags`, { data: { tags } });
    return true;
  } catch (err) {
    logger.error(`[GHL] quitar etiquetas: ${resumirError(err)}`);
    return false;
  }
};

/** Inscribe el contacto en un flujo. Requiere el scope contacts.write. */
export const inscribirEnFlujo = async (
  cliente: ClienteGhl,
  contactId: string,
  workflowId: string
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await cliente.api.post(`/contacts/${contactId}/workflow/${workflowId}`, {
      eventStartTime: new Date().toISOString()
    });
    return { ok: true };
  } catch (err) {
    const error = resumirError(err);
    logger.error(`[GHL] inscripcion en flujo: ${error}`);
    return { ok: false, error };
  }
};

/**
 * Lista los flujos de la location.
 *
 * Devuelve null —no lista vacia— cuando la llamada falla, para que quien
 * llame pueda distinguir "no hay flujos" de "no se pudieron leer" y caer
 * en los anotados a mano en la configuracion.
 */
export const listarFlujos = async (
  cliente: ClienteGhl
): Promise<{ id: string; name: string }[] | null> => {
  try {
    const { data } = await cliente.api.get("/workflows/", {
      params: { locationId: cliente.locationId }
    });
    const flujos = data?.workflows || [];
    return flujos.map((w: any) => ({ id: w.id, name: w.name }));
  } catch (err) {
    logger.error(`[GHL] listado de flujos: ${resumirError(err)}`);
    return null;
  }
};

export default {
  crearCliente,
  clienteDeEmpresa,
  upsertContacto,
  enviarMensaje,
  anadirEtiquetas,
  quitarEtiquetas,
  inscribirEnFlujo,
  listarFlujos,
  resumirError
};
