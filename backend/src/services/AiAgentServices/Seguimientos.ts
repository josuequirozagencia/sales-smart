import AiAgent, { PasoSeguimiento } from "../../models/AiAgent";
import AiAgentFollowUpJob from "../../models/AiAgentFollowUpJob";
import Ticket from "../../models/Ticket";
import { cancelarSeguimientos } from "./EstadoIaTicket";

/**
 * Programacion de los seguimientos automaticos. "when" es el tiempo sin
 * respuesta del cliente desde el ultimo mensaje del agente: cada respuesta del
 * agente reprograma el paso 1 y cada paso enviado programa el siguiente.
 * El envio lo hace SeguimientosWorker, que vuelve a validarlo todo.
 */

const MINUTOS_POR_UNIDAD: Record<PasoSeguimiento["when"]["unit"], number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24
};

export const vencimientoDe = (paso: PasoSeguimiento, desde: Date): Date =>
  new Date(desde.getTime() + paso.when.amount * MINUTOS_POR_UNIDAD[paso.when.unit] * 60 * 1000);

export const programarSeguimiento = async (
  ticket: Pick<Ticket, "id" | "companyId">,
  agente: Pick<AiAgent, "id" | "followUps">,
  paso: number,
  desde: Date = new Date()
): Promise<AiAgentFollowUpJob | null> => {
  await cancelarSeguimientos(ticket.id, "rescheduled");
  const pasos = agente.followUps || [];
  const config = pasos[paso - 1];
  if (!config) return null;
  return AiAgentFollowUpJob.create({
    companyId: ticket.companyId,
    agentId: agente.id,
    ticketId: ticket.id,
    step: paso,
    dueAt: vencimientoDe(config, desde),
    status: "pending"
  } as any);
};
