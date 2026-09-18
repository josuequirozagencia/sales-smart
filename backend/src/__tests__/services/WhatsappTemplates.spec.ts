import Company from "../../models/Company";
import Whatsapp from "../../models/Whatsapp";
import ListTemplatesService from "../../services/WhatsappService/ListTemplatesService";
import { getTemplatesWhatsAppOficial } from "../../libs/whatsAppOficial/whatsAppOficial.service";
import { closeConnection, getSeededCompany, uniqueSuffix } from "../helpers/db";

// api_oficial es otro servicio: aqui se sustituye su cliente y se comprueba lo
// que hace el backend con lo que devuelve.
jest.mock("../../libs/whatsAppOficial/whatsAppOficial.service", () => ({
  getTemplatesWhatsAppOficial: jest.fn()
}));
const apiOficial = getTemplatesWhatsAppOficial as jest.Mock;

// Plantillas de WhatsApp en solo lectura (catalogo real de Meta):
//  - se devuelven tal cual las da Meta;
//  - solo de conexiones de la empresa de quien pregunta;
//  - las conexiones por QR no tienen plantillas y se dice claramente.

const COMPANY_A = 1;
let empresaB: Company;
const conexiones: Whatsapp[] = [];

const crearConexion = async (companyId: number, channel: string, token = "") => {
  const w = await Whatsapp.create({
    name: `plantillas-${channel}-${uniqueSuffix()}`,
    channel,
    companyId,
    status: "CONNECTED",
    isDefault: false,
    token
  } as any);
  conexiones.push(w);
  return w;
};

beforeAll(async () => {
  await getSeededCompany();
  empresaB = await Company.create({ name: `plantillas-b-${uniqueSuffix()}`, planId: 1, status: true } as any);
});

beforeEach(() => apiOficial.mockReset());

afterAll(async () => {
  await Whatsapp.destroy({ where: { id: conexiones.map(c => c.id) } });
  await empresaB.destroy();
  await closeConnection();
});

describe("Plantillas de WhatsApp: conexiones directas (api_oficial)", () => {
  it("devuelve la lista tal cual la da Meta, pidiendola con el token de la conexion", async () => {
    const oficial = await crearConexion(COMPANY_A, "whatsapp_oficial", `tok-${uniqueSuffix()}`);
    const deMeta = {
      data: [
        { id: "1", name: "bienvenida", language: "es", status: "APPROVED", category: "MARKETING", components: [{ type: "BODY", text: "Hola {{1}}" }] }
      ],
      paging: { cursors: { before: "a", after: "b" } }
    };
    apiOficial.mockResolvedValue(deMeta);

    expect(await ListTemplatesService(oficial.id, COMPANY_A)).toEqual(deMeta);
    expect(apiOficial).toHaveBeenCalledWith(oficial.token);
  });

  it("una conexion de otra empresa no existe para quien pregunta", async () => {
    const ajena = await crearConexion(empresaB.id, "whatsapp_oficial", `tok-${uniqueSuffix()}`);
    await expect(ListTemplatesService(ajena.id, COMPANY_A)).rejects.toMatchObject({ message: "ERR_NO_WAPP_FOUND" });
    expect(apiOficial).not.toHaveBeenCalled();
  });

  it("una conexion por QR no tiene plantillas de Meta y lo dice sin llamar a api_oficial", async () => {
    const qr = await crearConexion(COMPANY_A, "whatsapp");
    await expect(ListTemplatesService(qr.id, COMPANY_A)).rejects.toMatchObject({ message: "ERR_TEMPLATES_CHANNEL_UNSUPPORTED" });
    expect(apiOficial).not.toHaveBeenCalled();
  });

  it("si api_oficial o Meta fallan, devuelve un error claro en vez de un 500", async () => {
    const oficial = await crearConexion(COMPANY_A, "whatsapp_oficial", `tok-${uniqueSuffix()}`);
    apiOficial.mockRejectedValue(new Error("Falha em listar os templates"));
    await expect(ListTemplatesService(oficial.id, COMPANY_A)).rejects.toMatchObject({ message: "ERR_TEMPLATES_UNAVAILABLE" });
  });
});
