import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import CompaniesSettings from "../../models/CompaniesSettings";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import logger from "../../utils/logger";
import { registrarLeadEntrante } from "../ConversionServices/ConversionService";

/**
 * Mensaje entrante de GoHighLevel.
 *
 * NO inventa flujo propio: hace exactamente lo mismo que hacen el canal de
 * Facebook y el de WhatsApp oficial —contacto, ticket, seguimiento,
 * mensaje— y termina en CreateMessageService, que es el unico sitio del
 * proyecto que persiste el mensaje y lo emite por socket. Por eso el
 * ticket aparece en la bandeja del asesor sin tocar nada del frontend.
 *
 * Lo unico propio del canal es de donde sale el mensaje y como se
 * identifica el contacto.
 */

export const CANAL = "ghl";

/**
 * Lo que interesa del evento de GHL.
 *
 * Llega desde la accion "Webhook" de un Workflow, cuyo cuerpo GHL no
 * documenta campo a campo, asi que se leen varios nombres posibles para
 * cada dato en vez de atarse a uno. Lo que no se reconozca se descarta
 * arriba, no revienta.
 */
export interface EventoGhl {
  type?: string;
  locationId?: string;
  contactId?: string;
  conversationId?: string;
  messageId?: string;
  message?: any;
  body?: string;
  direction?: string;
  phone?: string;
  contact?: any;
  [clave: string]: any;
}

interface DatosNormalizados {
  contactIdGhl: string;
  telefono: string;
  nombre: string;
  texto: string;
  idMensaje: string;
  entrante: boolean;
}

