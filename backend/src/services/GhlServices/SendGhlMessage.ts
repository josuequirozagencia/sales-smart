import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import CreateMessageService from "../MessageServices/CreateMessageService";
import formatBody from "../../helpers/Mustache";
import AppError from "../../errors/AppError";
import { clienteDeEmpresa, enviarMensaje, upsertContacto } from "./GhlApiClient";
import { CANAL } from "./ReceiveGhlMessageService";

/**
 * Respuesta del asesor por el canal de GoHighLevel.
 *
 * En vez de salir a Meta directamente, va a la API de GHL. Asi la
 * conversacion queda espejada alli y las automatizaciones que dependen de
 * "mensaje saliente" se siguen disparando, que es el motivo de conectar
 * por GHL en lugar de por Meta directo.
 *
 * El mensaje se guarda en ChatIA SOLO si GHL lo acepto. Guardarlo antes
 * dejaria en el hilo del asesor mensajes que el cliente nunca recibio.
 */

interface Peticion {
  body: string;
  ticket: Ticket;
  media?: Express.Multer.File;
}

/**
 * URL publica de un archivo ya subido.
 *
 * GHL no acepta el archivo en el cuerpo: pide una URL que pueda descargar
 * el mismo. El proyecto ya sirve `public/` de forma estatica (ver app.ts),
 * asi que basta con componer la direccion.
 *
 * Si BACKEND_URL no apunta a una direccion alcanzable desde internet, GHL
 * no podra bajarse el archivo. Es el mismo requisito que ya tiene el
 * webhook de entrada.
 */
const urlPublica = (companyId: number, nombre: string): string | null => {
  const base = process.env.BACKEND_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/public/company${companyId}/${nombre}`;
};

/**
 * Identificador del contacto en GHL, creandolo alli si hiciera falta.
 *
 * Un contacto puede existir en ChatIA sin haber pasado nunca por GHL —lo
 * creo un asesor a mano, o llego por otro canal y luego se movio— y en ese
 * caso hay que darlo de alta antes de poder escribirle.
 */
export const resolverContactoGhl = async (
  cliente: any,
  contact: Contact
): Promise<string | null> => {
  if (contact.ghlContactId) return contact.ghlContactId;

  const id = await upsertContacto(cliente, {
    phone: contact.number,
    name: contact.name,
    email: contact.email || undefined
  });

  if (id) {
    await contact.update({ ghlContactId: id });
  }

  return id;
};

const SendGhlMessage = async ({ body, ticket, media }: Peticion) => {
  const contact = ticket.contact || (await Contact.findByPk(ticket.contactId));

  if (!contact) {
    throw new AppError("ERR_GHL_TICKET_SIN_CONTACTO", 400);
  }

  const cliente = await clienteDeEmpresa(ticket.companyId);

  const contactIdGhl = await resolverContactoGhl(cliente, contact);
  if (!contactIdGhl) {
    throw new AppError("ERR_GHL_CONTACTO_NO_RESUELTO", 400);
  }

  // formatBody resuelve las variables ({{name}} y demas) igual que en el
  // resto de canales, para que las respuestas rapidas funcionen aqui.
  const texto = formatBody(body, ticket);

  const adjuntos: string[] = [];
  if (media) {
    const url = urlPublica(ticket.companyId, media.filename);
    if (!url) {
      throw new AppError("ERR_GHL_SIN_BACKEND_URL", 400);
    }
    adjuntos.push(url);
  }

  const envio = await enviarMensaje(cliente, {
    contactId: contactIdGhl,
    message: texto,
    ...(adjuntos.length ? { attachments: adjuntos } : {})
  });

  if (!envio.ok) {
    throw new AppError(`ERR_GHL_ENVIO: ${envio.error}`, 400);
  }

  await ticket.update({ lastMessage: texto, unreadMessages: 0 });

  // El webhook de GHL puede traer el eco de este mismo envio antes de que
  // llegue aqui: en ese caso ReceiveGhlMessageService ya lo guardo con el
  // mismo wid (el messageId de GHL) y no se crea otra vez.
  if (envio.messageId) {
    const yaGuardado = await Message.findOne({ where: { wid: envio.messageId, companyId: ticket.companyId } });
    if (yaGuardado) return envio;
  }

  await CreateMessageService({
    messageData: {
      // El identificador que devuelve GHL. Si no lo devolviera se fabrica
      // uno propio: sin `wid` el upsert de CreateMessageService no tiene
      // clave y el mensaje no se guardaria.
      wid: envio.messageId || `ghl_out_${ticket.id}_${Date.now()}`,
      ticketId: ticket.id,
      contactId: contact.id,
      body: texto,
      fromMe: true,
      // El tipo se deduce del mime del archivo, como en el resto de
      // canales, para que la burbuja lo pinte como imagen o audio y no
      // como texto con un enlace.
      mediaType: media ? media.mimetype.split("/")[0] : "conversation",
      ...(media ? { mediaUrl: media.filename } : {}),
      read: true,
      // 1 = enviado. GHL no devuelve confirmaciones de entrega por esta
      // via, asi que el estado no avanza mas; poner 3 (leido) seria
      // afirmar algo que no sabemos.
      ack: 1,
      channel: CANAL,
      ticketTrakingId: null,
      isPrivate: false
    } as any,
    companyId: ticket.companyId
  });

  return envio;
};

export default SendGhlMessage;
