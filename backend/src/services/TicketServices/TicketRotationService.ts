import { Op } from "sequelize";
import Message from "../../models/Message";
import LogTicket from "../../models/LogTicket";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import {
  ROUTER_ASSIGN_LOG,
  ESCALATION_TAG_NAME,
  ESCALATION_TAG_COLOR
} from "../../helpers/RotationPolicy";

/**
 * Parte de la rotación automática que necesita consultar la base de datos.
 *
 * La lógica pura —horarios y límite de rotaciones— vive en
 * helpers/RotationPolicy para poder probarla sin base de datos.
 */

/**
 * Deja constancia de que el enrutador asignó un ticket a un asesor.
 *
 * Este registro es la única fuente del momento de asignación. No sirve
 * `TicketTraking.startedAt`, porque se fija cuando el ticket pasa a "open" y
 * vuelve a null al pasar a "pending", y la rotación actúa justamente sobre
 * tickets pendientes. Tampoco sirve `Ticket.updatedAt`, porque cualquier
 * mensaje entrante del cliente lo refresca: un lead ignorado que insiste
 * reiniciaría su propio contador de espera.
 */
export const logRouterAssignment = async (
  ticketId: number,
  userId: number,
  queueId: number
): Promise<void> => {
  await LogTicket.create({
    ticketId,
    userId,
    queueId,
    type: ROUTER_ASSIGN_LOG
  });
};

interface RotationState {
  /** Veces que el enrutador ha asignado este ticket, contando la primera. */
  assignments: number;
  /** Cuándo se hizo la última asignación, o null si nunca la hubo. */
  lastAssignedAt: Date | null;
  /** A quién se asignó la última vez. */
  lastAssignedUserId: number | null;
}

/**
 * Cuántas veces se asignó el ticket y cuándo fue la última.
 */
export const getRotationState = async (
  ticketId: number
): Promise<RotationState> => {
  const logs = await LogTicket.findAll({
    where: { ticketId, type: ROUTER_ASSIGN_LOG },
    order: [["createdAt", "DESC"]]
  });

  if (logs.length === 0) {
    return { assignments: 0, lastAssignedAt: null, lastAssignedUserId: null };
  }

  return {
    assignments: logs.length,
    lastAssignedAt: logs[0].createdAt,
    lastAssignedUserId: logs[0].userId
  };
};

/**
 * ¿Respondió una persona al cliente después de un momento dado?
 *
 * Usa la misma regla que el reporte de tiempo de respuesta, para que las dos
 * funciones no puedan discrepar sobre qué cuenta como atención humana:
 *
 *   fromMe = true            sale de la empresa, no del cliente
 *   isPrivate distinto de true   descarta las notas internas, que el
 *                                cliente nunca ve
 *   sin el carácter U+200E    descarta los mensajes automáticos, que el
 *                             sistema prefija con esa marca invisible
 *
 * Un cuerpo vacío cuenta como respuesta: son los envíos de medios sin
 * texto, y un audio o una imagen del asesor es atención igual que un texto.
 * La columna body es NOT NULL, así que esos llegan como cadena vacía y no
 * como null.
 */
export const hasHumanReplySince = async (
  ticketId: number,
  since: Date
): Promise<boolean> => {
  const marker = String.fromCharCode(8206);

  const count = await Message.count({
    where: {
      ticketId,
      fromMe: true,
      createdAt: { [Op.gt]: since },
      isPrivate: { [Op.not]: true },
      body: { [Op.notLike]: `%${marker}%` }
    }
  });

  return count > 0;
};

/**
 * Marca el ticket como escalado colgándole una etiqueta.
 *
 * Se eligió una etiqueta y no un campo nuevo porque ya se muestran en la
 * lista de tickets, se filtran y funcionan en el Kanban: el supervisor lo ve
 * sin tocar el frontend y sin migración.
 *
 * Es idempotente. Si la etiqueta ya está puesta no hace nada, de modo que
 * repetir la llamada no duplica filas.
 */
export const markEscalated = async (
  ticketId: number,
  companyId: number
): Promise<void> => {
  const [tag] = await Tag.findOrCreate({
    where: { name: ESCALATION_TAG_NAME, companyId },
    defaults: {
      name: ESCALATION_TAG_NAME,
      color: ESCALATION_TAG_COLOR,
      companyId,
      kanban: 0
    } as any
  });

  const already = await TicketTag.findOne({
    where: { ticketId, tagId: tag.id }
  });

  if (!already) {
    await TicketTag.create({ ticketId, tagId: tag.id });
  }
};

/**
 * ¿Está ya escalado este ticket?
 *
 * Se comprueba antes de rotar: un ticket escalado no vuelve a la rotación
 * automática, espera al supervisor.
 */
export const isEscalated = async (
  ticketId: number,
  companyId: number
): Promise<boolean> => {
  const tag = await Tag.findOne({
    where: { name: ESCALATION_TAG_NAME, companyId }
  });

  if (!tag) return false;

  const link = await TicketTag.findOne({
    where: { ticketId, tagId: tag.id }
  });

  return !!link;
};

export default {
  logRouterAssignment,
  getRotationState,
  hasHumanReplySince,
  markEscalated,
  isEscalated
};
