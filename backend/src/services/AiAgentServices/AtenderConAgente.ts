import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import momentTz from "moment-timezone";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import ContactWallet from "../../models/ContactWallet";
import User from "../../models/User";
import Queue from "../../models/Queue";
import AiAgent, { HorarioAgente } from "../../models/AiAgent";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
import { businessTimezone } from "../../helpers/RotationPolicy";
import { agenteDeConexion, CANALES_AGENTE, credencialesDe } from "./AiAgentService";
import { ConfigMotor, EntradaMotor, generarRespuesta, OpcionesMotor, ResultadoMotor } from "./AiAgentEngine";
import { Adjunto, TurnoHistorial } from "./Proveedores";
import { pausaParaBloque } from "./PostProceso";
import {
  asegurarEstado,
  cambiarEstado,
  cancelarSeguimientos,
  conBloqueo,
  EstadoIa,
  agenteDeFlujoId,
  fijarEstadoSinBloqueo,
  leerEstado
} from "./EstadoIaTicket";
import { enviadorCanal, MARCA_AUTOMATICO, ticketCompleto } from "./EnvioCanal";
import { programarSeguimiento } from "./Seguimientos";

/**
 * Atencion de mensajes por el agente IA de la conexion, igual en WhatsApp
 * (Baileys), WhatsApp Oficial, Facebook e Instagram.
 *
 * El agente responde si la conversacion tiene la IA ACTIVA, sin mirar a quien
 * esta asignado el ticket: asignacion y estado de la IA son independientes
 * (ver EstadoIaTicket). Si no responde, el listener sigue su camino de siempre.
 */

// ---------------------------------------------------------------------------
// Ajustes que solo cambian los tests

let opcionesMotor: OpcionesMotor = {};
let pausaEntreBloques: (texto: string) => number = pausaParaBloque;

export const opcionesMotorActuales = (): OpcionesMotor => opcionesMotor;

/** Solo para tests: servidor falso del proveedor y pausas cortas. */
export const ajustarParaTests = (ajustes: { motor?: OpcionesMotor; pausa?: (texto: string) => number } | null): void => {
  opcionesMotor = ajustes?.motor || {};
  pausaEntreBloques = ajustes?.pausa || pausaParaBloque;
};

// ---------------------------------------------------------------------------
// Reglas puras

/** ¿Opera el agente en este momento segun su horario? Hora del negocio. */
export const dentroDeHorario = (horario: HorarioAgente | null | undefined, ahora: Date = new Date()): boolean => {
  if (!horario || horario.mode !== "custom") return true;
  const local = momentTz(ahora).tz(businessTimezone());
  const dia = (horario.days || []).find(d => d.day === local.day());
  if (!dia || !dia.enabled) return false;
  const hhmm = local.format("HH:mm");
  return hhmm >= dia.start && hhmm < dia.end;
};

/** Motivo por el que el agente no debe atender este ticket, o null si puede. */
export const motivoNoAtiende = (
  ticket: Pick<Ticket, "channel" | "isGroup" | "imported" | "status" | "useIntegration" | "flowStopped" | "lastFlowId" | "dataWebhook">,
  contact: Pick<Contact, "disableBot"> | null,
  { enFlujo = false }: { enFlujo?: boolean } = {}
): string | null => {
  if (!CANALES_AGENTE.includes(ticket.channel)) return "canal";
  if (ticket.isGroup) return "grupo";
  if (ticket.imported) return "importado";
  if (["closed", "lgpd", "nps", "group"].includes(ticket.status)) return `estado:${ticket.status}`;
  // Typebot, flujo o nodo IA del Flow Builder en marcha: manda esa integracion.
  // Salvo que quien responde sea precisamente el agente de ese nodo.
  if (!enFlujo) {
    if (ticket.useIntegration) return "integracion";
    if (ticket.flowStopped && ticket.lastFlowId) return "flujo";
    if ((ticket.dataWebhook as any)?.waitingInput) return "flujo_input";
  }
  if (contact?.disableBot) return "disableBot";
  return null;
};

