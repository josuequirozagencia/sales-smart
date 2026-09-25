import { Op } from "sequelize";
import AiAgent from "../../models/AiAgent";
import AiAgentFollowUpJob from "../../models/AiAgentFollowUpJob";
import Message from "../../models/Message";
import logger from "../../utils/logger";
import { agenteDeConexion, credencialesDe } from "./AiAgentService";
import { generarRespuesta } from "./AiAgentEngine";
import {
  configMotorDe,
  dentroDeHorario,
  enviarBloques,
  historialDelTicket,
  motivoNoAtiende,
  opcionesMotorActuales
} from "./AtenderConAgente";
import { leerEstado } from "./EstadoIaTicket";
import { ticketCompleto } from "./EnvioCanal";
import { programarSeguimiento } from "./Seguimientos";

/**
 * Envia los seguimientos vencidos. Se reutiliza la idea de AppointmentReminder
 * (fila programada que un proceso periodico envia) y no el worker de Schedule,
 * porque ese solo sabe mandar un texto fijo por Baileys.
 *
 * Todo se vuelve a validar al enviar: si la IA esta pausada, el ticket cerrado,
 * el contacto con "Desactivar chatbot" o el agente ya no esta en la conexion,
 * el seguimiento se cancela. Fuera del horario del agente espera.
 */

const LOTE = 50;

const terminar = (job: AiAgentFollowUpJob, status: string, reason: string, lastError?: string) =>
  job.update({ status, reason, lastError: lastError || null, sentAt: status === "sent" ? new Date() : null });

export const procesarSeguimiento = async (job: AiAgentFollowUpJob): Promise<string> => {
  // Reserva: si otra pasada ya lo tomo, no se envia dos veces.
  const [reservado] = await AiAgentFollowUpJob.update(
    { status: "processing" },
    { where: { id: job.id, status: "pending" } }
  );
  if (!reservado) return "reservado";
  await job.reload();

  try {
    const ticket = await ticketCompleto(job.ticketId, job.companyId).catch(() => null);
    if (!ticket) {
      await terminar(job, "cancelled", "ticket_not_found");
      return "cancelado";
    }

    const agente = await AiAgent.findOne({ where: { id: job.agentId, companyId: job.companyId, isActive: true } });
    const deLaConexion = ticket.whatsappId ? await agenteDeConexion(job.companyId, ticket.whatsappId) : null;
    if (!agente || deLaConexion?.id !== agente.id) {
      await terminar(job, "cancelled", "agent_unavailable");
      return "cancelado";
    }

    const motivo = motivoNoAtiende(ticket, ticket.contact);
    if (motivo) {
      await terminar(job, "cancelled", motivo);
      return "cancelado";
    }

    const estado = await leerEstado(ticket);
    if (!estado.enabled) {
      await terminar(job, "cancelled", "ai_paused");
      return "cancelado";
    }

    if (!dentroDeHorario(agente.schedule)) {
      await job.update({ status: "pending" });
      return "espera";
    }

    const ultimo = await Message.findOne({
      where: { ticketId: ticket.id, companyId: job.companyId, isPrivate: { [Op.not]: true }, isDeleted: { [Op.not]: true } },
      order: [["createdAt", "DESC"]]
    });
    if (ultimo && !ultimo.fromMe) {
      await terminar(job, "cancelled", "client_replied");
      return "cancelado";
    }

    const paso = (agente.followUps || [])[job.step - 1];
    if (!paso || !paso.content?.trim()) {
      await terminar(job, "cancelled", "step_removed");
      return "cancelado";
    }

    let bloques: string[];
    const { apiKey, voiceKey } = credencialesDe(agente);
    if (paso.mode === "manual") {
      bloques = [paso.content.trim()];
    } else {
      const resultado = await generarRespuesta(configMotorDe(agente, apiKey), {
        historial: await historialDelTicket(ticket, agente.maxMessages),
        instruccion: `El cliente no ha respondido. Escribe un mensaje de seguimiento breve y natural siguiendo esta indicacion: ${paso.content.trim()}`,
        nombreCliente: ticket.contact?.name || undefined
      }, opcionesMotorActuales());
      bloques = resultado.bloques;
    }
    if (!bloques.length) {
      await terminar(job, "failed", "empty_response");
      return "fallido";
    }

    const voz =
      agente.voice && agente.voice !== "texto" && voiceKey
        ? { voice: agente.voice, voiceKey, voiceRegion: agente.voiceRegion }
        : null;
    const envio = await enviarBloques(ticket, ticket.contact, bloques, estado.version, voz);
    if (envio === "abortado") {
      await terminar(job, "cancelled", "ai_paused");
      return "cancelado";
    }

    await terminar(job, "sent", null as any);
    await programarSeguimiento(ticket, agente, job.step + 1);
    return "enviado";
  } catch (err) {
    // WhatsApp Oficial e Instagram rechazan texto libre pasadas 24 h desde el
    // ultimo mensaje del cliente: queda como fallido con el motivo de Meta.
    logger.error(`[AI AGENT] Seguimiento ${job.id} del ticket ${job.ticketId} fallido: ${(err as Error).message}`);
    await terminar(job, "failed", "send_error", (err as Error).message);
    return "fallido";
  }
};

export const procesarSeguimientosVencidos = async (ahora: Date = new Date()): Promise<number> => {
  // Un reinicio a mitad de envio deja el paso en "processing". No se sabe si
  // llego a salir, asi que no se reintenta: se marca y el siguiente paso no se
  // programa.
  await AiAgentFollowUpJob.update(
    { status: "failed", reason: "interrupted" },
    { where: { status: "processing", updatedAt: { [Op.lt]: new Date(ahora.getTime() - 15 * 60 * 1000) } } }
  );
  const vencidos = await AiAgentFollowUpJob.findAll({
    where: { status: "pending", dueAt: { [Op.lte]: ahora } },
    order: [["dueAt", "ASC"]],
    limit: LOTE
  });
  for (const job of vencidos) {
    await procesarSeguimiento(job);
  }
  return vencidos.length;
};

let enMarcha = false;

/** Cada minuto. Una pasada no se solapa con la siguiente. */
export const iniciarSeguimientosAgentes = (): void => {
  const CronJob = require("cron").CronJob;
  const job = new CronJob("30 * * * * *", async () => {
    if (enMarcha) return;
    enMarcha = true;
    try {
      await procesarSeguimientosVencidos();
    } catch (err) {
      logger.error(`[AI AGENT] Fallo general de seguimientos: ${(err as Error).message}`);
    } finally {
      enMarcha = false;
    }
  });
  job.start();
  logger.info("[AI AGENT] Worker de seguimientos iniciado");
};
