import Company from "../../models/Company";
import CompaniesSettings from "../../models/CompaniesSettings";
import UpdateCompanySettingsService from "../../services/CompaniesSettings/UpdateCompanySettingService";
import FindCompanySettingOneService from "../../services/CompaniesSettings/FindCompanySettingOneService";
import { closeConnection, uniqueSuffix } from "../helpers/db";

// Ajustes de empresa: el nombre de la columna y el valor llegaban del
// navegador y se pegaban dentro del SQL. Aqui se comprueba que la columna pasa
// por lista blanca, que el valor se guarda literal (no se ejecuta) y que una
// empresa no puede tocar los ajustes de otra.

let empresaA: Company;
let empresaB: Company;

const crearEmpresa = async () => {
  const empresa = await Company.create({
    name: `ajustes-${uniqueSuffix()}`,
    planId: 1,
    status: true
  } as any);
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

const valor = async (companyId: number, columna: string) => {
  const fila = await CompaniesSettings.findOne({ where: { companyId } });
  return fila?.get(columna as any);
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

describe("UpdateCompanySettingsService", () => {
  it("guarda un ajuste normal", async () => {
    await UpdateCompanySettingsService({
      companyId: empresaA.id,
      column: "userRating",
      data: "enabled"
    });
    expect(await valor(empresaA.id, "userRating")).toBe("enabled");
  });

  it("rechaza una columna que no es de los ajustes", async () => {
    await expect(
      UpdateCompanySettingsService({
        companyId: empresaA.id,
        column: 'userRating" = \'x\', "chatBotType',
        data: "button"
      })
    ).rejects.toMatchObject({
      message: "ERR_COMPANY_SETTING_INVALID_COLUMN",
      statusCode: 400
    });
    expect(await valor(empresaA.id, "chatBotType")).toBe("text");
  });

  it("rechaza tocar la empresa o la clave", async () => {
    for (const columna of ["companyId", "id", "createdAt"]) {
      await expect(
        UpdateCompanySettingsService({ companyId: empresaA.id, column: columna, data: "1" })
      ).rejects.toMatchObject({ message: "ERR_COMPANY_SETTING_INVALID_COLUMN" });
    }
  });

  it("una comilla en el valor se guarda literal y no toca a la otra empresa", async () => {
    const intento = `x' WHERE "companyId" > 0; --`;
    await UpdateCompanySettingsService({
      companyId: empresaA.id,
      column: "lgpdMessage",
      data: intento
    });
    expect(await valor(empresaA.id, "lgpdMessage")).toBe(intento);
    expect(await valor(empresaB.id, "lgpdMessage")).toBe("");
  });

  it("convierte los booleanos en vez de guardar la cadena", async () => {
    await UpdateCompanySettingsService({
      companyId: empresaA.id,
      column: "closeTicketOnTransfer",
      data: "true"
    });
    expect(await valor(empresaA.id, "closeTicketOnTransfer")).toBe(true);

    await expect(
      UpdateCompanySettingsService({
        companyId: empresaA.id,
        column: "closeTicketOnTransfer",
        data: "quizas"
      })
    ).rejects.toMatchObject({ message: "ERR_COMPANY_SETTING_INVALID_VALUE" });
  });

  it("rechaza un valor sin enviar o que no es un dato simple", async () => {
    await expect(
      UpdateCompanySettingsService({ companyId: empresaA.id, column: "lgpdLink", data: undefined })
    ).rejects.toMatchObject({ message: "ERR_COMPANY_SETTING_INVALID_VALUE" });

    await expect(
      UpdateCompanySettingsService({ companyId: empresaA.id, column: "lgpdLink", data: { a: 1 } })
    ).rejects.toMatchObject({ message: "ERR_COMPANY_SETTING_INVALID_VALUE" });
  });
});

describe("FindCompanySettingOneService", () => {
  it("devuelve el ajuste de su empresa", async () => {
    const [fila] = await FindCompanySettingOneService({
      companyId: empresaB.id,
      column: "chatBotType"
    });
    expect(fila.chatBotType).toBe("text");
  });

  it("rechaza leer una columna inventada", async () => {
    await expect(
      FindCompanySettingOneService({ companyId: empresaB.id, column: "(SELECT passwordHash FROM Users)" })
    ).rejects.toMatchObject({
      message: "ERR_COMPANY_SETTING_INVALID_COLUMN",
      statusCode: 400
    });
  });

  it("una empresa sin fila de ajustes no revienta", async () => {
    const sinAjustes = await Company.create({
      name: `sin-ajustes-${uniqueSuffix()}`,
      planId: 1,
      status: true
    } as any);
    const [fila] = await FindCompanySettingOneService({
      companyId: sinAjustes.id,
      column: "showNotificationPending"
    });
    expect(fila.showNotificationPending).toBeNull();
    await Company.destroy({ where: { id: sinAjustes.id } });
  });
});
