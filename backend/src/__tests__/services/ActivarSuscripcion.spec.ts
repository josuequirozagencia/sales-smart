import Company from "../../models/Company";
import Plan from "../../models/Plan";
import ActivarSuscripcionService from "../../services/CompanyService/ActivarSuscripcionService";
import FindAllPlanService from "../../services/PlanService/FindAllPlanService";
import { closeConnection, uniqueSuffix } from "../helpers/db";

// Contratar un plan. Lo que se vigila aqui es la frontera con el cliente:
// del navegador solo puede llegar un identificador de plan, y todo lo que
// cuesta dinero —precio, fechas, estado— tiene que salir de la base.

// El dia UTC de una fecha, que es como la lee todo el sistema.
//
// Companies.dueDate es una columna DATE, asi que Sequelize la devuelve como
// objeto Date y String(fecha).slice(0, 10) da "Sun Nov 01" —el formato largo
// de JavaScript, y encima un dia antes por la zona horaria—. Es la misma
// trampa que CompanyAccessPolicy documenta en su cabecera.
const diaDe = (valor: unknown): string =>
  new Date(valor as any).toISOString().slice(0, 10);

let planPublico: Plan;
let planPrivado: Plan;
let empresa: Company;

const crearEmpresaEnPrueba = async (): Promise<Company> =>
  Company.create({
    name: `suscripcion-${uniqueSuffix()}`,
    planId: planPublico.id,
    status: true,
    trialStartAt: new Date("2026-09-28T15:00:00.000Z"),
    trialEndsAt: new Date("2026-10-05T15:00:00.000Z"),
    subscriptionStatus: "trial",
    dueDate: null,
    recurrence: "monthly"
  } as any);

beforeAll(async () => {
  const sufijo = uniqueSuffix();

  planPublico = await Plan.create({
    name: `PUBLICO-${sufijo}`,
    amount: "15",
    users: 2,
    connections: 3,
    queues: 5,
    isPublic: true
  } as any);

  planPrivado = await Plan.create({
    name: `PRIVADO-${sufijo}`,
    amount: "999",
    users: 99,
    connections: 99,
    queues: 99,
    isPublic: false
  } as any);
});

beforeEach(async () => {
  empresa = await crearEmpresaEnPrueba();
});

afterEach(async () => {
  await Company.destroy({ where: { id: empresa.id }, force: true });
});

afterAll(async () => {
  await Plan.destroy({ where: { id: [planPublico.id, planPrivado.id] } });
  await closeConnection();
});

describe("ActivarSuscripcionService", () => {
  it("contrata el plan y ancla el dia de cobro al dia de contratar", async () => {
    const resultado = await ActivarSuscripcionService({
      companyId: empresa.id,
      planId: planPublico.id,
      ahora: new Date("2026-10-02T09:30:00.000Z")
    });

    expect(resultado.planId).toBe(planPublico.id);
    expect(resultado.billingDayOfMonth).toBe(2);
    expect(diaDe(resultado.dueDate)).toBe("2026-11-02");
    expect(resultado.recurrence).toBe("monthly");

    // La fecha de suscripcion es la de contratar, NO la del alta.
    expect(resultado.subscribedAt).not.toBeNull();
    expect(new Date(resultado.subscribedAt).toISOString()).toBe(
      "2026-10-02T09:30:00.000Z"
    );
    expect(new Date(resultado.subscribedAt).toISOString()).not.toBe(
      new Date(resultado.createdAt).toISOString()
    );
  });

  it("queda pendiente de pago, nunca activa", async () => {
    const resultado = await ActivarSuscripcionService({
      companyId: empresa.id,
      planId: planPublico.id,
      ahora: new Date("2026-10-02T09:30:00.000Z")
    });

    expect(resultado.subscriptionStatus).toBe("pending_payment");
    expect(resultado.subscriptionStatus).not.toBe("active");
  });

  it("rechaza un plan que no esta ofrecido", async () => {
    // El selector solo ensena los publicos, pero eso es comodidad de la
    // pantalla: la peticion se puede hacer a mano con cualquier id.
    await expect(
      ActivarSuscripcionService({
        companyId: empresa.id,
        planId: planPrivado.id
      })
    ).rejects.toMatchObject({ message: "ERR_INVALID_PLAN" });

    const sinTocar = await Company.findByPk(empresa.id);
    expect(sinTocar.subscriptionStatus).toBe("trial");
    expect(sinTocar.planId).toBe(planPublico.id);
  });

  it("rechaza un plan inexistente", async () => {
    await expect(
      ActivarSuscripcionService({ companyId: empresa.id, planId: 99999999 })
    ).rejects.toMatchObject({ message: "ERR_INVALID_PLAN" });
  });

  it("no acepta precio, fechas ni estado que vengan de fuera", async () => {
    // Se cuela de todo en la peticion: nada de esto puede tener efecto.
    const intento: any = {
      companyId: empresa.id,
      planId: planPublico.id,
      ahora: new Date("2026-10-02T09:30:00.000Z"),
      amount: "0.01",
      value: 0,
      dueDate: "2099-12-31",
      trialEndsAt: "2099-12-31T00:00:00.000Z",
      subscriptionStatus: "active",
      billingDayOfMonth: 1
    };

    const resultado = await ActivarSuscripcionService(intento);

    expect(resultado.subscriptionStatus).toBe("pending_payment");
    expect(diaDe(resultado.dueDate)).toBe("2026-11-02");
    expect(resultado.billingDayOfMonth).toBe(2);
    expect(new Date(resultado.trialEndsAt).toISOString()).toBe(
      "2026-10-05T15:00:00.000Z"
    );

    // El precio se lee del plan en la base, no de la peticion.
    const plan = await Plan.findByPk(resultado.planId);
    expect(plan.amount).toBe("15");
  });

  it("cambiar de plan ya suscrita no reabre el ciclo de cobro", async () => {
    const primera = await ActivarSuscripcionService({
      companyId: empresa.id,
      planId: planPublico.id,
      ahora: new Date("2026-10-02T09:30:00.000Z")
    });

    const otroPublico = await Plan.create({
      name: `OTRO-${uniqueSuffix()}`,
      amount: "50",
      users: 8,
      connections: 5,
      queues: 5,
      isPublic: true
    } as any);

    try {
      const segunda = await ActivarSuscripcionService({
        companyId: empresa.id,
        planId: otroPublico.id,
        ahora: new Date("2026-10-20T09:30:00.000Z")
      });

      expect(segunda.planId).toBe(otroPublico.id);
      // Ni el dia de cobro ni el vencimiento se mueven: cambiar de plan a
      // mitad de mes no puede regalar ni cobrar de mas un periodo.
      expect(segunda.billingDayOfMonth).toBe(primera.billingDayOfMonth);
      expect(diaDe(segunda.dueDate)).toBe("2026-11-02");
    } finally {
      await Plan.destroy({ where: { id: otroPublico.id } });
    }
  });
});

describe("FindAllPlanService", () => {
  it("el catalogo publico no ensena los planes privados", async () => {
    // Antes una peticion anonima SIN parametros se llevaba el catalogo
    // entero, con los precios y los limites de los planes privados.
    const publicos = await FindAllPlanService();
    const ids = publicos.map(p => p.id);

    expect(ids).toContain(planPublico.id);
    expect(ids).not.toContain(planPrivado.id);
    expect(publicos.every(p => p.isPublic === true)).toBe(true);
  });
});