const TIPOS_MEDIA: Record<string, "imagen" | "audio" | "video" | "documento" | "sticker"> = {
  image: "imagen",
  audio: "audio",
  ptt: "audio",
  voice: "audio",
  video: "video",
  document: "documento",
  application: "documento",
  file: "documento",
  sticker: "sticker"
};

const DESCRIPCION_MEDIA = {
  imagen: "una imagen",
  audio: "un audio",
  video: "un video",
  documento: "un documento",
  sticker: "un sticker"
};

const archivoDe = (mensaje: Message): string | null => (mensaje.getDataValue("mediaUrl") as string) || null;

/** Texto escrito por la persona, sin nombres de archivo ni rotulos de medios. */
const textoDe = (mensaje: Message): string => {
  const tipo = TIPOS_MEDIA[mensaje.mediaType || ""];
  const cuerpo = (mensaje.body || "").split(MARCA_AUTOMATICO).join("").trim();
  if (!tipo) return cuerpo;
  if (tipo === "audio" || tipo === "sticker") return "";
  const archivo = archivoDe(mensaje);
  return cuerpo && cuerpo !== archivo ? cuerpo : "";
};

export const turnoDeMensaje = (mensaje: Message): TurnoHistorial | null => {
  const tipo = TIPOS_MEDIA[mensaje.mediaType || ""];
  const texto = textoDe(mensaje);
  const contenido = [tipo ? `[${DESCRIPCION_MEDIA[tipo]}]` : "", texto].filter(Boolean).join(" ");
  if (!contenido) return null;
  if (!mensaje.fromMe) return { role: "user", text: contenido };
  // Lo que escribio una persona del equipo mientras la IA estaba pausada: la IA
  // lo tiene en cuenta y sabe que no fue ella.
  const automatico = (mensaje.body || "").includes(MARCA_AUTOMATICO);
  return { role: "assistant", text: automatico ? contenido : `(Mensaje del asesor humano) ${contenido}` };
};

const MIME_POR_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  amr: "audio/amr"
};

const adjuntoDe = (mensaje: Message, companyId: number): Adjunto | null => {
  const archivo = archivoDe(mensaje);
  if (!archivo) return null;
  const ruta = path.resolve(__dirname, "..", "..", "..", "public", `company${companyId}`, path.basename(archivo));
  if (!fs.existsSync(ruta)) {
    logger.warn(`[AI AGENT] Archivo del mensaje ${mensaje.wid} no encontrado: ${ruta}`);
    return null;
  }
  const extension = path.extname(ruta).slice(1).toLowerCase();
  const tipo = TIPOS_MEDIA[mensaje.mediaType || ""];
  const mimetype = MIME_POR_EXTENSION[extension] || (tipo === "audio" ? "audio/ogg" : "image/jpeg");
  return { buffer: fs.readFileSync(ruta), mimetype, fileName: path.basename(ruta) };
};

export const configMotorDe = (agente: AiAgent, apiKey: string): ConfigMotor => ({
  provider: agente.provider,
  model: agente.model,
  apiKey,
  systemPrompt: agente.systemPrompt || "",
  knowledgeText: agente.knowledgeText,
  temperature: agente.temperature,
  maxTokens: agente.maxTokens,
  maxCharacters: agente.maxCharacters,
  dividirRespuestas: agente.dividirRespuestas,
  cantidadBloques: agente.cantidadBloques,
  escuchaAudio: agente.escuchaAudio,
  leeImagenes: agente.leeImagenes
});

/** Ultimos mensajes de la conversacion anteriores a `hasta` (sin notas internas). */
export const historialDelTicket = async (
  ticket: Pick<Ticket, "id" | "companyId">,
  limite: number,
  hasta?: Message
): Promise<TurnoHistorial[]> => {
  const where: any = {
    ticketId: ticket.id,
    companyId: ticket.companyId,
    isPrivate: { [Op.not]: true },
    isDeleted: { [Op.not]: true }
  };
  if (hasta) {
    where.createdAt = { [Op.lte]: hasta.createdAt };
    where.wid = { [Op.ne]: hasta.wid };
  }
  const mensajes = await Message.findAll({ where, order: [["createdAt", "DESC"]], limit: Math.max(1, limite || 10) });
  return mensajes
    .reverse()
    .map(turnoDeMensaje)
    .filter(Boolean) as TurnoHistorial[];
};

