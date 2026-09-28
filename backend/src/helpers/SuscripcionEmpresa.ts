import moment, { Moment } from "moment";

/**
 * Prueba gratuita, suscripcion y dia de cobro.
 *
 * Antes de esto el sistema tenia un solo campo, dueDate, haciendo dos
 * trabajos a la vez: fin de prueba para las empresas con un plan marcado
 * como trial, y fecha de cobro para las demas. De ahi salia que la fecha de
 * alta acabara usandose como fecha de cobro, que es justo lo que no debe
 * pasar: darse de alta no es contratar.
 *
 * Aqui quedan separados los dos momentos —cuando empieza la prueba y cuando
 * se contrata de verdad— y el calculo del dia de cobro. Sin base de datos,
 * para poder probarse caso por caso.
 */

/**
 * Siempre 7 dias, para toda empresa nueva.
 *
 * A proposito NO se lee Plan.trialDays: el plan elegido decide los limites
 * y las funciones, no cuanto dura la prueba. Que dependiera del plan era lo
 * que hacia que dos empresas dadas de alta el mismo dia tuvieran pruebas de
 * distinta duracion sin que nadie lo hubiera decidido.
 */
export const DIAS_DE_PRUEBA = 7;

export type EstadoSuscripcion =
  | "trial"
  | "pending_payment"
  | "active"
  | "expired";

/**
 * Lleva una fecha a dia UTC en YYYY-MM-DD, venga como venga.
 *
 * Se cuenta por dia natural y en UTC porque es exactamente lo que ya hace
 * CompanyAccessPolicy para decidir si una prueba vencio. Si el banner
 * contara los dias de otra manera, habria un dia en el que el aviso y el
 * acceso dirian cosas distintas.
 */
export const diaUTC = (valor: unknown): string | null => {
  if (valor === null || valor === undefined || valor === "") return null;

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime())
      ? null
      : valor.toISOString().slice(0, 10);
  }

  if (moment.isMoment(valor)) {
    return valor.isValid() ? valor.toDate().toISOString().slice(0, 10) : null;
  }

  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);

  const fecha = moment(texto, moment.ISO_8601, true);
  return fecha.isValid() ? fecha.toDate().toISOString().slice(0, 10) : null;
};

/** Diferencia en dias naturales entre dos dias YYYY-MM-DD. */
const diasEntre = (desde: string, hasta: string): number =>
  moment.utc(hasta, "YYYY-MM-DD").diff(moment.utc(desde, "YYYY-MM-DD"), "days");

export interface InicioDePrueba {
  trialStartAt: Date;
  trialEndsAt: Date;
  subscriptionStatus: EstadoSuscripcion;
  subscribedAt: null;
  billingDayOfMonth: null;
  dueDate: null;
  recurrence: string;
}

/**
 * Los valores con los que nace una empresa nueva.
 *
 * dueDate nace NULO a proposito. Antes el alta escribia siempre una fecha
 * —hoy mas tres dias, incluso con un plan de pago—, y esa fecha entraba
 * directa en la facturacion como si hubiera algo que cobrar.
 */
export const iniciarPrueba = (ahora: Date = new Date()): InicioDePrueba => {
  const inicio = new Date(ahora.getTime());
  const fin = new Date(ahora.getTime());
  fin.setUTCDate(fin.getUTCDate() + DIAS_DE_PRUEBA);

  return {
    trialStartAt: inicio,
    trialEndsAt: fin,
    subscriptionStatus: "trial",
    subscribedAt: null,
    billingDayOfMonth: null,
    dueDate: null,
    recurrence: "monthly"
  };
};

/**
 * Dias naturales que le quedan a la prueba.
 *
 * 7..1 son dias por delante, 0 es "termina hoy" y negativo es terminada.
 * El cero todavia tiene acceso, igual que en CompanyAccessPolicy: se vence
 * AL TERMINAR el dia indicado.
 *
 * Devuelve null si no hay fecha que contar, que aguas arriba significa
 * "esta empresa no esta en el regimen de prueba" y nunca "se acabo".
 */
