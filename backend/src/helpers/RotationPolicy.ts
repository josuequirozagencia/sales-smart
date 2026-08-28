/**
 * Reglas de la rotación automática por falta de respuesta.
 *
 * Aquí vive solo lógica pura, sin acceso a base de datos, para que se pueda
 * probar sin levantar nada. Las partes que consultan la base están en
 * TicketRotationService.
 */

/**
 * Rotaciones automáticas antes de escalar.
 *
 * Primera asignación -> asesor A
 *   rotación 1        -> asesor B
 *   rotación 2        -> asesor C
 *   a partir de ahí, se escala en vez de seguir rotando.
 *
 * Está aquí y en un solo sitio para poder convertirlo después en un ajuste
 * por cola sin buscarlo por el código.
 */
export const MAX_AUTO_ROTATIONS = 2;

/**
 * Tipo de registro en LogTickets que marca "el enrutador asignó este ticket
 * a este asesor en este momento".
 *
 * Hace falta un tipo propio y no vale reutilizar "transfered" por dos
 * motivos. El primero es que "transfered" también lo escribe un traslado
 * manual hecho por una persona, y esos no deben contar para el límite de
 * rotaciones automáticas. El segundo es que en la PRIMERA asignación el
 * enrutador no escribe ningún registro: las cuatro ramas que generan
 * "transfered" en UpdateTicketService exigen que el ticket ya tuviera dueño.
 *
 * La columna `type` de LogTickets es un STRING sin restricción, así que
 * añadir este valor no necesita migración.
 */
export const ROUTER_ASSIGN_LOG = "routerAssign";

/**
 * Nombre de la etiqueta con la que se marca un ticket escalado.
 *
 * Se eligió una etiqueta y no un campo nuevo porque las etiquetas ya se
 * muestran en la lista de tickets, se pueden filtrar y funcionan en el
 * Kanban. El supervisor lo ve sin que haya que tocar el frontend.
 */
export const ESCALATION_TAG_NAME = "Sin respuesta";
export const ESCALATION_TAG_COLOR = "#b91c1c";

/**
 * Convierte "HH:mm" a minutos desde medianoche.
 * Devuelve null si el valor no es una hora válida.
 */
const toMinutes = (value?: string | null): number | null => {
  if (typeof value !== "string") return null;

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
};

/**
 * ¿Está el asesor dentro de su horario laboral en este momento?
 *
 * Los casos límite se resuelven todos hacia "sí está disponible", nunca
 * hacia "no". El motivo es que un dato mal escrito no debe dejar leads sin
 * repartir: es peor perder un lead que asignarlo fuera de horario.
 *
 *   sin datos o datos inválidos -> disponible
 *   inicio igual a fin          -> disponible las 24 horas
 *   horario que cruza medianoche (22:00-06:00) -> disponible si es
 *                                  posterior al inicio O anterior al fin
 *
 * @param startWork  hora de entrada en formato "HH:mm"
 * @param endWork    hora de salida en formato "HH:mm"
 * @param nowMinutes minutos transcurridos desde medianoche en la zona
 *                   horaria del sistema
 */
export const isWithinWorkingHours = (
  startWork: string | null | undefined,
  endWork: string | null | undefined,
  nowMinutes: number
): boolean => {
  const start = toMinutes(startWork);
  const end = toMinutes(endWork);

  // Un horario a medias no restringe nada: sin los dos extremos no hay
  // ventana que comprobar.
  if (start === null || end === null) return true;

  // 00:00-00:00 y 09:00-09:00 se leen igual: sin restricción.
  if (start === end) return true;

  // Turno de noche: la ventana cruza la medianoche, así que el interior del
  // intervalo son los extremos y no el centro.
  if (start > end) {
    return nowMinutes >= start || nowMinutes <= end;
  }

  return nowMinutes >= start && nowMinutes <= end;
};

/**
 * ¿Ha pasado ya el plazo sin respuesta?
 *
 * Está extraída como función pura a propósito. La orquestación vive dentro
 * de un cron de varios cientos de líneas que no se puede montar en una
 * prueba, así que la decisión temporal se saca aquí para poder verificarla.
 *
 * Sin fecha de asignación no hay plazo que medir y se responde que no: es
 * preferible dejar pasar una vuelta del cron a rotar un ticket recién
 * asignado.
 *
 * @param lastAssignedAt cuándo asignó el enrutador este ticket
 * @param minutes        plazo configurado en la cola (tempoRoteador)
 * @param now            momento actual
 */
export const isRotationDue = (
  lastAssignedAt: Date | null | undefined,
  minutes: number,
  now: Date
): boolean => {
  if (!lastAssignedAt) return false;
  if (!Number.isFinite(minutes) || minutes <= 0) return false;

  const transcurrido = now.getTime() - lastAssignedAt.getTime();
  return transcurrido >= minutes * 60 * 1000;
};

/**
 * ¿Se alcanzó el límite de rotaciones automáticas?
 *
 * `assignments` es cuántas veces el enrutador ha asignado este ticket,
 * contando la primera. Con MAX_AUTO_ROTATIONS = 2, la tercera asignación es
 * la última: a partir de ahí se escala.
 */
export const hasReachedRotationLimit = (assignments: number): boolean =>
  Math.max(0, assignments - 1) >= MAX_AUTO_ROTATIONS;

export default {
  MAX_AUTO_ROTATIONS,
  ROUTER_ASSIGN_LOG,
  ESCALATION_TAG_NAME,
  ESCALATION_TAG_COLOR,
  isWithinWorkingHours,
  isRotationDue,
  hasReachedRotationLimit
};
