import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import UpdateWhatsAppService from "../../services/WhatsappService/UpdateWhatsAppService";
import * as WhatsAppController from "../../controllers/WhatsAppController";
import canManageConnections, {
  puedeGestionarConexiones
} from "../../middleware/canManageConnections";
import { closeConnection, uniqueSuffix } from "../helpers/db";

// Credenciales de las conexiones (token, send_token, tokens de Facebook).
//
// Antes GET /whatsapp las devolvia a cualquier usuario, y tambien salian en
// los emits del socket y dentro de los tickets. Lo que aqui se prueba: no
// salen serializadas por ninguna de esas vias, el servidor las sigue leyendo,
// la ficha da `token` solo a quien gestiona conexiones, editar sin reenviar
// el token de Meta lo conserva, y solo quien gestiona conexiones escribe.
//
// Contra la base de pruebas (npm run test:setup).

// WhatsAppController arrastra Baileys, Redis y socket.io al importarse. La
// ficha (show) no usa nada de eso: se sustituye para poder cargar el
// controlador en Jest.
jest.mock("../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../libs/cache", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../libs/wbot", () => ({ removeWbot: jest.fn(), restartWbot: jest.fn() }));
jest.mock("../../services/BaileysServices/DeleteBaileysService", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../services/FacebookServices/graphAPI", () => ({}));
jest.mock("../../services/WbotServices/StartWhatsAppSession", () => ({ StartWhatsAppSession: jest.fn() }));
jest.mock("../../services/WhatsappService/ImportWhatsAppMessageService", () => ({ closeTicketsImported: jest.fn() }));
jest.mock("../../services/WhatsappService/CreateWhatsAppService", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../services/WhatsappService/DeleteWhatsAppService", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../services/QuickMessageService/CreateService", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../libs/whatsAppOficial/whatsAppOficial.service", () => ({}));

const COMPANY_ID = 1;
const SEND_TOKEN = "EAAtokenDeMetaDePrueba00001234";
const FB_TOKEN = "EAApaginaDeFacebook0000005678";

const creados = { whatsapps: [] as number[], users: [] as number[], contactos: [] as number[] };

const nuevaConexion = async (datos: Record<string, any> = {}): Promise<Whatsapp> => {
  const w = await Whatsapp.create({
    name: `Secretos ${uniqueSuffix()}`,
    companyId: COMPANY_ID,
    channel: "whatsapp_oficial",
    token: `tok${uniqueSuffix()}`,
    send_token: SEND_TOKEN,
    facebookUserToken: FB_TOKEN,
    tokenMeta: "tokenMetaSecreto",
    status: "CONNECTED",
    ...datos
  } as any);
  creados.whatsapps.push(w.id);
  return w;
};

const nuevoUsuario = async (datos: Record<string, any>): Promise<User> => {
  const u = await User.create({
    name: `secretos-${uniqueSuffix()}`,
    email: `secretos-${uniqueSuffix()}@prueba.local`,
    passwordHash: "x",
    companyId: COMPANY_ID,
    profile: "user",
    allowConnections: "disable",
    ...datos
  } as any);
  creados.users.push(u.id);
  return u;
};

const SECRETOS = ["token", "send_token", "facebookUserToken", "tokenMeta"];
const clavesSecretas = (plano: any) => SECRETOS.filter(k => plano && k in plano);
// Lo que recibe el cliente: res.json y socket.io serializan con JSON.stringify.
const comoCliente = (valor: any) => JSON.parse(JSON.stringify(valor));

const respuestaHttp = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

afterAll(async () => {
  await Ticket.destroy({ where: { contactId: creados.contactos } });
  await Contact.destroy({ where: { id: creados.contactos } });
  await Whatsapp.destroy({ where: { id: creados.whatsapps } });
  await User.destroy({ where: { id: creados.users } });
  await closeConnection();
});

describe("serializacion de la conexion", () => {
  it("toJSON no trae credenciales y dice si hay token de Meta y su final", async () => {
    const w = await nuevaConexion();
    const plano = comoCliente(w);

    expect(clavesSecretas(plano)).toEqual([]);
    expect(plano.tieneSendToken).toBe(true);
    expect(plano.sendTokenFinal).toBe("1234");
    expect(plano.name).toBe(w.name);
  });

  it("el servidor sigue leyendo las credenciales despues de serializar", async () => {
    const w = await nuevaConexion();
    comoCliente(w);

    expect(w.send_token).toBe(SEND_TOKEN);
    expect(w.facebookUserToken).toBe(FB_TOKEN);
    expect(w.get("token")).toMatch(/^tok/);

    const releida = await Whatsapp.findByPk(w.id);
    expect(releida.send_token).toBe(SEND_TOKEN);
  });

  it("sin token de Meta, tieneSendToken es false", async () => {
    const w = await nuevaConexion({ send_token: null });
    expect(comoCliente(w).tieneSendToken).toBe(false);
    expect(comoCliente(w).sendTokenFinal).toBeNull();
  });

  it("los emits del socket ({ action, whatsapp }) salen sin credenciales", async () => {
    const w = await nuevaConexion();
    const emit = comoCliente({ action: "update", whatsapp: w });
    expect(clavesSecretas(emit.whatsapp)).toEqual([]);
  });

  it("una lista de conexiones sale sin credenciales", async () => {
    await nuevaConexion();
    const lista = await Whatsapp.findAll({ where: { companyId: COMPANY_ID } });
    comoCliente(lista).forEach((w: any) => expect(clavesSecretas(w)).toEqual([]));
  });

  it("la conexion incluida en un ticket sale sin credenciales aunque se pidan en attributes", async () => {
    const w = await nuevaConexion();
    const contacto = await Contact.create({
      name: `secretos-${uniqueSuffix()}`,
      number: `59390${String(Date.now()).slice(-7)}`,
      companyId: COMPANY_ID
    } as any);
    creados.contactos.push(contacto.id);
    const creado = await Ticket.create({
      status: "pending",
      companyId: COMPANY_ID,
      contactId: contacto.id,
      whatsappId: w.id
    } as any);

    // Los mismos attributes que ShowTicketService, que necesita token y
    // facebookUserToken para enviar.
    const ticket = await Ticket.findByPk(creado.id, {
      include: [
        {
          model: Whatsapp,
          as: "whatsapp",
          attributes: ["id", "name", "facebookUserToken", "token", "channel"]
        }
      ]
    });

    expect(ticket.whatsapp.token).toBe(w.token);
    expect(ticket.whatsapp.facebookUserToken).toBe(FB_TOKEN);
    const plano = comoCliente(ticket);
    expect(clavesSecretas(plano.whatsapp)).toEqual([]);
    expect(plano.whatsapp.name).toBe(w.name);
  });
});

describe("edicion de la conexion", () => {
  it("send_token vacio o ausente conserva el guardado; token ausente tambien", async () => {
    const w = await nuevaConexion();
    const tokenAntes = w.token;

    await UpdateWhatsAppService({
      whatsappId: String(w.id),
      companyId: COMPANY_ID,
      whatsappData: { name: w.name, send_token: "" }
    });
    let enDb = await Whatsapp.findByPk(w.id);
    expect(enDb.send_token).toBe(SEND_TOKEN);
    expect(enDb.token).toBe(tokenAntes);

    await UpdateWhatsAppService({
      whatsappId: String(w.id),
      companyId: COMPANY_ID,
      whatsappData: { name: w.name }
    });
    enDb = await Whatsapp.findByPk(w.id);
    expect(enDb.send_token).toBe(SEND_TOKEN);
    expect(enDb.token).toBe(tokenAntes);
  });

  it("un send_token nuevo reemplaza el guardado", async () => {
    const w = await nuevaConexion();
    await UpdateWhatsAppService({
      whatsappId: String(w.id),
      companyId: COMPANY_ID,
      whatsappData: { name: w.name, send_token: "EAAotroTokenNuevo9999" }
    });
    expect((await Whatsapp.findByPk(w.id)).send_token).toBe("EAAotroTokenNuevo9999");
  });
});

describe("quien gestiona conexiones", () => {
  it("admin, super y usuario con allowConnections enabled; el resto no", async () => {
    const admin = await nuevoUsuario({ profile: "admin" });
    const superUser = await nuevoUsuario({ super: true });
    const conPermiso = await nuevoUsuario({ allowConnections: "enabled" });
    const sinPermiso = await nuevoUsuario({});
    // Valor real en la base local: "disable", no "disabled".
    const conDisabled = await nuevoUsuario({ allowConnections: "disabled" });

    expect(await puedeGestionarConexiones(admin.id)).toBe(true);
    expect(await puedeGestionarConexiones(superUser.id)).toBe(true);
    expect(await puedeGestionarConexiones(conPermiso.id)).toBe(true);
    expect(await puedeGestionarConexiones(sinPermiso.id)).toBe(false);
    expect(await puedeGestionarConexiones(conDisabled.id)).toBe(false);
    expect(await puedeGestionarConexiones(999999999)).toBe(false);
  });

  it("el middleware responde 403 a un usuario sin permiso y deja pasar al admin", async () => {
    const sinPermiso = await nuevoUsuario({});
    const admin = await nuevoUsuario({ profile: "admin" });
    const next = jest.fn();

    await expect(
      canManageConnections({ user: { id: String(sinPermiso.id) } } as any, {} as any, next)
    ).rejects.toMatchObject({ statusCode: 403, message: "ERR_NO_PERMISSION" });
    expect(next).not.toHaveBeenCalled();

    await canManageConnections({ user: { id: String(admin.id) } } as any, {} as any, next);
    expect(next).toHaveBeenCalled();
  });

  it("la ficha da token a quien gestiona conexiones y a nadie send_token", async () => {
    const w = await nuevaConexion();
    const admin = await nuevoUsuario({ profile: "admin" });
    const usuario = await nuevoUsuario({});

    const pedir = async (user: User) => {
      const res = respuestaHttp();
      await WhatsAppController.show(
        {
          params: { whatsappId: String(w.id) },
          query: { session: "0" },
          user: { id: String(user.id), profile: user.profile, companyId: COMPANY_ID }
        } as any,
        res
      );
      return comoCliente(res.json.mock.calls[0][0]);
    };

    const paraAdmin = await pedir(admin);
    expect(paraAdmin.token).toBe(w.token);
    expect(clavesSecretas(paraAdmin)).toEqual(["token"]);
    expect(paraAdmin.sendTokenFinal).toBe("1234");

    const paraUsuario = await pedir(usuario);
    expect(clavesSecretas(paraUsuario)).toEqual([]);
    expect(paraUsuario.name).toBe(w.name);
  });
});