export const diasDePruebaRestantes = (
  trialEndsAt: unknown,
  ahora: Date = new Date()
): number | null => {
  const fin = diaUTC(trialEndsAt);
  if (!fin) return null;

  const hoy = diaUTC(ahora);
  if (!hoy) return null;

  return diasEntre(hoy, fin);
};

/** Si la empresa esta dentro de su prueba gratuita ahora mismo. */
export const enPrueba = (
  subscriptionStatus: unknown,
  trialEndsAt: unknown,
  ahora: Date = new Date()
): boolean => {
  if (subscriptionStatus !== "trial") return false;

  const restantes = diasDePruebaRestantes(trialEndsAt, ahora);
  return restantes !== null && restantes >= 0;
};

/** Si la prueba estaba en curso y ya se le paso el plazo. */
export const pruebaAgotada = (
  subscriptionStatus: unknown,
  trialEndsAt: unknown,
  ahora: Date = new Date()
): boolean => {
  if (subscriptionStatus !== "trial") return false;

  const restantes = diasDePruebaRestantes(trialEndsAt, ahora);
  return restantes !== null && restantes < 0;
};

/**
 * Si la facturacion debe dejar en paz a esta empresa.
 *
 * Durante la prueba no se cobra, no se emite factura, no se actualiza
 * ninguna, no se considera vencida y no se desactiva. Y una prueba agotada
 * sin plan contratado tampoco se factura: no llego a contratar nada.
 */
export const facturacionEnEspera = (subscriptionStatus: unknown): boolean =>
  subscriptionStatus === "trial" || subscriptionStatus === "expired";

/**
 * El cobro que toca en un mes concreto, respetando el dia pretendido.
 *
 * @param dia el dia de cobro ORIGINAL, no el del ultimo cobro
 */
export const cobroDelMes = (
  ano: number,
  mes: number,
  dia: number
): Moment => {
  const diasDelMes = moment.utc({ year: ano, month: mes, day: 1 }).daysInMonth();

  return moment.utc({
    year: ano,
    month: mes,
    day: Math.min(dia, diasDelMes)
  }).startOf("day");
};

/**
 * El siguiente cobro, un mes de calendario despues.
 *
 * No son "+30 dias": sumar treinta dias desplaza el dia de cobro un poco
 * cada mes, y en un ano lo ha movido casi una semana. Se avanza de mes y se
 * recoloca el dia ORIGINAL, que es lo que permite que un cobro dia 31 pase
 * por el 28 de febrero y vuelva al 31 en marzo, en vez de quedarse en 28
 * para siempre.
 */
export const proximoCobro = (desde: unknown, diaDeCobro: number): Moment => {
  const base = moment.utc(diaUTC(desde), "YYYY-MM-DD", true);
  const siguiente = base.clone().add(1, "month");

  return cobroDelMes(siguiente.year(), siguiente.month(), diaDeCobro);
};

export interface AltaDeSuscripcion {
  subscribedAt: Date;
  billingDayOfMonth: number;
  subscriptionStatus: EstadoSuscripcion;
  dueDate: string;
  recurrence: string;
}

/**
 * Los valores con los que arranca una suscripcion de verdad.
 *
 * Queda en pending_payment, nunca en active: que alguien pulse un boton no
 * es que haya pagado. Solo una pasarela real puede mover ese estado.
 */
export const activarSuscripcion = (
  ahora: Date = new Date()
): AltaDeSuscripcion => {
  const hoy = diaUTC(ahora) as string;
  const dia = moment.utc(hoy, "YYYY-MM-DD").date();

  return {
    subscribedAt: new Date(ahora.getTime()),
    billingDayOfMonth: dia,
    subscriptionStatus: "pending_payment",
    dueDate: proximoCobro(hoy, dia).format("YYYY-MM-DD"),
    recurrence: "monthly"
  };
};

export default {
  DIAS_DE_PRUEBA,
  activarSuscripcion,
  cobroDelMes,
  diaUTC,
  diasDePruebaRestantes,
  enPrueba,
  facturacionEnEspera,
  iniciarPrueba,
  proximoCobro,
  pruebaAgotada
};