// ---------------------------------------------------------------------------
// Envio con prioridad humana

export type ResultadoEnvio = "enviado" | "abortado";

/**
 * Envia los bloques en orden. Antes de cada uno, bajo el bloqueo del ticket,
 * comprueba que la IA siga activa y que el estado no haya cambiado desde que
 * empezo a generarse la respuesta. Si cambio (el asesor escribio, pauso o se
 * transfirio), descarta lo que falta.
 */
export const enviarBloques = async (
  ticket: Ticket,
  contact: Contact,
  bloques: string[],
  versionInicial: number,
  voz?: { voice: string; voiceKey: string; voiceRegion: string } | null
): Promise<ResultadoEnvio> => {
  const enviador = enviadorCanal();
  const partes = voz ? [bloques.join("\n\n")] : bloques;

  for (const parte of partes) {
    await enviador.escribiendo(ticket, true);
    await new Promise(resolve => setTimeout(resolve, pausaEntreBloques(parte)));

    const enviado = await conBloqueo(ticket.id, async () => {
      const estado = await leerEstado(ticket);
      if (!estado.enabled || estado.version !== versionInicial) return false;
      if (voz) {
        const conVoz = await enviador.voz(ticket, contact, parte, voz).catch(err => {
          logger.warn(`[AI AGENT] Voz no enviada en ticket ${ticket.id}, se envia texto: ${(err as Error).message}`);
          return false;
        });
        if (conVoz) return true;
      }
      await enviador.texto(ticket, contact, parte);
      return true;
    });

    if (!enviado) {
      await enviador.escribiendo(ticket, false);
      logger.info(`[AI AGENT] Ticket ${ticket.id}: respuesta descartada, el estado de la IA cambio mientras se generaba`);
      return "abortado";
    }
  }
  return "enviado";
};

// ---------------------------------------------------------------------------
// Transferencia

export type AsignacionTransferencia = "asesor_actual" | "cartera" | "fila" | "sin_asignar";

/**
 * Transferir = pausar la IA + asignar asesor. La asignacion sigue la cadena
 * que ya usa el CRM y NUNCA quita un asesor ya asignado:
 *   1. el ticket ya tiene asesor -> se queda con el
 *   2. el contacto tiene cartera -> su dueno (si es de la empresa)
 *   3. el agente tiene fila de transferencia -> esa fila; el enrutador elige
 *   4. nada de lo anterior -> pendiente sin asesor, visible para el equipo
 * Llamar dentro de conBloqueo(ticket.id).
 */
export const transferirAHumanoSinBloqueo = async (
  ticket: Ticket,
  agente: AiAgent,
  filaPreferida?: number | null
): Promise<AsignacionTransferencia> => {
  await fijarEstadoSinBloqueo(ticket, false, "transfer", null);

  const actual = await Ticket.findOne({ where: { id: ticket.id, companyId: ticket.companyId } });
  if (!actual) return "sin_asignar";
  if (actual.userId) return "asesor_actual";

  const { default: UpdateTicketService } = await import("../TicketServices/UpdateTicketService");

  const cartera = await ContactWallet.findOne({ where: { contactId: actual.contactId, companyId: actual.companyId } });
  if (cartera?.walletId) {
    const dueno = await User.findOne({ where: { id: cartera.walletId, companyId: actual.companyId } });
    if (dueno) {
      await UpdateTicketService({
        ticketData: { userId: dueno.id, queueId: cartera.queueId || actual.queueId || undefined },
        ticketId: actual.id,
        companyId: actual.companyId
      });
      return "cartera";
    }
  }

  const idFila = filaPreferida || agente.transferQueueId;
  if (idFila) {
    const fila = await Queue.findOne({ where: { id: idFila, companyId: actual.companyId } });
    if (fila) {
      await UpdateTicketService({ ticketData: { queueId: fila.id }, ticketId: actual.id, companyId: actual.companyId });
      return "fila";
    }
  }
  return "sin_asignar";
};

