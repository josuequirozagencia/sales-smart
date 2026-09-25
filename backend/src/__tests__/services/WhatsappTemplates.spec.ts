import http from "http";
import { AddressInfo } from "net";
import Company from "../../models/Company";
import GhlConfig from "../../models/GhlConfig";
import { guardarConfiguracion, verConfiguracion } from "../../services/GhlServices/GhlConfigService";
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

// ---------------------------------------------------------------------------
describe("Plantillas de WhatsApp: conexiones de GoHighLevel (Graph API de Meta)", () => {
  let empresaGhl: Company;
  let conexionGhl: Whatsapp;
  let servidor: http.Server;
  let base = "";
  let peticiones: { ruta: string; auth: string }[] = [];
  let responder: (ruta: string) => { status?: number; json: any } = () => ({ json: { data: [] } });
  const TOKEN_META = "EAAG-token-de-meta-no-real-9876";

  beforeAll(async () => {
    servidor = http.createServer((req, res) => {
      peticiones.push({ ruta: req.url || "", auth: String(req.headers.authorization || "") });
      const { status = 200, json } = responder(req.url || "");
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    });
    await new Promise<void>(ok => servidor.listen(0, "127.0.0.1", () => ok()));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

    empresaGhl = await Company.create({ name: `plantillas-ghl-${uniqueSuffix()}`, planId: 1, status: true } as any);
    conexionGhl = await crearConexion(empresaGhl.id, "ghl");
    await guardarConfiguracion({ companyId: empresaGhl.id, token: "pit-ghl-no-real", locationId: "loc-1", isActive: true });
  });

  beforeEach(() => {
    peticiones = [];
  });

  afterAll(async () => {
    await GhlConfig.destroy({ where: { companyId: empresaGhl.id } });
    await Whatsapp.destroy({ where: { id: conexionGhl.id } });
    await empresaGhl.destroy();
    await new Promise<void>(ok => servidor.close(() => ok()));
  });

  it("sin credenciales de Meta lo dice, sin llamar a nadie", async () => {
    await expect(ListTemplatesService(conexionGhl.id, empresaGhl.id, { baseURLMeta: base })).rejects.toMatchObject({
      message: "ERR_TEMPLATES_GHL_META_NOT_CONFIGURED"
    });
    expect(peticiones).toHaveLength(0);
  });

  it("guarda el token cifrado y solo muestra sus 4 ultimos caracteres", async () => {
    await guardarConfiguracion({
      companyId: empresaGhl.id,
      locationId: "loc-1",
      isActive: true,
      metaBusinessId: "102030405060",
      metaAccessToken: TOKEN_META
    });
    const fila = await GhlConfig.findOne({ where: { companyId: empresaGhl.id } });
    expect(fila!.metaAccessToken).not.toContain(TOKEN_META);
    const vista = await verConfiguracion(empresaGhl.id);
    expect(JSON.stringify(vista)).not.toContain(TOKEN_META);
    expect(vista).toMatchObject({ metaBusinessId: "102030405060", tieneTokenMeta: true, metaTokenLast4: "9876" });
  });

  it("con credenciales lee las plantillas reales del Graph API y recorre todas las paginas", async () => {
    responder = ruta =>
      ruta.includes("after=pag2")
        ? { json: { data: [{ id: "2", name: "recordatorio", language: "es", status: "APPROVED", category: "UTILITY", components: [] }] } }
        : {
            json: {
              data: [{ id: "1", name: "bienvenida", language: "es", status: "APPROVED", category: "MARKETING", components: [] }],
              paging: { next: `${base}/102030405060/message_templates?limit=100&after=pag2` }
            }
          };

    const lista = await ListTemplatesService(conexionGhl.id, empresaGhl.id, { baseURLMeta: base });
    expect(lista.data.map(p => p.name)).toEqual(["bienvenida", "recordatorio"]);
    expect(peticiones[0].ruta).toBe("/102030405060/message_templates?limit=100");
    expect(peticiones.every(p => p.auth === `Bearer ${TOKEN_META}`)).toBe(true);
  });

  it("si Meta rechaza las credenciales, lo dice claramente", async () => {
    responder = () => ({ status: 401, json: { error: { message: "Invalid OAuth access token", type: "OAuthException" } } });
    await expect(ListTemplatesService(conexionGhl.id, empresaGhl.id, { baseURLMeta: base })).rejects.toMatchObject({
      message: "ERR_TEMPLATES_META_REJECTED"
    });
  });

  it("quitar las credenciales de Meta vuelve a dejarlo sin configurar, sin tocar el token de GHL", async () => {
    await guardarConfiguracion({ companyId: empresaGhl.id, locationId: "loc-1", isActive: true, quitarMeta: true });
    const vista = await verConfiguracion(empresaGhl.id);
    expect(vista).toMatchObject({ metaBusinessId: "", tieneTokenMeta: false, tieneToken: true });
  });
});
