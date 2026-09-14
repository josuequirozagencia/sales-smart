import logger from "../../utils/logger";
import Appointment from "../../models/Appointment";
import Company from "../../models/Company";
import Contact from "../../models/Contact";
import ContactAttribution from "../../models/ContactAttribution";
import ConversionEventLog from "../../models/ConversionEventLog";
import MetaConfig from "../../models/MetaConfig";
import Sale from "../../models/Sale";
import { MetaConversionsProvider } from "./MetaConversionsProvider";
import {
  ConversionEvent,
  ConversionEventType,
  ConversionProvider,
  SIETE_DIAS_MS
} from "./types";

/**
 * Trabajo de la cola metaConversionsQueue: envia un evento registrado.
 *
 * Reintentos segun el resultado (ver MetaConversionsProvider):
 * - transitorio: se lanza para que Bull reintente con backoff; al agotar
 *   los intentos queda "failed".
 * - credenciales: la configuracion de la empresa pasa a "error", el evento
 *   queda "blocked" y no se reintenta; se reencola al corregirlas.
 * - contenido: "failed", sin reintentos.
 */

let proveedor: ConversionProvider = new MetaConversionsProvider();

/** Para los tests: sustituye el proveedor. Sin argumento vuelve al de Meta. */
export const setProveedorDeConversiones = (nuevo?: ConversionProvider): void => {
  proveedor = nuevo || new MetaConversionsProvider();
};

/**
 * Canales en los que Contact.number es un telefono. En Facebook e
 * Instagram es el identificador de la plataforma, que no sirve como `ph`.
 */
const CANALES_CON_TELEFONO = ["whatsapp", "ghl"];

type Construido = { evento: ConversionEvent } | { motivo: string };

/**
 * Arma el evento desde la base, en el momento de enviar.
 *
 * Todo se busca con el companyId del registro: un id de otra empresa no
 * encuentra nada, asi que un evento nunca lleva datos ajenos.
 */
export const construirEvento = async (log: ConversionEventLog): Promise<Construido> => {
  const { companyId } = log;

  const contact = log.contactId
    ? await Contact.findOne({ where: { id: log.contactId, companyId } })
    : null;
  if (!contact) return { motivo: "el contacto ya no existe en la empresa" };

  const data: ConversionEvent["data"] = { channel: contact.channel };

  if (log.eventType === "Purchase") {
    const venta = await Sale.findOne({ where: { id: log.sourceId, companyId } });
    if (!venta) return { motivo: "la venta ya no existe en la empresa" };

    const empresa = await Company.findByPk(companyId, { attributes: ["id", "currency"] });
    const moneda = String(empresa?.currency || "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(moneda)) {
      return { motivo: `la empresa no tiene una moneda valida (${empresa?.currency || "vacia"})` };
    }

    data.value = Number(venta.total) || 0;
    data.currency = moneda;
    data.contentName = venta.productName || null;
  } else if (log.eventType === "Schedule") {
    const cita = await Appointment.findOne({ where: { id: log.sourceId, companyId } });
    if (!cita) return { motivo: "la cita ya no existe en la empresa" };
    data.contentName = cita.title || null;
  } else if (log.sourceId !== contact.id) {
    return { motivo: "el lead no corresponde a su contacto" };
  }

  // La cita no se atribuye: Meta no la admite en la ruta de mensajeria.
  const atribucion =
    log.eventType === "Schedule"
      ? null
      : await ContactAttribution.findOne({ where: { contactId: contact.id, companyId } });

  return {
    evento: {
      type: log.eventType as ConversionEventType,
      companyId,
      contactId: contact.id,
      eventId: log.eventId,
      timestamp: new Date(log.occurredAt),
      attribution: atribucion
        ? {
            ctwaClid: atribucion.ctwaClid,
            wabaId: atribucion.wabaId,
            sourceId: atribucion.sourceId,
            sourceType: atribucion.sourceType,
            headline: atribucion.headline,
            mediaType: atribucion.mediaType,
            capturedAt: atribucion.capturedAt
          }
        : null,
      user: {
        phone: CANALES_CON_TELEFONO.includes(contact.channel) ? contact.number : null,
        email: contact.email || null,
        externalId: `${companyId}:${contact.id}`
      },
      data
    }
  };
};

export interface ProgresoIntento {
  /** Intentos fallidos antes de este (job.attemptsMade de Bull). */
  attemptsMade: number;
  maxAttempts: number;
}

export const procesarConversion = async (
  logId: number,
  progreso: ProgresoIntento = { attemptsMade: 0, maxAttempts: 1 }
): Promise<void> => {
  const log = await ConversionEventLog.findByPk(logId);
  if (!log) return;

  // Solo lo pendiente. Un evento ya enviado no sale otra vez aunque Bull
  // repita el trabajo.
  if (log.status !== "pending") return;

  if (Date.now() - new Date(log.occurredAt).getTime() > SIETE_DIAS_MS) {
    await log.update({ status: "expired", lastError: "caducado: Meta no admite eventos de mas de 7 dias" });
    return;
  }

  const construido = await construirEvento(log);
  if ("motivo" in construido) {
    await log.update({ status: "skipped", lastError: construido.motivo });
    return;
  }

  await log.update({ attempts: (log.attempts || 0) + 1 });

  const resultado = await proveedor.send(construido.evento);
  const { companyId } = log;

  switch (resultado.status) {
    case "sent":
      await log.update({
        status: "sent",
        route: resultado.route,
        sentEventName: resultado.sentEventName,
        fbtraceId: resultado.fbtraceId || null,
        sentAt: new Date(),
        lastError: null
      });
      await MetaConfig.update(
        { status: "ok", lastSuccessAt: new Date(), lastError: null } as any,
        { where: { companyId } }
      );
      return;

    case "skipped":
      await log.update({ status: "skipped", lastError: resultado.reason });
      return;

    case "blocked":
      await log.update({ status: "blocked", lastError: resultado.reason });
      return;

    case "auth_error":
      await log.update({ status: "blocked", lastError: resultado.error });
      await MetaConfig.update(
        { status: "error", lastError: resultado.error, lastErrorAt: new Date() } as any,
        { where: { companyId } }
      );
      logger.warn(`[MetaConversions] empresa ${companyId}: credenciales rechazadas, se pausan sus envios: ${resultado.error}`);
      return;

    case "payload_error":
      await log.update({ status: "failed", lastError: resultado.error });
      logger.warn(`[MetaConversions] empresa ${companyId}: Meta rechazo el evento ${log.eventId}: ${resultado.error}`);
      return;

    default: {
      const error = resultado.status === "transient_error" ? resultado.error : "resultado desconocido";
      const ultimo = progreso.attemptsMade + 1 >= progreso.maxAttempts;
      await log.update({ lastError: error, ...(ultimo ? { status: "failed" } : {}) });
      if (!ultimo) {
        throw new Error(`[MetaConversions] error transitorio en ${log.eventId}, se reintenta: ${error}`);
      }
    }
  }
};
