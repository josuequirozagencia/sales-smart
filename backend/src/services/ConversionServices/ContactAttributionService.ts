import ContactAttribution from "../../models/ContactAttribution";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";

/**
 * Anuncio Click-to-WhatsApp del que llega un mensaje, tal como lo reenvia
 * api_oficial desde el webhook de Meta (messages[].referral).
 */
export interface ReferralMeta {
  ctwa_clid?: string;
  source_id?: string;
  source_type?: string;
  source_url?: string;
  headline?: string;
  media_type?: string;
}

interface Peticion {
  companyId: number;
  contactId: number;
  /** Conexion por la que entro: de ella sale el WABA que Meta exige. */
  whatsapp: Pick<Whatsapp, "id" | "waba_id"> | null;
  referral?: ReferralMeta | null;
  /** Timestamp del mensaje en SEGUNDOS, como lo manda Meta. */
  recibidoEn?: number | string | null;
}

const recortar = (valor: unknown, maximo: number): string | null => {
  if (valor === null || valor === undefined || valor === "") return null;
  return String(valor).slice(0, maximo);
};

/**
 * Guarda la atribucion del contacto. Nunca lanza: si falla, el mensaje se
 * procesa igual y el evento sale sin atribucion.
 *
 * Meta solo manda `referral` en el primer mensaje tras pulsar un anuncio,
 * asi que los mensajes normales no llegan aqui con datos. Si el contacto
 * vuelve a entrar por OTRO anuncio (otro ctwa_clid), se reemplaza: el clic
 * anterior deja de atribuir a los 7 dias y el nuevo es el que cuenta para
 * lo que venda despues. firstCapturedAt conserva la primera llegada.
 */
export const guardarAtribucion = async ({
  companyId,
  contactId,
  whatsapp,
  referral,
  recibidoEn
}: Peticion): Promise<ContactAttribution | null> => {
  try {
    const clid = typeof referral?.ctwa_clid === "string" ? referral.ctwa_clid.trim() : "";
    if (!clid || !contactId || !companyId) return null;

    const segundos = Number(recibidoEn);
    const cuando = Number.isFinite(segundos) && segundos > 0 ? new Date(segundos * 1000) : new Date();

    const datos = {
      whatsappId: whatsapp?.id || null,
      wabaId: recortar(whatsapp?.waba_id, 255),
      ctwaClid: clid,
      sourceId: recortar(referral.source_id, 255),
      sourceType: recortar(referral.source_type, 255),
      sourceUrl: recortar(referral.source_url, 2000),
      headline: recortar(referral.headline, 2000),
      mediaType: recortar(referral.media_type, 255),
      capturedAt: cuando
    };

    const existente = await ContactAttribution.findOne({ where: { contactId, companyId } });

    if (!existente) {
      return await ContactAttribution.create({
        companyId,
        contactId,
        firstCapturedAt: cuando,
        ...datos
      } as any);
    }

    // El mismo clic repetido no cambia nada.
    if (existente.ctwaClid === clid) return existente;

    return await existente.update(datos);
  } catch (err) {
    logger.warn(`[MetaConversions] no se pudo guardar la atribucion del contacto ${contactId}: ${err?.message}`);
    return null;
  }
};
