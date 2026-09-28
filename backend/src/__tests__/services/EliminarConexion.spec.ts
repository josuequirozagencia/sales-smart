import Company from "../../models/Company";
import Whatsapp from "../../models/Whatsapp";
import GhlConfig from "../../models/GhlConfig";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { closeConnection, uniqueSuffix } from "../helpers/db";

// Borrado de una conexion, por canal.
//
// Esto existe por un fallo concreto: el borrado era una lista de "if" por
// canal y el que no estaba en la lista no se borraba —la API respondia 200 y
// la conexion seguia en su sitio—. Le pasaba a GoHighLevel. Lo que se prueba
// aqui es sobre todo que el caso por defecto BORRA.

jest.mock("../../services/BaileysServices/DeleteBaileysService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../libs/wbot", () => ({ removeWbot: jest.fn() }));
jest.mock("../../libs/cache", () => ({
  __esModule: true,
  default: { delFromPattern: jest.fn() }
}));
const retirarEnApiOficial = jest.fn();
jest.mock("../../libs/whatsAppOficial/whatsAppOficial.service", () => ({
  DeleteConnectionWhatsAppOficial: (...args: any[]) => retirarEnApiOficial(...args)
}));

// eslint-disable-next-line import/first
import { eliminarConexion } from "../../services/WhatsappService/EliminarConexionService";

let empresa: Company;
let otraEmpresa: Company;

const crearConfigGhl = async (companyId: number) =>
  GhlConfig.create({
    companyId,
    token: `cifrado-${uniqueSuffix()}`,
    locationId: `loc-${uniqueSuffix()}`,
    webhookSecret: `secreto-${uniqueSuffix()}`,
    workflows: "[]",
    isActive: true
  } as any);

const crearConexion = async (channel: string, extra: any = {}) =>
  Whatsapp.create({
    name: `${channel}-${uniqueSuffix()}`,
    status: "CONNECTED",
    companyId: empresa.id,
    channel,
    ...extra
  } as any);

beforeAll(async () => {
  empresa = await Company.create({
    name: `conexiones-${uniqueSuffix()}`,
    planId: 1,
    status: true
  } as any);

  otraEmpresa = await Company.create({
    name: `conexiones-ajena-${uniqueSuffix()}`,
    planId: 1,
    status: true
  } as any);
});

afterAll(async () => {
  const empresas = [empresa.id, otraEmpresa.id];

  await Ticket.destroy({ where: { companyId: empresas } });
  await Contact.destroy({ where: { companyId: empresas } });
  await GhlConfig.destroy({ where: { companyId: empresas } });
  await Whatsapp.destroy({ where: { companyId: empresas } });
  await Company.destroy({ where: { id: empresas } });
  await closeConnection();
});

describe("eliminarConexion", () => {
  it("borra una conexion de GoHighLevel", async () => {
    const conexion = await crearConexion("ghl");

    const borradas = await eliminarConexion(conexion);

    expect(borradas).toEqual([conexion.id]);
    expect(await Whatsapp.findByPk(conexion.id)).toBeNull();
  });

  it("borra un canal que no conoce, en vez de no hacer nada", async () => {
    // La red de seguridad: si manana entra un canal nuevo, se puede eliminar
    // sin tocar este servicio.
    const conexion = await crearConexion("canal_inventado");

    await eliminarConexion(conexion);

    expect(await Whatsapp.findByPk(conexion.id)).toBeNull();
  });

  it("borra la conexion oficial aunque la API de Meta falle", async () => {
    retirarEnApiOficial.mockRejectedValueOnce(new Error("Meta caida"));
    const conexion = await crearConexion("whatsapp_oficial", {
      waba_webhook_id: 123
    });

    await eliminarConexion(conexion);

    expect(retirarEnApiOficial).toHaveBeenCalledWith(123);
    expect(await Whatsapp.findByPk(conexion.id)).toBeNull();
  });

  it("se lleva las conexiones hermanas de Facebook e Instagram", async () => {
    const token = `tok-${uniqueSuffix()}`;
    const pagina = await crearConexion("facebook", { facebookUserToken: token });
    const insta = await crearConexion("instagram", { facebookUserToken: token });
    const ajena = await crearConexion("facebook", {
      facebookUserToken: `otro-${uniqueSuffix()}`
    });

    const borradas = await eliminarConexion(pagina);

    expect(borradas.sort()).toEqual([pagina.id, insta.id].sort());
    expect(await Whatsapp.findByPk(insta.id)).toBeNull();
    // La de otro token no se toca.
    expect(await Whatsapp.findByPk(ajena.id)).not.toBeNull();
  });

  it("limpia la sesion al borrar una de WhatsApp", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { removeWbot } = require("../../libs/wbot");
    const conexion = await crearConexion("whatsapp");

    await eliminarConexion(conexion);

    expect(removeWbot).toHaveBeenCalledWith(conexion.id);
    expect(await Whatsapp.findByPk(conexion.id)).toBeNull();
  });
});

