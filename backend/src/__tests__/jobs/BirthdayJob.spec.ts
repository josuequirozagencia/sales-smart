import Company from "../../models/Company";
import BirthdaySettings from "../../models/BirthdaySettings";
import { closeConnection } from "../helpers/db";

// BirthdayService arrastra Baileys, que al importarse fuera de un navegador
// revienta con globalThis.crypto.subtle. Aqui no se usa: lo unico que se
// prueba del job es como calcula la hora.
jest.mock("../../libs/socket", () => ({ emitBirthdayEvents: jest.fn() }));
jest.mock("../../services/BirthdayService/BirthdayService", () => ({
  __esModule: true,
  default: {
    processTodayBirthdays: jest.fn(),
    getTodayBirthdaysForCompany: jest.fn(),
    sendBirthdayMessageToContact: jest.fn()
  }
}));

// eslint-disable-next-line import/first
import moment from "moment-timezone";
// eslint-disable-next-line import/first
import { horaDeEnvioAhora } from "../../jobs/BirthdayJob";

// El job de cumpleanos llevaba fallando cada 15 minutos, y nadie lo vio
// porque el mensaje del error se perdia por el camino: pino no imprime el
// segundo argumento de logger.error, asi que el log solo mostraba
// "Error in dynamic birthday job:" y nada detras.
//
// La causa era que Company no declaraba la asociacion hacia
// BirthdaySettings. Las asociaciones de Sequelize son direccionales:
// BirthdaySettings sabia de Company por su @BelongsTo, pero no al reves, y
// el include de Company reventaba con "BirthdaySettings is not associated
// to Company!" antes de mirar un solo dato.

afterAll(async () => {
  await closeConnection();
});

describe("la consulta que hace el job de cumpleanos", () => {
  it("puede incluir los ajustes de cumpleanos desde Company", async () => {
    // Es la consulta de startDynamicBirthdayJob, tal cual. No importa
    // cuantas empresas devuelva —lo normal es ninguna, porque casi nunca es
    // la hora exacta de envio—: lo que se prueba es que no revienta.
    const empresas = await Company.findAll({
      where: { status: true },
      include: [
        {
          model: BirthdaySettings,
          where: {
            sendBirthdayTime: "09:00:00",
            contactBirthdayEnabled: true
          },
          required: true
        }
      ]
    });

    expect(Array.isArray(empresas)).toBe(true);
  });

  it("deja leer los ajustes de una empresa a traves de la asociacion", async () => {
    // Sin required, el include tiene que seguir siendo valido: es la forma
    // en que cualquier pantalla pediria la empresa con sus ajustes.
    const empresas = await Company.findAll({
      include: [{ model: BirthdaySettings }],
      limit: 1
    });

    expect(Array.isArray(empresas)).toBe(true);
  });
});

// La otra mitad del arreglo. La hora de envio se comparaba contra
// new Date().getHours(), que da la hora del contenedor: en Railway no hay TZ
// definida, asi que era UTC mientras el cron declaraba Sao Paulo. Nadie lo
// habia notado porque la consulta reventaba antes de llegar a comparar.
describe("horaDeEnvioAhora", () => {
  it("mide la hora en el huso del cron, no en el del contenedor", () => {
    // Las 12:00 UTC son las 09:00 en Sao Paulo. getHours() habria dicho 12,
    // y un envio configurado a las 09:00 no habria salido nunca a su hora.
    expect(horaDeEnvioAhora(moment.utc("2026-09-28T12:00:00Z"))).toBe(
      "09:00:00"
    );
  });

  it("deja los segundos a cero, como se guarda sendBirthdayTime", () => {
    expect(horaDeEnvioAhora(moment.utc("2026-09-28T12:34:56Z"))).toBe(
      "09:34:00"
    );
  });

  it("no modifica el momento que recibe", () => {
    const original = moment.utc("2026-09-28T12:00:00Z");

    horaDeEnvioAhora(original);

    expect(original.utcOffset()).toBe(0);
  });
});
