import moment, { Moment } from "moment";

/**
 * Las decisiones de facturacion, fuera del cron.
 *
 * Todo esto vivia dentro de handleInvoiceCreate, en queues.ts: un cron que se
 * dispara cada 30 segundos y que ningun test puede importar, porque arrastra
 * Baileys, Redis y la base entera. Aqui quedan las preguntas que de verdad
 * deciden el resultado —cuanto vale el plan, si la fecha de vencimiento
 * sirve, y que hacer con ella— y por eso ahora se pueden probar.
 *
 * El defecto que motivo la extraccion: una empresa con dueDate en null daba
 * moment(null) -> "Invalid date". Como Invoices.dueDate es una columna de
 * texto, esa cadena se guardaba sin que la base protestara, y en la vuelta
 * siguiente no casaba con ninguna fecha, asi que la misma factura se
 * reescribia cada 30 segundos, para siempre.
 */

export const FORMATO_DIA = "DD/MM/YYYY";

/**
 * Margen en el que una fecha de cobro tiene sentido.
 *
 * No es decoracion: el formato ISO admite "0000" como ano, asi que una
 * cadena de cuatro digitos cualquiera se lee como el ano cero y sale con
 * setecientos mil dias de retraso. Eso entra directo por la puerta de
 * dias <= -3 y desactiva la empresa y le tira los WhatsApp por un dato que
 * nunca fue una fecha.
 */
const ANO_MINIMO = 2000;
const ANO_MAXIMO = 2100;

/**
 * Lee una fecha venga como venga: objeto Date de la base, ISO de los que
 * escribe este mismo cron, o el DD/MM/YYYY de las facturas antiguas.
 *
 * Se parsea en estricto a proposito: una fecha que se adivina mal es peor
 * que una que se rechaza.
 */
const fechaTolerante = (valor: unknown): Moment => {
  if (valor instanceof Date) return moment(valor);
  if (moment.isMoment(valor)) return valor.clone();

  const texto = String(valor).trim();

  const iso = moment(texto, moment.ISO_8601, true);
  if (iso.isValid()) return iso;

  return moment(texto, FORMATO_DIA, true);
};

export type ImporteDePlan =
  | { estado: "ok"; valor: string }
  | { estado: "error"; motivo: string };

/**
 * El importe que le toca a la factura.
 *
 * Antes esto calculaba bien el valor y acto seguido lo pisaba con "0.00" —la
 * asignacion estaba fuera del else al que pertenecia— de modo que TODAS las
 * facturas salian a cero. Ahora un importe que no se entiende no se
 * sustituye por nada: se devuelve invalido y quien llama decide, que en el
 * cron significa no emitir la factura.
 *
 * Se usa Number y no parseFloat porque parseFloat("15 euros") devuelve 15 tan
 * tranquilo, y ese es justo el silencio que hay que quitar de en medio
 * cuando se habla de dinero.
 *
 * Un plan gratis es un plan: amount "0" es valido y factura 0.00. Lo que no
 * vale es no tener importe.
 */
export const importeDePlan = (amount: unknown): ImporteDePlan => {
  if (amount === null || amount === undefined) {
    return { estado: "error", motivo: "el plan no tiene importe" };
  }

  const texto = String(amount).trim();

  if (texto === "") {
    return { estado: "error", motivo: "el importe del plan esta vacio" };
  }

  const numero = Number(texto.replace(",", "."));

  if (!Number.isFinite(numero)) {
    return {
      estado: "error",
      motivo: `el importe del plan no es un numero: ${texto}`
    };
  }

  if (numero < 0) {
    return {
      estado: "error",
      motivo: `el importe del plan es negativo: ${texto}`
    };
  }

  return { estado: "ok", valor: numero.toFixed(2) };
};

export type VencimientoDeEmpresa =
  | { estado: "ok"; fecha: Moment }
  | { estado: "error"; motivo: string };

/**
 * La fecha de vencimiento de la empresa, o el motivo por el que no sirve.
 */
export const vencimientoDeEmpresa = (
  dueDate: unknown
): VencimientoDeEmpresa => {
  if (dueDate === null || dueDate === undefined) {
    return {
      estado: "error",
      motivo: "la empresa no tiene fecha de vencimiento"
    };
  }

  if (typeof dueDate === "string" && dueDate.trim() === "") {
    return { estado: "error", motivo: "la fecha de vencimiento esta vacia" };
  }

  const fecha = fechaTolerante(dueDate);

  if (!fecha.isValid()) {
    return {
      estado: "error",
      motivo: `la fecha de vencimiento no es una fecha: ${String(dueDate)}`
    };
  }

  if (fecha.year() < ANO_MINIMO || fecha.year() > ANO_MAXIMO) {
    return {
      estado: "error",
      motivo: `la fecha de vencimiento esta fuera de rango: ${String(dueDate)}`
    };
  }

  return { estado: "ok", fecha };
};

