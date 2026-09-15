import fs from "fs";
import path from "path";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import ShowTicketService from "../TicketServices/ShowTicketService";
import logger from "../../utils/logger";
import { registrarEnvioAgente } from "./EstadoIaTicket";

/**
 * Envio de las respuestas del agente por el canal del ticket, reutilizando los
 * servicios de envio que ya usa el CRM. Todo texto del agente lleva U+200E al
 * principio: es la marca con la que el sistema reconoce los mensajes
 * automaticos (los listeners ignoran su eco y el enrutador no los cuenta como
 * atencion humana).
 *
 * Los listeners de Baileys y Facebook se importan al usarse y no al cargar el
 * modulo: esos listeners importan a su vez este servicio.
 */

export const MARCA_AUTOMATICO = "\u200e";

export interface EnviadorCanal {
  escribiendo(ticket: Ticket, activo: boolean): Promise<void>;
  texto(ticket: Ticket, contact: Contact, texto: string): Promise<void>;
  /** false si el canal no admite voz: quien llama manda texto. */
  voz(ticket: Ticket, contact: Contact, texto: string, voz: ConfigVoz): Promise<boolean>;
}

export interface ConfigVoz {
  voice: string;
  voiceKey: string;
  voiceRegion: string;
}

const carpetaEmpresa = (companyId: number): string => {
  const carpeta = path.resolve(__dirname, "..", "..", "..", "public", `company${companyId}`);
  if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
  return carpeta;
};

const borrar = (archivo: string): void => {
  fs.rmSync(archivo, { force: true });
};

const jidBaileys = async (ticket: Ticket): Promise<string> => {
  const { normalizeJid } = await import("../../utils");
  const contacto = ticket.contact || (await Contact.findByPk(ticket.contactId));
  return normalizeJid(`${contacto!.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`);
};

const sintetizar = async (companyId: number, ticketId: number, texto: string, voz: ConfigVoz): Promise<{ mp3: string; nombre: string }> => {
  const { convertTextToSpeechAndSaveToFile, keepOnlySpecifiedChars } = await import("../WbotServices/wbotMessageListener");
  const nombre = `ai-agent-${ticketId}-${Date.now()}`;
  const base = path.join(carpetaEmpresa(companyId), nombre);
  await convertTextToSpeechAndSaveToFile(keepOnlySpecifiedChars(texto), base, voz.voiceKey, voz.voiceRegion, voz.voice, "mp3");
  borrar(`${base}.wav`);
  return { mp3: `${base}.mp3`, nombre: `${nombre}.mp3` };
};

const enviadorReal: EnviadorCanal = {
  async escribiendo(ticket, activo) {
    try {
      if (ticket.channel === "whatsapp") {
        const { default: GetTicketWbot } = await import("../../helpers/GetTicketWbot");
        const wbot = await GetTicketWbot(ticket);
        await wbot.sendPresenceUpdate(activo ? "composing" : "paused", await jidBaileys(ticket));
      } else if (["facebook", "instagram"].includes(ticket.channel) && ticket.whatsapp?.facebookUserToken) {
        const { showTypingIndicator } = await import("../FacebookServices/graphAPI");
        await showTypingIndicator(ticket.contact.number, ticket.whatsapp.facebookUserToken, activo ? "typing_on" : "typing_off");
      }
      // WhatsApp Oficial no tiene indicador de escritura en la API de Meta.
    } catch (err) {
      logger.debug(`[AI AGENT] Indicador de escritura no enviado en ticket ${ticket.id}: ${(err as Error).message}`);
    }
  },

  async texto(ticket, contact, texto) {
    const cuerpo = `${MARCA_AUTOMATICO}${texto}`;
    if (ticket.channel === "whatsapp") {
      const { default: SendWhatsAppMessage } = await import("../WbotServices/SendWhatsAppMessage");
      const { verifyMessage } = await import("../WbotServices/wbotMessageListener");
      const enviado = await SendWhatsAppMessage({ body: cuerpo, ticket });
      registrarEnvioAgente(enviado?.key?.id);
      await verifyMessage(enviado, ticket, contact);
      return;
    }
    if (ticket.channel === "whatsapp_oficial") {
      const { default: SendWhatsAppOficialMessage } = await import("../WhatsAppOficial/SendWhatsAppOficialMessage");
      // Este servicio ya guarda el mensaje enviado.
      await SendWhatsAppOficialMessage({ body: cuerpo, ticket, quotedMsg: null, type: "text", media: null, vCard: null });
      return;
    }
    if (["facebook", "instagram"].includes(ticket.channel)) {
      const { sendFacebookMessage } = await import("../FacebookServices/sendFacebookMessage");
      const { verifyMessageFace } = await import("../FacebookServices/facebookMessageListener");
      const enviado = await sendFacebookMessage({ body: cuerpo, ticket });
      registrarEnvioAgente(enviado?.message_id);
      // El eco de Meta lleva la marca y el listener lo ignora: se guarda aqui,
      // en Facebook y tambien en Instagram.
      await verifyMessageFace(enviado, cuerpo, ticket, contact, true);
      return;
    }
    throw new Error(`ERR_AI_AGENT_CHANNEL_UNSUPPORTED:${ticket.channel}`);
  },

  async voz(ticket, contact, texto, voz) {
    if (!voz.voiceKey || !voz.voiceRegion || !["whatsapp", "whatsapp_oficial"].includes(ticket.channel)) return false;
    const { mp3, nombre } = await sintetizar(ticket.companyId, ticket.id, texto, voz);
    try {
      if (ticket.channel === "whatsapp") {
        const { default: GetTicketWbot } = await import("../../helpers/GetTicketWbot");
        const { verifyMediaMessage } = await import("../WbotServices/wbotMessageListener");
        const wbot = await GetTicketWbot(ticket);
        const enviado = await wbot.sendMessage(await jidBaileys(ticket), {
          audio: { url: mp3 },
          mimetype: "audio/mpeg",
          ptt: true
        });
        registrarEnvioAgente(enviado?.key?.id);
        await verifyMediaMessage(enviado, ticket, contact, null as any, false, false, wbot);
        borrar(mp3);
      } else {
        const { default: SendWhatsAppOficialMessage } = await import("../WhatsAppOficial/SendWhatsAppOficialMessage");
        // El archivo se queda en public/: el mensaje guardado apunta a el.
        const media = { path: mp3, filename: nombre, originalname: nombre, mimetype: "audio/mpeg" } as Express.Multer.File;
        await SendWhatsAppOficialMessage({ body: MARCA_AUTOMATICO, ticket, quotedMsg: null, type: "audio", media, vCard: null });
      }
      return true;
    } catch (err) {
      borrar(mp3);
      throw err;
    }
  }
};

let enviador: EnviadorCanal = enviadorReal;

export const enviadorCanal = (): EnviadorCanal => enviador;

/** Solo para tests: sustituye el envio real por uno falso. */
export const usarEnviadorCanal = (otro: EnviadorCanal | null): void => {
  enviador = otro || enviadorReal;
};

/** Ticket con conexion y contacto, que es lo que piden los servicios de envio. */
export const ticketCompleto = (ticketId: number, companyId: number): Promise<Ticket> =>
  ShowTicketService(ticketId, companyId);
