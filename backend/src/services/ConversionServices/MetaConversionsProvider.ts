import crypto from "crypto";
import axios from "axios";
import MetaConfig from "../../models/MetaConfig";
import { decrypt } from "../../helpers/SecretBox";
import {
  ConversionEvent,
  ConversionOutcome,
  ConversionProvider,
  SIETE_DIAS_MS
} from "./types";

/**
 * Adaptador de Meta Conversions API.
 *
 * Dos rutas, segun lo que se sepa del contacto (ver
 * docs/META_CONVERSIONS_API.md):
 *
 * - business_messaging: si el contacto llego por un anuncio Click-to-
 *   WhatsApp hace menos de 7 dias. Es la unica ruta que atribuye la
 *   conversion al anuncio. Meta exige whatsapp_business_account_id y
 *   ctwa_clid, y en ella solo acepta ciertos nombres: el Lead se manda
 *   como LeadSubmitted, la venta como Purchase, y la cita NO existe (va
 *   siempre por la otra ruta).
 * - standard (action_source "chat"): el resto. Meta identifica al contacto
 *   por su telefono o email cifrados con SHA-256. Sin ninguno de los dos no
 *   hay a quien atribuir nada y el evento no se envia.
 */

export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v20.0";

const sha256 = (texto: string): string =>
  crypto.createHash("sha256").update(texto).digest("hex");

/**
 * Telefono en el formato que pide Meta antes de cifrar: solo digitos, con
 * prefijo de pais. Un LID de WhatsApp (con "@") no es un telefono.
 */
export const normalizarTelefono = (valor?: string | null): string | null => {
  if (!valor || String(valor).includes("@")) return null;
  const digitos = String(valor).replace(/\D/g, "").replace(/^0+/, "");
  return digitos.length >= 7 && digitos.length <= 15 ? digitos : null;
};