/**
 * Dias enteros que faltan para el vencimiento; negativo si ya paso.
 *
 * Ambos extremos se llevan a medianoche, como hacia el codigo anterior al
 * comparar dos cadenas DD/MM/YYYY. La diferencia se pide en dias enteros en
 * vez de en milisegundos convertidos a dias: en el cambio de horario un dia
 * dura 23 horas y la division daba -2.95 donde corresponde -3.
 */
export const diasHastaVencimiento = (
  fecha: Moment,
  hoy: Moment = moment()
): number =>
  fecha.clone().startOf("day").diff(hoy.clone().startOf("day"), "days");

export type DecisionFacturacion =
  | { accion: "omitir"; motivo: string }
  | { accion: "desactivar"; dias: number; fecha: Moment }
  | { accion: "facturar"; dias: number; fecha: Moment };

/**
 * Que hacer con una empresa activa en esta vuelta del cron.
 *
 * La regla de negocio no cambia: a los 3 dias de impago la empresa se
 * desactiva. Lo que cambia es que ahora hace falta una fecha de verdad para
 * llegar ahi. Antes el camino era NaN <= -3, que da false por como se
 * comparan los NaN y no porque nadie lo hubiera decidido; bastaba con que esa
 * comparacion se escribiera al reves algun dia para desactivar empresas y
 * desconectar sus WhatsApp por un dato vacio.
 */
export const decidirFacturacion = (
  dueDate: unknown,
  hoy: Moment = moment()
): DecisionFacturacion => {
  const vencimiento = vencimientoDeEmpresa(dueDate);

  if (vencimiento.estado === "error") {
    return { accion: "omitir", motivo: vencimiento.motivo };
  }

  const dias = diasHastaVencimiento(vencimiento.fecha, hoy);

  if (dias <= -3) {
    return { accion: "desactivar", dias, fecha: vencimiento.fecha };
  }

  return { accion: "facturar", dias, fecha: vencimiento.fecha };
};

/**
 * Si la factura abierta ya lleva la fecha de vencimiento que toca.
 *
 * La comparacion anterior era de cadenas: se leia la fecha guardada con
 * DD/MM/YYYY estricto y se comparaba ya formateada. Pero lo que se guarda es
 * un ISO —lo escribe este mismo cron con moment().format()— y un ISO leido en
 * estricto como DD/MM/YYYY nunca es valido, asi que la respuesta era siempre
 * "no coincide" y la factura se actualizaba en cada vuelta, tuviera o no la
 * empresa una fecha correcta. Comparando por dia, con la fecha leida como lo
 * que es, coincide.
 */
export const mismaFecha = (guardada: unknown, vencimiento: Moment): boolean => {
  if (guardada === null || guardada === undefined) return false;

  const fecha = fechaTolerante(guardada);

  return fecha.isValid() && fecha.isSame(vencimiento, "day");
};

/**
 * Un aviso por clave cada tanto.
 *
 * El cron pasa cada 30 segundos. Sin esto, una sola empresa mal configurada
 * escribe 2.880 lineas de error al dia y entierra cualquier otra cosa que
 * pase en el log.
 */
export const crearAvisoEspaciado = (
  cadaMs: number
): ((clave: string, ahora?: number) => boolean) => {
  const ultimo = new Map<string, number>();

  return (clave: string, ahora: number = Date.now()): boolean => {
    const previo = ultimo.get(clave);

    if (previo !== undefined && ahora - previo < cadaMs) return false;

    ultimo.set(clave, ahora);
    return true;
  };
};

export interface DatosFactura {
  companyId: number;
  dueDate: string;
  detail: string;
  value: number;
  users: number;
  connections: number;
  queues: number;
  timestamp: string;
}

export interface Sentencia {
  sql: string;
  replacements: Record<string, unknown>;
}

/**
 * El INSERT de la factura, con todo lo dinamico fuera del SQL.
 *
 * Antes cada valor entraba por interpolacion de cadena. Un plan cuyo nombre
 * lleve una comilla cierra la cadena y rompe la sentencia —en el mejor de los
 * casos—, y el nombre del plan lo escribe quien administra la plataforma.
 */
export const sentenciaCrearFactura = (datos: DatosFactura): Sentencia => ({
  sql: `
    INSERT INTO "Invoices" (
      "companyId",
      "dueDate",
      detail,
      status,
      value,
      users,
      connections,
      queues,
      "updatedAt",
      "createdAt"
    )
    VALUES (
      :companyId,
      :dueDate,
      :detail,
      'open',
      :value,
      :users,
      :connections,
      :queues,
      :timestamp,
      :timestamp
    );
  `,
  replacements: { ...datos }
});

/**
 * El UPDATE que corrige la fecha de una factura abierta.
 */
export const sentenciaActualizarVencimiento = (
  id: number,
  dueDate: string
): Sentencia => ({
  sql: `UPDATE "Invoices" SET "dueDate" = :dueDate WHERE "id" = :id;`,
  replacements: { id, dueDate }
});

/**
 * Las facturas abiertas de una empresa.
 */
export const sentenciaFacturasAbiertas = (companyId: number): Sentencia => ({
  sql: `SELECT * FROM "Invoices" WHERE "companyId" = :companyId AND "status" = 'open';`,
  replacements: { companyId }
});
