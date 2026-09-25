import sequelize from "../../database";
import { QueryTypes } from "sequelize";

/**
 * Desde cuándo espera respuesta el cliente en cada ticket.
 *
 * Sirve para el contador que la lista de tickets muestra sobre cada
 * conversación. Devuelve el momento en que empezó la espera actual, no una
 * duración: el navegador calcula los minutos y así el número avanza solo
 * sin volver a pedir nada al servidor.
 *
 * NO se puede usar `Ticket.updatedAt` para esto, que sería lo evidente.
 * Esa columna la mueve cualquier cosa que toque el ticket —un cambio de
 * estado, una asignación, el propio enrutador— y no solo un mensaje del
 * cliente. Medido contra los mensajes reales, se desviaba hasta 287
 * minutos en los tickets de esta instalación. Tampoco sirve
 * `Ticket.fromMe`, que solo se escribe en el flujo de mensaje por
 * inactividad y acertaba en 17 de 20.
 *
 * La definición de "respuesta" es la misma que usan el reporte de tiempo
 * de respuesta y la rotación automática, para que las tres funciones no
 * puedan discrepar sobre qué cuenta como atención humana:
 *
 *   fromMe = true              sale de la empresa, no del cliente
 *   isPrivate distinto de true descarta las notas internas, que el
 *                              cliente nunca ve
 *   sin el carácter U+200E     descarta los mensajes automáticos, que el
 *                              sistema prefija con esa marca invisible
 *   isDeleted distinto de true una respuesta borrada no atendió a nadie
 *
 * Un ticket ausente del resultado es un ticket que no está esperando:
 * o nunca escribió el cliente, o ya se le contestó después.
 */

/** Marca invisible con la que el sistema prefija los mensajes del bot. */
const MARCA_BOT = String.fromCharCode(8206);

interface Fila {
  ticketId: number;
  waitingSince: Date;
}

const consulta = `
  with respuesta as (
    -- Última vez que una persona contestó en cada ticket.
    select m."ticketId", max(m."createdAt") as "at"
    from "Messages" m
    where m."ticketId" in (:ticketIds)
      and m."fromMe" = true
      and m."isPrivate" is not true
      and m."isDeleted" is not true
      and position(:marcaBot in m."body") = 0
    group by m."ticketId"
  )
  -- Primer mensaje del cliente posterior a esa respuesta: ahí empezó la
  -- espera que sigue abierta. Si nunca hubo respuesta, cuenta desde el
  -- primer mensaje del cliente.
  select m."ticketId" as "ticketId", min(m."createdAt") as "waitingSince"
  from "Messages" m
  left join respuesta r on r."ticketId" = m."ticketId"
  where m."ticketId" in (:ticketIds)
    and m."fromMe" = false
    and m."isDeleted" is not true
    and (r."at" is null or m."createdAt" > r."at")
  group by m."ticketId"
`;

/**
 * @param ticketIds tickets de la página que se está listando
 * @returns mapa ticketId -> momento en que empezó la espera
 */
export const getWaitStartByTicket = async (
  ticketIds: number[]
): Promise<Map<number, Date>> => {
  const mapa = new Map<number, Date>();

  // Sin tickets no hay nada que consultar, y un IN vacío es un error de
  // sintaxis en Postgres.
  if (!ticketIds.length) return mapa;

  const filas = await sequelize.query<Fila>(consulta, {
    replacements: { ticketIds, marcaBot: MARCA_BOT },
    type: QueryTypes.SELECT
  });

  filas.forEach(f => mapa.set(Number(f.ticketId), f.waitingSince));

  return mapa;
};

export default { getWaitStartByTicket };