export const normalizarEmail = (valor?: string | null): string | null => {
  const email = String(valor || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

/**
 * ¿Se puede atribuir al anuncio? Hace falta el clic, la cuenta de WhatsApp
 * Business y que el evento caiga dentro de los 7 dias desde el clic. Se
 * admite un pequeno margen hacia atras: el Lead nace con el mismo mensaje
 * que trae el clic y los relojes no coinciden al milisegundo.
 */
export const atribucionVigente = (event: ConversionEvent): boolean => {
  const a = event.attribution;
  if (!a || !a.ctwaClid || !a.wabaId || !a.capturedAt) return false;
  const desdeElClic = event.timestamp.getTime() - new Date(a.capturedAt).getTime();
  return desdeElClic >= -5 * 60 * 1000 && desdeElClic <= SIETE_DIAS_MS;
};

export interface EnvioMeta {
  ruta: "business_messaging" | "standard";
  nombreEvento: string;
  evento: Record<string, any>;
}

const datosPersonalizados = (event: ConversionEvent): Record<string, any> | null => {
  if (event.type === "Purchase") {
    return {
      value: Number(event.data.value) || 0,
      currency: event.data.currency,
      ...(event.data.contentName ? { content_name: event.data.contentName } : {})
    };
  }
  if (event.type === "Schedule" && event.data.contentName) {
    return { content_name: event.data.contentName };
  }
  return null;
};

/**
 * El evento tal como se manda a Meta, o null si no hay forma de identificar
 * al contacto. Funcion pura: no lee la base ni llama a nadie.
 */
export const construirEventoMeta = (event: ConversionEvent): EnvioMeta | null => {
  const base = {
    event_time: Math.floor(event.timestamp.getTime() / 1000),
    event_id: event.eventId
  };
  const customData = datosPersonalizados(event);
  const conCustom = customData ? { custom_data: customData } : {};

  if (event.type !== "Schedule" && atribucionVigente(event)) {
    const nombre = event.type === "Lead" ? "LeadSubmitted" : "Purchase";
    return {
      ruta: "business_messaging",
      nombreEvento: nombre,
      evento: {
        event_name: nombre,
        ...base,
        action_source: "business_messaging",
        messaging_channel: "whatsapp",
        user_data: {
          whatsapp_business_account_id: event.attribution.wabaId,
          ctwa_clid: event.attribution.ctwaClid
        },
        ...conCustom
      }
    };
  }

  const telefono = normalizarTelefono(event.user.phone);
  const email = normalizarEmail(event.user.email);
  if (!telefono && !email) return null;

  const userData: Record<string, string[]> = {
    external_id: [sha256(event.user.externalId)]
  };
  if (telefono) userData.ph = [sha256(telefono)];
  if (email) userData.em = [sha256(email)];

  return {
    ruta: "standard",
    nombreEvento: event.type,
    evento: {
      event_name: event.type,
      ...base,
      action_source: "chat",
      user_data: userData,
      ...conCustom
    }
  };
};

// Codigos de error de la Graph API.
const TRANSITORIOS = new Set([1, 2, 4, 17, 32, 341, 613]);
const DE_CREDENCIALES = new Set([3, 10, 102, 190]);

export type TipoErrorMeta = "transient" | "auth" | "payload";

/**
 * Clasifica un error de la Graph API.
 *
 * - transient: sin respuesta, 5xx, 429 o limites de uso. Se reintenta.
 * - auth: token caducado o revocado, permisos, o un dataset que no existe o
 *   al que el token no llega (100/33). No se reintenta: hay que corregir la
 *   configuracion.
 * - payload: Meta rechazo el contenido. Se descarta.
 *
 * El mensaje nunca incluye el token: se arma solo con el error de Meta.
 */
export const clasificarError = (err: any): { tipo: TipoErrorMeta; mensaje: string } => {
  const respuesta = err?.response;
  if (!respuesta) {
    return { tipo: "transient", mensaje: err?.code || "Meta no respondio" };
  }

  const error = respuesta.data?.error || {};
  const codigo = Number(error.code);
  const subcodigo = Number(error.error_subcode);
  const mensaje = error.message
    ? `(${codigo || respuesta.status}${subcodigo ? `/${subcodigo}` : ""}) ${error.message}`
    : `HTTP ${respuesta.status}`;

  if (respuesta.status === 429 || respuesta.status >= 500 || TRANSITORIOS.has(codigo)) {
    return { tipo: "transient", mensaje };
  }

  if (
    respuesta.status === 401 ||
    respuesta.status === 403 ||
    DE_CREDENCIALES.has(codigo) ||
    (codigo >= 200 && codigo <= 299) ||
    (codigo === 100 && subcodigo === 33)
  ) {
    return { tipo: "auth", mensaje };
  }

  return { tipo: "payload", mensaje };
};

interface ClienteHttp {
  post: (url: string, body: any, config?: any) => Promise<{ data: any }>;
}

export class MetaConversionsProvider implements ConversionProvider {
  readonly name = "meta";

  constructor(private readonly http: ClienteHttp = axios) {}

  async send(event: ConversionEvent): Promise<ConversionOutcome> {
    // Siempre la configuracion de la empresa DEL EVENTO: es lo que impide
    // que un evento salga con las credenciales de otra.
    const config = await MetaConfig.findOne({ where: { companyId: event.companyId } });

    if (!config || !config.isActive) {
      return { status: "skipped", reason: "la empresa no tiene Meta activo" };
    }
    if (config.status === "error") {
      return { status: "blocked", reason: config.lastError || "credenciales de Meta con error" };
    }

    const token = decrypt(config.accessToken);
    if (!token || !config.datasetId) {
      return { status: "auth_error", error: "credenciales incompletas o ilegibles: hay que volver a guardarlas" };
    }

    const envio = construirEventoMeta(event);
    if (!envio) {
      return { status: "skipped", reason: "sin telefono ni email con que Meta pueda identificar al contacto" };
    }

    try {
      const { data } = await this.http.post(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${config.datasetId}/events`,
        {
          data: [envio.evento],
          // En el cuerpo y no en la URL, para que no quede en logs de proxies.
          access_token: token,
          ...(config.testEventCode ? { test_event_code: config.testEventCode } : {})
        },
        { timeout: 15000 }
      );

      return {
        status: "sent",
        route: envio.ruta,
        sentEventName: envio.nombreEvento,
        fbtraceId: data?.fbtrace_id || null
      };
    } catch (err) {
      const { tipo, mensaje } = clasificarError(err);
      if (tipo === "transient") return { status: "transient_error", error: mensaje };
      if (tipo === "auth") return { status: "auth_error", error: mensaje };
      return { status: "payload_error", error: mensaje };
    }
  }
}
