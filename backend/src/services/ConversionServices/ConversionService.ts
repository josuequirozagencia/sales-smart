import { Op } from "sequelize";
import logger from "../../utils/logger";
import MetaConfig from "../../models/MetaConfig";
import ConversionEventLog from "../../models/ConversionEventLog";
import Contact from "../../models/Contact";
import Sale from "../../models/Sale";
import Appointment from "../../models/Appointment";
import {
  ConversionEventType,
  ConversionSourceType,
  SIETE_DIAS_MS,
  eventIdDe
} from "./types";

/**
 * Entrada del motor de conversiones: los disparadores SOLO encolan.
 *
 * Regla que no se negocia: crear un contacto, una cita o una venta tiene
 * que funcionar exactamente igual aunque Meta este caido o mal
 * configurado. Por eso:
 *
 * - encolarConversion nunca lanza: cualquier error se anota y se sigue.
 * - dispararConversion ni siquiera se espera: quien vende no aguarda a la
 *   cola ni a la base de este modulo.
 * - La logica vive aqui y en ProcessConversionJob, nunca dentro de
 *   SaleServices ni AppointmentServices: a ventas y citas se les cuelga un
 *   listener de modelo (registrarListenersDeConversion).
 * - Nada llama a Meta en el momento: lo hace el trabajo de la cola.
 */

export type Encolador = (logId: number, jobId: string) => Promise<void>;

const encoladorBull: Encolador = async (logId, jobId) => {
  // Import perezoso a proposito: queues.ts arrastra media aplicacion
  // (sesiones de WhatsApp, campanas...). Importarlo arriba ataria ese arbol
  // a cualquiera que registre una venta, tests incluidos.
  // eslint-disable-next-line global-require
  const { metaConversionsQueue } = require("../../queues");
  await metaConversionsQueue.add(
    "Send",
    { logId },
    {
      jobId,
      attempts: 5,
      // 30 s, 1 min, 2 min, 4 min.
      backoff: { type: "exponential", delay: 30000 },
      removeOnComplete: true,
      removeOnFail: 500
    }
  );
};

let encolador: Encolador = encoladorBull;

/** Para los tests: sustituye la cola. Sin argumento vuelve a la de Bull. */
export const setEncoladorDeConversiones = (nuevo?: Encolador): void => {
  encolador = nuevo || encoladorBull;
};

const enCurso = new Set<Promise<unknown>>();

/** Para los tests: espera a los encolados lanzados sin esperar. */
export const esperarConversionesEnCurso = async (): Promise<void> => {
  await Promise.all(Array.from(enCurso));
};

export interface PeticionConversion {
  type: ConversionEventType;
  companyId: number;
  contactId: number | null;
  sourceType: ConversionSourceType;
  sourceId: number;
  occurredAt?: Date | null;
}

const jobIdDe = (log: ConversionEventLog, sufijo = ""): string =>
  `${log.companyId}:${log.eventId}${sufijo}`;

/**
 * Registra el evento y lo encola. Devuelve el registro, o null si la
 * empresa no usa Meta o si algo fallo. NUNCA lanza.
 */
export const encolarConversion = async (
  peticion: PeticionConversion
): Promise<ConversionEventLog | null> => {
  try {
    const config = await MetaConfig.findOne({
      where: { companyId: peticion.companyId },
      attributes: ["id", "isActive", "status"]
    });

    // Sin Meta activo no se guarda nada: ni eventos que nunca se enviaran.
    if (!config || !config.isActive) return null;

    const eventId = eventIdDe(peticion.type, peticion.sourceId);

    const [log, creado] = await ConversionEventLog.findOrCreate({
      where: { companyId: peticion.companyId, eventId },
      defaults: {
        companyId: peticion.companyId,
        eventId,
        eventType: peticion.type,
        contactId: peticion.contactId,
        sourceType: peticion.sourceType,
        sourceId: peticion.sourceId,
        occurredAt: peticion.occurredAt || new Date(),
        // Con las credenciales en error no se intenta: se guarda bloqueado y
        // se reencola cuando se corrijan.
        status: config.status === "error" ? "blocked" : "pending",
        attempts: 0
      } as any
    });

    // Ya estaba: es el MISMO hecho y no se vuelve a encolar. Meta no
    // deduplica los eventos de mensajeria, asi que esta es la deduplicacion.
    if (!creado) return log;

    if (log.status === "pending") {
      await encolador(log.id, jobIdDe(log));
    }

    return log;
  } catch (err) {
    logger.warn(
      `[MetaConversions] no se pudo encolar ${peticion.type} (${peticion.sourceType} ${peticion.sourceId}) de la empresa ${peticion.companyId}: ${err?.message}`
    );
    return null;
  }
};

/** Encola sin esperar. Para disparadores que no deben retrasar nada. */
export const dispararConversion = (peticion: PeticionConversion): void => {
  const promesa = encolarConversion(peticion).catch(() => null);
  enCurso.add(promesa);
  promesa.then(() => enCurso.delete(promesa));
};

