import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import { activarSuscripcion } from "../../helpers/SuscripcionEmpresa";

interface Peticion {
  companyId: number;
  /** Lo UNICO que llega del cliente. */
  planId: number;
  ahora?: Date;
}

/**
 * Contrata un plan para la empresa.
 *
 * Del cliente se acepta un identificador de plan y nada mas. El precio, los
 * limites, las fechas y el estado salen todos de la base: si se aceptaran
 * del navegador, cualquiera podria contratar el plan caro al precio del
 * barato, o regalarse una prueba eterna cambiando trialEndsAt desde las
 * herramientas de desarrollo.
 *
 * El plan tiene que estar OFRECIDO. Es la misma comprobacion que ya hace el
 * registro publico y por el mismo motivo: que el desplegable solo muestre
 * los publicos es una comodidad de la pantalla, no una defensa, porque la
 * peticion se puede hacer a mano con cualquier identificador.
 *
 * Queda en pending_payment, nunca en active. Pulsar un boton no es pagar, y
 * solo una pasarela real puede mover ese estado.
 */
const ActivarSuscripcionService = async ({
  companyId,
  planId,
  ahora = new Date()
}: Peticion): Promise<Company> => {
  const company = await Company.findByPk(companyId);

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const plan = await Plan.findByPk(planId);

  if (!plan || plan.isPublic !== true) {
    throw new AppError("ERR_INVALID_PLAN", 400);
  }

  // Cambiar de plan con una suscripcion ya en marcha no reabre el ciclo de
  // cobro: se cambia el plan y se respetan subscribedAt, el dia de cobro y
  // el vencimiento vigentes. Mover la fecha aqui seria regalar o cobrar de
  // mas un mes segun el dia en que alguien pulse el boton, y el prorrateo
  // es una decision de negocio que todavia no esta tomada.
  const yaSuscrita =
    company.subscriptionStatus === "pending_payment" ||
    company.subscriptionStatus === "active";

  if (yaSuscrita) {
    await company.update({ planId: plan.id });
    await company.reload({ include: [{ model: Plan, as: "plan" }] });
    return company;
  }

  const alta = activarSuscripcion(ahora);

  await company.update({
    planId: plan.id,
    subscribedAt: alta.subscribedAt,
    billingDayOfMonth: alta.billingDayOfMonth,
    subscriptionStatus: alta.subscriptionStatus,
    dueDate: alta.dueDate,
    recurrence: alta.recurrence
  });

  await company.reload({ include: [{ model: Plan, as: "plan" }] });

  return company;
};

export default ActivarSuscripcionService;