// ---------------------------------------------------------------------------
// Proceso de un mensaje

/** Una respuesta a la vez por ticket; si llegan varios mensajes seguidos se contesta al ultimo con todo el contexto. */
const colaProceso = new Map<number, Promise<void>>();
const ultimoEncolado = new Map<number, string>();

const encolar = (ticketId: number, wid: string, tarea: () => Promise<unknown>): Promise<void> => {
  ultimoEncolado.set(ticketId, wid);
  const anterior = colaProceso.get(ticketId) || Promise.resolve();
  const siguiente = anterior
    .then(async () => {
      if (ultimoEncolado.get(ticketId) !== wid) {
        logger.info(`[AI AGENT] Ticket ${ticketId}: mensaje ${wid} agrupado con uno posterior`);
        return;
      }
      await tarea();
    })
    .catch(err => logger.error(`[AI AGENT] Error atendiendo ticket ${ticketId}: ${(err as Error).message}`))
    .finally(() => {
      if (colaProceso.get(ticketId) === siguiente) {
        colaProceso.delete(ticketId);
        if (ultimoEncolado.get(ticketId) === wid) ultimoEncolado.delete(ticketId);
      }
    });
  colaProceso.set(ticketId, siguiente);
  return siguiente;
};

export type ResultadoAtencion = "respondido" | "transferido" | "descartado" | "sin_respuesta" | "no_aplica";

interface OpcionesRespuesta {
  /** Responde el agente de un nodo IA del Flow Builder, no el de la conexion. */
  enFlujo?: boolean;
  /** Fila elegida en el nodo del flujo para transferir. */
  filaTransferencia?: number | null;
}

const responderMensaje = async (
  ticketId: number,
  companyId: number,
  agenteId: number,
  wid: string,
  { enFlujo = false, filaTransferencia = null }: OpcionesRespuesta = {}
): Promise<ResultadoAtencion> => {
  const ticket = await ticketCompleto(ticketId, companyId);
  const contact = ticket.contact;
  const agente = await AiAgent.findOne({ where: { id: agenteId, companyId, isActive: true } });
  if (!agente) return "no_aplica";

  const motivo = motivoNoAtiende(ticket, contact, { enFlujo });
  if (motivo) {
    logger.info(`[AI AGENT] Ticket ${ticket.id}: no se responde (${motivo})`);
    return "no_aplica";
  }
  const estado: EstadoIa = await leerEstado(ticket);
  if (!estado.enabled || !dentroDeHorario(agente.schedule)) return "no_aplica";

  const mensaje = await Message.findOne({ where: { wid, ticketId: ticket.id, companyId } });
  if (!mensaje || mensaje.fromMe) return "no_aplica";

  const tipo = TIPOS_MEDIA[mensaje.mediaType || ""];
  const entrada: EntradaMotor = {
    historial: await historialDelTicket(ticket, agente.maxMessages, mensaje),
    texto: textoDe(mensaje),
    nombreCliente: contact?.name || undefined
  };
  if (tipo === "imagen") entrada.imagen = adjuntoDe(mensaje, companyId) || undefined;
  if (tipo === "audio") entrada.audio = adjuntoDe(mensaje, companyId) || undefined;
  if (tipo && !entrada.imagen && !entrada.audio && !entrada.texto) {
    entrada.texto = `(El cliente envio ${DESCRIPCION_MEDIA[tipo]} que no puedes abrir.)`;
  }

  const { apiKey, voiceKey } = credencialesDe(agente);
  let resultado: ResultadoMotor;
  try {
    resultado = await generarRespuesta(configMotorDe(agente, apiKey), entrada, opcionesMotor);
  } catch (err) {
    // Sin respuesta la conversacion queda para el equipo; no se manda al
    // cliente un error tecnico.
    logger.error(`[AI AGENT] Agente ${agente.id} sin respuesta del proveedor en ticket ${ticket.id}: ${(err as Error).message}`);
    return "sin_respuesta";
  }
  if (resultado.avisos.length) logger.info(`[AI AGENT] Ticket ${ticket.id}: ${resultado.avisos.join(", ")}`);

  const voz =
    agente.voice && agente.voice !== "texto" && voiceKey
      ? { voice: agente.voice, voiceKey, voiceRegion: agente.voiceRegion }
      : null;

  if (resultado.bloques.length) {
    const envio = await enviarBloques(ticket, contact, resultado.bloques, estado.version, voz);
    if (envio === "abortado") return "descartado";
  }

  if (resultado.transferir) {
    const asignacion = await conBloqueo(ticket.id, async () => {
      const vigente = await leerEstado(ticket);
      // Si el asesor ya tomo el control mientras tanto, no hay nada que transferir.
      if (!vigente.enabled || vigente.version !== estado.version) return null;
      if (enFlujo) {
        // Sale del modo IA del flujo, como hacian los nodos IA al transferir.
        await Ticket.update(
          { useIntegration: false, isBot: false, dataWebhook: null } as any,
          { where: { id: ticket.id, companyId } }
        );
      }
      return transferirAHumanoSinBloqueo(ticket, agente, filaTransferencia);
    });
    if (asignacion) logger.info(`[AI AGENT] Ticket ${ticket.id} transferido a humano (${asignacion})`);
    return "transferido";
  }

  // Los seguimientos son del agente de la conexion; en un flujo manda el flujo.
  if (resultado.bloques.length && !enFlujo) await programarSeguimiento(ticket, agente, 1);
  return resultado.bloques.length ? "respondido" : "sin_respuesta";
};