/** Primer valor no vacio de una lista de candidatos. */
const primero = (...valores: any[]): string => {
  for (const v of valores) {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return "";
};

/**
 * Saca del evento lo que hace falta, mire como mire GHL.
 *
 * Devuelve null si falta lo imprescindible: sin identificador de contacto
 * y sin telefono no hay a quien atribuir el mensaje.
 */
export const normalizar = (evento: EventoGhl): DatosNormalizados | null => {
  const mensaje = evento.message || {};
  const contacto = evento.contact || {};

  const contactIdGhl = primero(
    evento.contactId,
    mensaje.contactId,
    contacto.id
  );

  const telefono = primero(
    evento.phone,
    contacto.phone,
    mensaje.phone
  ).replace(/[^\d]/g, "");

  if (!contactIdGhl && !telefono) return null;

  const texto = primero(
    evento.body,
    mensaje.body,
    mensaje.message,
    typeof evento.message === "string" ? evento.message : ""
  );

  // GHL marca el sentido de varias formas segun el origen del evento.
  // Se toma como saliente solo lo que lo diga explicitamente: ante la duda
  // es mejor mostrar un mensaje del cliente que perderlo.
  const sentido = primero(
    evento.direction,
    mensaje.direction,
    evento.messageType
  ).toLowerCase();
  const entrante = !["outbound", "outgoing"].includes(sentido);

  return {
    contactIdGhl,
    telefono,
    nombre: primero(
      contacto.name,
      [contacto.firstName, contacto.lastName].filter(Boolean).join(" "),
      evento.full_name,
      telefono
    ),
    texto,
    idMensaje: primero(
      evento.messageId,
      mensaje.id,
      evento.id,
      // Sin identificador propio se fabrica uno estable dentro del segundo.
      // Es el ultimo recurso: la comprobacion de duplicados de mas abajo se
      // apoya en este valor, y dos eventos distintos del mismo contacto en
      // el mismo segundo se tomarian por el mismo. GHL manda messageId en
      // los eventos de conversacion, asi que esto solo actua con payloads
      // recortados de un Workflow.
      `ghl_${contactIdGhl}_${Math.floor(Date.now() / 1000)}`
    ),
    entrante
  };
};

/**
 * Conexion de GHL de la empresa.
 *
 * Es una fila normal de Whatsapp con channel = "ghl". Se busca la activa;
 * si hubiera varias se toma la primera, que es lo mismo que hace el resto
 * del proyecto con las conexiones por defecto.
 */
export const buscarConexion = async (
  companyId: number
): Promise<Whatsapp | null> =>
  Whatsapp.findOne({
    where: { companyId, channel: CANAL },
    order: [["id", "ASC"]]
  });

const ReceiveGhlMessageService = async (
  companyId: number,
  evento: EventoGhl
): Promise<{ atendido: boolean; motivo?: string }> => {
  const datos = normalizar(evento);

  if (!datos) {
    return { atendido: false, motivo: "evento sin contacto ni telefono" };
  }

  // Los salientes ya los pintamos nosotros al enviarlos. Si se guardaran
  // tambien al volver por el webhook, cada respuesta del asesor apareceria
  // dos veces en el hilo.
  if (!datos.entrante) {
    return { atendido: false, motivo: "mensaje saliente, ya registrado" };
  }

  if (!datos.texto) {
    // Adjuntos sin texto: el canal aun no los baja. Se anota y se ignora,
    // en vez de crear un mensaje vacio en el hilo del asesor.
    return { atendido: false, motivo: "mensaje sin texto" };
  }

  const conexion = await buscarConexion(companyId);
  if (!conexion) {
    return { atendido: false, motivo: "la empresa no tiene conexion GHL" };
  }

  const whatsapp = await ShowWhatsAppService(conexion.id, companyId);

  // El contacto se busca primero por su identificador de GHL, que es
  // estable aunque cambien el telefono en GHL.
  let contact: Contact = null;
  if (datos.contactIdGhl) {
    contact = await Contact.findOne({
      where: { ghlContactId: datos.contactIdGhl, companyId }
    });
  }

  if (!contact && !datos.telefono) {
    // Se conoce el contacto de GHL pero no su telefono, y aqui no lo
    // teniamos fichado. Crear un contacto sin numero dejaria una ficha
    // inservible: no se le podria responder por ningun canal. Se anota y
    // se descarta, que es mas honesto que fabricar un registro vacio.
    return {
      atendido: false,
      motivo: `contacto ${datos.contactIdGhl} sin telefono y sin ficha previa`
    };
  }

  // Segundo intento: por numero, para no duplicar un contacto que ya
  // estaba en ChatIA por otro canal.
  if (!contact) {
    contact = await Contact.findOne({
      where: { number: datos.telefono, companyId }
    });
  }

  if (!contact) {
    // Se crea directamente y NO con CreateOrUpdateContactService.
    //
    // Ese servicio solo sabe crear contactos de "whatsapp" y de
    // "facebook"/"instagram": cualquier otro canal cae al final y lanza
    // "Não foi possível criar ou localizar o contato". Por eso el canal
    // oficial (ReceivedWhatsApp) tampoco lo usa y crea a mano. Se sigue el
    // mismo precedente en vez de tocar un servicio del que dependen todos
    // los canales.
    contact = await Contact.create({
      name: datos.nombre,
      number: datos.telefono,
      isGroup: false,
      companyId,
      channel: CANAL,
      whatsappId: whatsapp.id,
      ghlContactId: datos.contactIdGhl || null
    } as any);

    // Meta Conversions API: aqui solo llegan mensajes entrantes (los
    // salientes se descartan arriba), asi que un contacto nuevo escribio
    // primero y es un lead. Solo encola; no espera ni lanza.
    registrarLeadEntrante(contact);
  }

  // Se anota el identificador de GHL si el contacto ya existia sin el.
  if (datos.contactIdGhl && contact.ghlContactId !== datos.contactIdGhl) {
    await contact.update({ ghlContactId: datos.contactIdGhl });
  }

  // GHL reintenta y un Workflow mal montado puede disparar dos veces el
  // mismo evento. CreateMessageService hace upsert, pero el indice de `wid`
  // NO es unico (solo lo es `id`), asi que ese upsert acabaria insertando
  // el mensaje otra vez. Se comprueba aqui antes de tocar nada mas.
  const yaEstaba = await Message.findOne({
    where: { wid: datos.idMensaje, companyId }
  });

  if (yaEstaba) {
    return { atendido: false, motivo: `mensaje ${datos.idMensaje} ya registrado` };
  }

  const settings = await CompaniesSettings.findOne({ where: { companyId } });

  const ticket = await FindOrCreateTicketService(
    contact,
    whatsapp,
    0,
    companyId,
    null,
    null,
    null,
    CANAL,
    false,
    false,
    settings
  );

  // Cola de la conexion GHL (Conexiones > editar la conexion), la misma
  // que usan el resto de canales. Con la cola puesta, el job de reparto
  // de queues.ts (handleRandomUser) ya asigna el ticket a un asesor de
  // esa cola: no filtra por canal.
  //
  // NO se pasa como queueId a FindOrCreateTicketService. Con un ticket
  // existente, un queueId distinto del que ya tiene hace que ese servicio
  // LANCE "Ticket em outro atendimento", y ademas lo sobrescribe sin
  // condiciones: un ticket que un asesor transfirio a otra cola dejaria
  // de recibir mensajes. Aqui se pone solo si el ticket aun no tiene
  // cola, y eso arregla tambien los tickets de antes de este cambio.
  //
  // Con varias colas se toma la primera por orderQueue, que es el orden
  // en que las devuelve ShowWhatsAppService. El menu de chatbot con el
  // que otros canales dejan elegir cola exigiria enviar mensajes por GHL.
  const colaDestino = whatsapp.queues?.[0]?.id || null;

  if (!ticket.queueId && colaDestino) {
    await ticket.update({ queueId: colaDestino });
  }

  await FindOrCreateATicketTrakingService({
    ticketId: ticket.id,
    companyId,
    userId: null,
    whatsappId: whatsapp.id
  });

  await ticket.update({
    lastMessage: datos.texto,
    unreadMessages: ticket.unreadMessages + 1
  });

  await CreateMessageService({
    messageData: {
      wid: datos.idMensaje,
      ticketId: ticket.id,
      contactId: contact.id,
      body: datos.texto,
      fromMe: false,
      mediaType: "conversation",
      read: false,
      ack: 0,
      channel: CANAL,
      ticketTrakingId: null,
      isPrivate: false
    } as any,
    companyId
  });

  logger.info(
    `[GHL] mensaje entrante -> empresa ${companyId}, ticket ${ticket.id}`
  );

  return { atendido: true };
};

export default ReceiveGhlMessageService;
