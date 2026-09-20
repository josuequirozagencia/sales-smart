import Company from "../../models/Company";
import CompaniesSettings from "../../models/CompaniesSettings";
import {
  leerInactividad,
  guardarInactividad
} from "../../services/CompaniesSettings/SessionInactivityService";
import { opcionesCookieSesion } from "../../helpers/SendRefreshToken";
import { closeConnection, uniqueSuffix } from "../helpers/db";

// Cierre de sesion por inactividad: un limite por empresa, 5 h por defecto,
// entre 15 min y 24 h, y aislado por empresa.

let empresaA: Company;
let empresaB: Company;

const crearEmpresa = async () => {
  const empresa = await Company.create({
    name: `inactividad-${uniqueSuffix()}`,
    planId: 1,
    status: true
  } as any);
  // Los ajustes que crea CreateCompanyService al dar de alta una empresa.
  // Varias columnas son NOT NULL, asi que no vale con crear la fila vacia.
  // sessionInactivityMinutes se deja fuera a proposito: tiene que quedar en
  // su valor por defecto.
  await CompaniesSettings.create({
    companyId: empresa.id,
    hoursCloseTicketsAuto: "9999999999",
    chatBotType: "text",
    acceptCallWhatsapp: "enabled",
    userRandom: "enabled",
    sendGreetingMessageOneQueues: "enabled",
    sendSignMessage: "enabled",
    sendFarewellWaitingTicket: "disabled",
    userRating: "disabled",
    sendGreetingAccepted: "enabled",
    CheckMsgIsGroup: "enabled",
    sendQueuePosition: "disabled",
    scheduleType: "disabled",
    acceptAudioMessageContact: "enabled",
    sendMsgTransfTicket: "disabled",
    enableLGPD: "disabled",
    requiredTag: "disabled",
    lgpdDeleteMessage: "disabled",
    lgpdHideNumber: "disabled",
    lgpdConsent: "disabled",
    lgpdLink: "",
    lgpdMessage: "",
    closeTicketOnTransfer: false,
    DirectTicketsToWallets: false
  } as any);
  return empresa;
};

beforeAll(async () => {
  empresaA = await crearEmpresa();
  empresaB = await crearEmpresa();
});

afterAll(async () => {
  await CompaniesSettings.destroy({ where: { companyId: [empresaA.id, empresaB.id] } });
  await Company.destroy({ where: { id: [empresaA.id, empresaB.id] } });
  await closeConnection();
});

describe("SessionInactivityService", () => {
  it("una empresa sin ajuste propio tiene 5 horas", async () => {
    expect(await leerInactividad(empresaA.id)).toBe(300);
  });

  it("guarda el limite solo para su empresa", async () => {
    expect(await guardarInactividad(empresaA.id, 60)).toBe(60);
    expect(await leerInactividad(empresaA.id)).toBe(60);
    expect(await leerInactividad(empresaB.id)).toBe(300);
  });

  it("acepta el numero como texto", async () => {
    expect(await guardarInactividad(empresaB.id, "120")).toBe(120);
  });

  it.each([[14], [1441], [0], [-5], [90.5], ["abc"], [""], [null], [true], [undefined]])(
    "rechaza %p",
    async (valor) => {
      await expect(guardarInactividad(empresaA.id, valor)).rejects.toMatchObject({
        message: "ERR_SESSION_INACTIVITY_INVALID",
        statusCode: 400
      });
    }
  );

  it("un valor rechazado no cambia el guardado", async () => {
    await guardarInactividad(empresaA.id, 480);
    await expect(guardarInactividad(empresaA.id, 5)).rejects.toBeTruthy();
    expect(await leerInactividad(empresaA.id)).toBe(480);
  });
});

describe("opcionesCookieSesion", () => {
  const original = process.env.BACKEND_URL;
  afterEach(() => {
    process.env.BACKEND_URL = original;
  });

  it("con https la cookie viaja entre sitios distintos (frontend y backend en up.railway.app)", () => {
    process.env.BACKEND_URL = "https://backend-production-a79f9.up.railway.app";
    expect(opcionesCookieSesion()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      path: "/"
    });
  });

  it("en local (http) se queda como cookie del mismo sitio", () => {
    process.env.BACKEND_URL = "http://localhost";
    expect(opcionesCookieSesion()).toEqual({ httpOnly: true, sameSite: "lax", path: "/" });
  });
});