/** Un mensaje mas viejo que esto (historial importado) no es un lead de hoy. */
const LEAD_RECIENTE_MS = 24 * 60 * 60 * 1000;

/**
 * ¿Se creo el contacto en esta misma llamada? Para los canales cuyo
 * servicio de contactos no dice si creo o encontro: se toma la hora antes
 * de llamarlo y se compara con la de creacion.
 */
export const contactoCreadoDesde = (contact: Contact | null, desde: number): boolean =>
  Boolean(contact?.createdAt) && new Date(contact.createdAt).getTime() >= desde - 1000;

/**
 * Lead: un contacto NUEVO que escribio primero.
 *
 * Quien llama garantiza que el mensaje es entrante y que el contacto se
 * acaba de crear; aqui se descartan grupos y mensajes viejos. No se espera
 * ni lanza.
 */
export const registrarLeadEntrante = (
  contact: Contact | null,
  opciones: { mensajeEn?: Date | number | null } = {}
): void => {
  try {
    if (!contact || contact.isGroup) return;

    if (opciones.mensajeEn) {
      const cuando = new Date(opciones.mensajeEn).getTime();
      if (Number.isFinite(cuando) && Date.now() - cuando > LEAD_RECIENTE_MS) return;
    }

    dispararConversion({
      type: "Lead",
      companyId: contact.companyId,
      contactId: contact.id,
      sourceType: "contact",
      sourceId: contact.id,
      occurredAt: contact.createdAt ? new Date(contact.createdAt) : new Date()
    });
  } catch (err) {
    logger.warn(`[MetaConversions] no se pudo registrar el lead del contacto ${contact?.id}: ${err?.message}`);
  }
};

/**
 * Ejecuta tras confirmar la transaccion, si la hay: un evento de una venta
 * que luego se deshace no debe salir. Nunca lanza.
 */
const trasConfirmar = (options: any, accion: () => void): void => {
  try {
    const transaccion = options?.transaction;
    if (transaccion && typeof transaccion.afterCommit === "function") {
      transaccion.afterCommit(() => accion());
    } else {
      accion();
    }
  } catch (err) {
    logger.warn(`[MetaConversions] listener: ${err?.message}`);
  }
};

let listenersRegistrados = false;

/**
 * Cuelga los disparadores de cita y venta de sus modelos.
 *
 * Hooks de modelo y no llamadas dentro de los servicios: asi ninguna linea
 * de Meta vive en SaleServices ni en AppointmentServices, y cualquier
 * camino que cree una venta o una cita queda cubierto. Los hooks son
 * sincronos y no devuelven promesa: Sequelize espera a los hooks, y uno que
 * fallara tumbaria la creacion.
 */
export const registrarListenersDeConversion = (): void => {
  if (listenersRegistrados) return;
  listenersRegistrados = true;

  (Sale as any).addHook("afterCreate", "metaConversionsPurchase", (sale: Sale, options: any) => {
    trasConfirmar(options, () =>
      dispararConversion({
        type: "Purchase",
        companyId: sale.companyId,
        contactId: sale.contactId,
        sourceType: "sale",
        sourceId: sale.id,
        occurredAt: sale.createdAt
      })
    );
  });

  (Appointment as any).addHook(
    "afterCreate",
    "metaConversionsSchedule",
    (cita: Appointment, options: any) => {
      // Las traidas de Google Calendar no son citas agendadas en el CRM, y
      // pueden no tener contacto.
      if ((cita.origin && cita.origin !== "crm") || !cita.contactId) return;
      trasConfirmar(options, () =>
        dispararConversion({
          type: "Schedule",
          companyId: cita.companyId,
          contactId: cita.contactId,
          sourceType: "appointment",
          sourceId: cita.id,
          occurredAt: cita.createdAt
        })
      );
    }
  );
};

/**
 * Tras corregir las credenciales: vuelve a encolar lo bloqueado que Meta
 * aun admitiria (7 dias) y marca como caducado lo demas. Devuelve cuantos
 * se reencolaron.
 */
export const reencolarBloqueados = async (companyId: number): Promise<number> => {
  const limite = new Date(Date.now() - SIETE_DIAS_MS);

  await ConversionEventLog.update(
    { status: "expired", lastError: "caducado: Meta no admite eventos de mas de 7 dias" } as any,
    { where: { companyId, status: "blocked", occurredAt: { [Op.lt]: limite } } }
  );

  const bloqueados = await ConversionEventLog.findAll({
    where: { companyId, status: "blocked", occurredAt: { [Op.gte]: limite } },
    order: [["occurredAt", "ASC"]],
    limit: 1000
  });

  let reencolados = 0;
  for (const log of bloqueados) {
    try {
      await log.update({ status: "pending" });
      // jobId distinto: el trabajo anterior del mismo evento puede seguir en
      // la lista de Bull y bloquearia uno con el mismo id.
      await encolador(log.id, jobIdDe(log, `:r${Date.now()}`));
      reencolados++;
    } catch (err) {
      logger.warn(`[MetaConversions] no se pudo reencolar el evento ${log.id}: ${err?.message}`);
    }
  }

  return reencolados;
};