/**
 * Respuesta del agente elegido en un nodo IA del Flow Builder. Mismo motor,
 * envio por canal, estado de la IA y prioridad humana que el de la conexion.
 * Se espera al resultado porque el flujo lo necesita (objetivo cumplido,
 * vuelta al flujo). Si llegan varios mensajes seguidos, se responde al ultimo.
 */
export const responderEnFlujo = async ({
  ticket,
  contact,
  agentId,
  wid,
  filaTransferencia
}: {
  ticket: Ticket;
  contact: Contact;
  agentId: number;
  wid: string | null | undefined;
  filaTransferencia?: number | null;
}): Promise<ResultadoAtencion | "pausado" | "fuera_de_horario" | "agrupado"> => {
  if (!wid) return "no_aplica";
  const agente = await AiAgent.findOne({ where: { id: agentId, companyId: ticket.companyId, isActive: true } });
  if (!agente || !agente.disponibleEnFlujos) {
    logger.warn(`[AI AGENT] Ticket ${ticket.id}: el agente ${agentId} del flujo no esta activo o disponible para flujos`);
    return "no_aplica";
  }
  if (motivoNoAtiende(ticket, contact, { enFlujo: true })) return "no_aplica";

  const estado = await asegurarEstado(ticket);
  if (!estado.enabled) return "pausado";
  if (!dentroDeHorario(agente.schedule)) return "fuera_de_horario";

  let resultado: ResultadoAtencion | "agrupado" = "agrupado";
  await encolar(ticket.id, wid, async () => {
    resultado = await responderMensaje(ticket.id, ticket.companyId, agente.id, wid, {
      enFlujo: true,
      filaTransferencia
    });
  });
  return resultado;
};

/**
 * Enganche de los listeners para cada mensaje ENTRANTE ya guardado.
 * Devuelve true si el agente se hace cargo (el listener no debe seguir con
 * colas, chatbot ni integraciones); false si no le toca.
 * La respuesta se genera en segundo plano: no retiene el webhook ni la cola.
 */
export const atenderMensajeEntrante = async ({
  ticket,
  contact,
  wid
}: {
  ticket: Ticket;
  contact: Contact;
  wid: string | null | undefined;
}): Promise<boolean> => {
  try {
    if (!wid || !ticket?.whatsappId) return false;

    const agente = await agenteDeConexion(ticket.companyId, ticket.whatsappId);
    if (!agente) return false;

    // El cliente respondio: los seguimientos pendientes ya no tienen sentido,
    // responda o no la IA.
    await cancelarSeguimientos(ticket.id, "client_replied");

    if (motivoNoAtiende(ticket, contact)) return false;

    const estado = await asegurarEstado(ticket);
    if (!estado.enabled) return false;
    if (!dentroDeHorario(agente.schedule)) {
      logger.info(`[AI AGENT] Ticket ${ticket.id}: agente ${agente.id} fuera de horario, queda para el equipo`);
      return false;
    }

    encolar(ticket.id, wid, () => responderMensaje(ticket.id, ticket.companyId, agente.id, wid));
    return true;
  } catch (err) {
    logger.error(`[AI AGENT] Error en el enganche del ticket ${ticket?.id}: ${(err as Error).message}`);
    return false;
  }
};

