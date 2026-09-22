import Company from "../../models/Company";
import Whatsapp from "../../models/Whatsapp";
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
});

afterAll(async () => {
  await Whatsapp.destroy({ where: { companyId: empresa.id } });
  await Company.destroy({ where: { id: empresa.id } });
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
