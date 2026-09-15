import { Op } from "sequelize";
import AiAgentTicketState from "../../models/AiAgentTicketState";
import AiAgentFollowUpJob from "../../models/AiAgentFollowUpJob";
import Ticket from "../../models/Ticket";
import TicketTraking from "../../models/TicketTraking";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import { hasHumanReplySince } from "../TicketServices/TicketRotationService";
import { agenteDeConexion } from "./AiAgentService";

/**
 * Estado del agente IA en una conversacion: activo o pausado.
 *
 * REGLA: este estado y la asignacion del ticket (userId, status, fila) son
 * independientes. Nada de este archivo cambia la asignacion.
 *
 * - Vale por atencion (TicketTraking). Al cerrarse el ticket la atencion
 *   termina y la siguiente empieza con la IA activa.
 * - Sin fila guardada para la atencion actual, la IA esta activa salvo que un
 *   humano ya haya escrito en esa atencion (misma regla que usa el enrutador:
 *   fromMe, no privado, sin U+200E). Evita que la IA irrumpa en conversaciones
 *   que ya atendia una persona el dia que se asigna un agente a la conexion.
 * - version sube con cada cambio. Quien genera una respuesta la anota al
 *   empezar y, justo antes de enviar cada bloque, comprueba bajo el bloqueo del
 *   ticket que no haya cambiado. Asi un mensaje del asesor (que pausa bajo el
 *   mismo bloqueo ANTES de enviarse) nunca queda seguido de una respuesta de IA
 *   que ya estaba en camino.
 *
 * El bloqueo vive en memoria: el backend es un unico proceso (las sesiones de
 * Baileys estan en memoria y no admiten varias replicas).
 */

export type MotivoEstado = "transfer" | "human_message" | "manual";