/** Espera a que termine lo encolado para un ticket (tests y apagado ordenado). */
export const esperarAtencion = async (ticketId: number): Promise<void> => {
  while (colaProceso.get(ticketId)) await colaProceso.get(ticketId);
};

// ---------------------------------------------------------------------------
// Control del asesor

export interface EstadoParaAsesor extends EstadoIa {
  available: boolean;
  agentId: number | null;
  agentName: string | null;
  disableBot: boolean;
  withinSchedule: boolean;
}

/**
 * Agente que gobierna la conversacion: el de un nodo IA del flujo en marcha
 * o, si no, el de la conexion.
 */
const agenteDelTicket = async (ticket: Ticket): Promise<{ agente: AiAgent; enFlujo: boolean } | null> => {
  const idFlujo = agenteDeFlujoId(ticket);
  if (idFlujo) {
    const agente = await AiAgent.findOne({ where: { id: idFlujo, companyId: ticket.companyId, isActive: true } });
    if (agente) return { agente, enFlujo: true };
  }
  const deConexion = ticket.whatsappId ? await agenteDeConexion(ticket.companyId, ticket.whatsappId) : null;
  return deConexion ? { agente: deConexion, enFlujo: false } : null;
};

export const estadoParaAsesor = async (ticket: Ticket): Promise<EstadoParaAsesor> => {
  const agente = (await agenteDelTicket(ticket))?.agente || null;
  const estado = await leerEstado(ticket);
  return {
    ...estado,
    available: !!agente && CANALES_AGENTE.includes(ticket.channel),
    agentId: agente?.id || null,
    agentName: agente?.name || null,
    disableBot: !!ticket.contact?.disableBot,
    withinSchedule: agente ? dentroDeHorario(agente.schedule) : false
  };
};

/**
 * Activar o pausar desde la conversacion. Solo cambia el estado de la IA:
 * no reasigna, no cambia el status, no cierra ni abre conversaciones.
 * Al activar, si el ultimo mensaje es del cliente, la IA le responde con todo
 * el historial; si es del equipo, espera al siguiente mensaje del cliente.
 */
export const cambiarEstadoDesdeAsesor = async (
  ticketId: number,
  companyId: number,
  enabled: boolean,
  userId: number
): Promise<EstadoParaAsesor> => {
  const ticket = await ticketCompleto(ticketId, companyId);
  if (ticket.status === "closed") throw new AppError("ERR_AI_AGENT_TICKET_CLOSED", 409);
  const gobierno = await agenteDelTicket(ticket);
  if (!gobierno || !CANALES_AGENTE.includes(ticket.channel)) throw new AppError("ERR_AI_AGENT_NOT_ASSIGNED", 409);
  const { agente, enFlujo } = gobierno;

  await cambiarEstado(ticket, enabled, "manual", userId);

  if (enabled && !motivoNoAtiende(ticket, ticket.contact, { enFlujo }) && dentroDeHorario(agente.schedule)) {
    const ultimo = await Message.findOne({
      where: { ticketId: ticket.id, companyId, isPrivate: { [Op.not]: true }, isDeleted: { [Op.not]: true } },
      order: [["createdAt", "DESC"]]
    });
    if (ultimo && !ultimo.fromMe) {
      const filaTransferencia = enFlujo ? Number((ticket.dataWebhook as any)?.settings?.queueId) || null : null;
      encolar(ticket.id, ultimo.wid, () =>
        responderMensaje(ticket.id, companyId, agente.id, ultimo.wid, { enFlujo, filaTransferencia })
      );
    }
  }
  return estadoParaAsesor(ticket);
};