// Borrar una conexion de GoHighLevel tiene que ser una desconexion de verdad.
// Antes solo se iba la fila de Whatsapp y el Private Integration Token seguia
// cifrado en GhlConfig: bastaba con reactivar la conexion para que el canal
// volviera a funcionar sin que nadie hubiera vuelto a pegar el token.
describe("eliminarConexion con GoHighLevel", () => {
  // Cada prueba parte de cero: la configuracion es una fila por empresa y el
  // recuento de conexiones hermanas decide si se borra, asi que un resto de
  // la prueba anterior cambiaria el resultado de la siguiente.
  beforeEach(async () => {
    const empresas = [empresa.id, otraEmpresa.id];

    await GhlConfig.destroy({ where: { companyId: empresas } });
    await Whatsapp.destroy({ where: { companyId: empresas, channel: "ghl" } });
  });

  it("se lleva el token guardado, no solo la conexion", async () => {
    await crearConfigGhl(empresa.id);
    const conexion = await crearConexion("ghl");

    await eliminarConexion(conexion);

    expect(await Whatsapp.findByPk(conexion.id)).toBeNull();
    expect(
      await GhlConfig.findOne({ where: { companyId: empresa.id } })
    ).toBeNull();
  });

  it("conserva la configuracion mientras quede otra conexion de GoHighLevel", async () => {
    // El limite de conexiones es por canal y por plan, asi que una empresa
    // puede tener varias de GHL compartiendo la misma configuracion. Borrar
    // una no puede dejar sin token a las que siguen.
    await crearConfigGhl(empresa.id);
    const primera = await crearConexion("ghl");
    const segunda = await crearConexion("ghl");

    await eliminarConexion(primera);

    expect(await Whatsapp.findByPk(segunda.id)).not.toBeNull();
    expect(
      await GhlConfig.findOne({ where: { companyId: empresa.id } })
    ).not.toBeNull();

    // Y al irse la ultima, ahora si.
    await eliminarConexion(segunda);

    expect(
      await GhlConfig.findOne({ where: { companyId: empresa.id } })
    ).toBeNull();
  });

  it("no toca la configuracion de otra empresa", async () => {
    await crearConfigGhl(empresa.id);
    await crearConfigGhl(otraEmpresa.id);
    const conexion = await crearConexion("ghl");

    await eliminarConexion(conexion);

    expect(
      await GhlConfig.findOne({ where: { companyId: otraEmpresa.id } })
    ).not.toBeNull();
  });

  it("no borra la configuracion al eliminar una conexion de otro canal", async () => {
    await crearConfigGhl(empresa.id);
    const conexion = await crearConexion("whatsapp");

    await eliminarConexion(conexion);

    expect(
      await GhlConfig.findOne({ where: { companyId: empresa.id } })
    ).not.toBeNull();
  });

  it("deja intacto el historial de conversacion", async () => {
    // El token es configuracion y se va; los tickets y contactos son lo que
    // de verdad hablaron los clientes, y se quedan.
    await crearConfigGhl(empresa.id);
    const conexion = await crearConexion("ghl");
    const contacto = await Contact.create({
      name: `ghl-${uniqueSuffix()}`,
      number: `593${uniqueSuffix()}`.slice(0, 12),
      companyId: empresa.id
    } as any);
    const ticket = await Ticket.create({
      status: "closed",
      companyId: empresa.id,
      contactId: contacto.id,
      whatsappId: conexion.id,
      isGroup: false
    } as any);

    await eliminarConexion(conexion);

    expect(await Contact.findByPk(contacto.id)).not.toBeNull();
    expect(await Ticket.findByPk(ticket.id)).not.toBeNull();
  });
});