export interface EstadoIa {
  ticketId: number;
  enabled: boolean;
  reason: MotivoEstado | null;
  changedByUserId: number | null;
  version: number;
  updatedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Bloqueo por ticket

const colas = new Map<number, Promise<void>>();

/** Ejecuta fn en exclusiva para el ticket: nunca dos a la vez, en orden de llegada. */
export const conBloqueo = async <T>(ticketId: number, fn: () => Promise<T>): Promise<T> => {
  const anterior = colas.get(ticketId) || Promise.resolve();
  let liberar!: () => void;
  const turno = new Promise<void>(resolve => {
    liberar = resolve;
  });
  const cola = anterior.then(() => turno);
  colas.set(ticketId, cola);
  await anterior;
  try {
    return await fn();
  } finally {
    liberar();
    if (colas.get(ticketId) === cola) colas.delete(ticketId);
  }
};

// ---------------------------------------------------------------------------
// Mensajes que envia el propio agente

const enviadosPorAgente = new Map<string, number>();
const VIGENCIA_ENVIO_MS = 10 * 60 * 1000;

/**
 * Los textos del agente llevan U+200E y se reconocen solos, pero un audio no
 * tiene texto: su eco de Baileys pareceria un mensaje humano y pausaria la IA.
 */
export const registrarEnvioAgente = (wid: string | null | undefined): void => {
  if (!wid) return;
  const ahora = Date.now();
  for (const [clave, caduca] of enviadosPorAgente) if (caduca < ahora) enviadosPorAgente.delete(clave);
  enviadosPorAgente.set(wid, ahora + VIGENCIA_ENVIO_MS);
};

export const fueEnviadoPorAgente = (wid: string | null | undefined): boolean =>
  !!wid && (enviadosPorAgente.get(wid) || 0) > Date.now();

// ---------------------------------------------------------------------------
// Lectura y escritura

const atencionActual = async (ticketId: number): Promise<TicketTraking | null> =>
  TicketTraking.findOne({
    where: { ticketId, finishedAt: { [Op.is]: null } },
    order: [["id", "DESC"]]
  });

const desdeFila = (fila: AiAgentTicketState): EstadoIa => ({
  ticketId: fila.ticketId,
  enabled: fila.enabled,
  reason: (fila.reason as MotivoEstado) || null,
  changedByUserId: fila.changedByUserId || null,
  version: fila.version,
  updatedAt: fila.updatedAt
});

type TicketMinimo = Pick<Ticket, "id" | "companyId">;

interface Lectura {
  estado: EstadoIa;
  fila: AiAgentTicketState | null;
  atencion: TicketTraking | null;
  vigente: boolean;
}

const leer = async (ticket: TicketMinimo): Promise<Lectura> => {
  const [fila, atencion] = await Promise.all([
    AiAgentTicketState.findOne({ where: { ticketId: ticket.id, companyId: ticket.companyId } }),
    atencionActual(ticket.id)
  ]);

  // Ticket cerrado: no hay atencion abierta y vale lo ultimo que se fijo.
  const vigente = !!fila && (!atencion || fila.ticketTrakingId === atencion.id);
  if (vigente) return { estado: desdeFila(fila!), fila, atencion, vigente };

  const humano = atencion ? await hasHumanReplySince(ticket.id, atencion.createdAt) : false;
  return {
    estado: {
      ticketId: ticket.id,
      enabled: !humano,
      reason: humano ? "human_message" : null,
      changedByUserId: null,
      version: fila?.version || 0,
      updatedAt: null
    },
    fila,
    atencion,
    vigente
  };
};

export const leerEstado = async (ticket: TicketMinimo): Promise<EstadoIa> => (await leer(ticket)).estado;

const emitir = (companyId: number, estado: EstadoIa): void => {
  try {
    getIO()
      .of(String(companyId))
      .emit(`company-${companyId}-aiAgentTicketState`, { action: "update", state: estado });
  } catch (err) {
    // Sin socket (tests, arranque): el estado ya esta guardado.
    logger.debug(`[AI AGENT] Estado sin emitir por socket: ${(err as Error).message}`);
  }
};

export const cancelarSeguimientos = async (ticketId: number, motivo: string): Promise<number> => {
  const [cancelados] = await AiAgentFollowUpJob.update(
    { status: "cancelled", reason: motivo },
    { where: { ticketId, status: "pending" } }
  );
  return cancelados;
};

/**
 * Guarda el estado para la atencion actual. Llamar SIEMPRE dentro de
 * conBloqueo(ticket.id). No toca el ticket.
 */
export const fijarEstadoSinBloqueo = async (
  ticket: TicketMinimo,
  enabled: boolean,
  reason: MotivoEstado | null,
  userId: number | null
): Promise<EstadoIa> => {
  const { fila, atencion } = await leer(ticket);
  const datos = {
    companyId: ticket.companyId,
    ticketId: ticket.id,
    ticketTrakingId: atencion?.id ?? fila?.ticketTrakingId ?? null,
    enabled,
    reason,
    changedByUserId: userId,
    version: (fila?.version || 0) + 1
  };
  const guardada = fila ? await fila.update(datos) : await AiAgentTicketState.create(datos as any);
  const estado = desdeFila(guardada);

  if (!enabled) {
    const cancelados = await cancelarSeguimientos(ticket.id, `ai_paused:${reason || "manual"}`);
    if (cancelados) logger.info(`[AI AGENT] Ticket ${ticket.id}: ${cancelados} seguimiento(s) cancelado(s) al pausar`);
  }
  emitir(ticket.companyId, estado);
  return estado;
};

export const cambiarEstado = (
  ticket: TicketMinimo,
  enabled: boolean,
  reason: MotivoEstado | null,
  userId: number | null
): Promise<EstadoIa> => conBloqueo(ticket.id, () => fijarEstadoSinBloqueo(ticket, enabled, reason, userId));

/**
 * Deja guardado el estado de la atencion actual si aun no lo estaba. Se llama
 * cuando el agente va a actuar: a partir de ahi sus propios mensajes (un audio
 * sin U+200E, por ejemplo) ya no cuentan para calcular el estado por defecto.
 */
export const asegurarEstado = (ticket: TicketMinimo): Promise<EstadoIa> =>
  conBloqueo(ticket.id, async () => {
    const lectura = await leer(ticket);
    if (lectura.vigente) return lectura.estado;
    const { estado } = lectura;
    return fijarEstadoSinBloqueo(ticket, estado.enabled, estado.reason, null);
  });

/**
 * Prioridad humana: un mensaje manual pausa la IA de esa conversacion.
 * Desde Sales Smart se llama ANTES de enviar; desde los listeners, al recibir
 * el eco de un mensaje escrito en el celular o en la bandeja de Meta.
 * Devuelve true si ha pausado.
 */
export const pausarPorMensajeHumano = async (
  ticket: TicketMinimo & Pick<Ticket, "whatsappId">,
  { userId = null, wid = null }: { userId?: number | null; wid?: string | null } = {}
): Promise<boolean> => {
  if (fueEnviadoPorAgente(wid)) return false;
  try {
    return await conBloqueo(ticket.id, async () => {
      // Solo conversaciones que gobierna un agente: la conexion tiene uno, o ya
      // actuo uno aqui. El resto de tickets ni consulta el estado ni crea filas.
      const conFila = (await AiAgentTicketState.count({ where: { ticketId: ticket.id, companyId: ticket.companyId } })) > 0;
      if (!conFila && !(ticket.whatsappId && (await agenteDeConexion(ticket.companyId, ticket.whatsappId)))) {
        return false;
      }
      const lectura = await leer(ticket);
      if (!lectura.estado.enabled) return false;
      // Se guarda aunque la IA aun no haya actuado en esta atencion: si no, una
      // respuesta que arranque justo ahora no veria el mensaje humano, que
      // todavia no esta en la base.
      await fijarEstadoSinBloqueo(ticket, false, "human_message", userId);
      logger.info(`[AI AGENT] Ticket ${ticket.id}: IA pausada por mensaje humano${userId ? ` (usuario ${userId})` : ""}`);
      return true;
    });
  } catch (err) {
    // Nunca se bloquea el mensaje de una persona por un fallo de la IA. Si el
    // estado no se pudo leer, la IA tampoco podra confirmar el suyo antes de
    // enviar (enviarBloques lo relee) y no respondera.
    logger.error(`[AI AGENT] No se pudo pausar la IA del ticket ${ticket.id}: ${(err as Error).message}`);
    return false;
  }
};
