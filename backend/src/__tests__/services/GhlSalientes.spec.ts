import Company from "../../models/Company";
import CompaniesSettings from "../../models/CompaniesSettings";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import TicketTraking from "../../models/TicketTraking";
import Whatsapp from "../../models/Whatsapp";
import ReceiveGhlMessageService from "../../services/GhlServices/ReceiveGhlMessageService";
import SendGhlMessage from "../../services/GhlServices/SendGhlMessage";
import CreateMessageService from "../../services/MessageServices/CreateMessageService";
import { enviarMensaje } from "../../services/GhlServices/GhlApiClient";
import { closeConnection, uniqueSuffix } from "../helpers/db";

jest.mock("../../libs/socket", () => ({ getIO: () => ({ of: () => ({ emit: () => undefined }) }) }));
jest.mock("../../services/ConversionServices/ConversionService", () => ({ registrarLeadEntrante: jest.fn() }));
// La API de GHL es externa: el envio se sustituye y se comprueba lo que hace
// Sales Smart con su respuesta.
jest.mock("../../services/GhlServices/GhlApiClient", () => ({
  clienteDeEmpresa: jest.fn(async () => ({})),
  upsertContacto: jest.fn(async () => "ghl-contacto"),
  enviarMensaje: jest.fn()
}));
const enviarMensajeMock = enviarMensaje as jest.Mock;

// Mensajes salientes que llegan por el webhook de GHL:
//  - el eco de lo que envio Sales Smart se descarta (ya esta en el hilo);
//  - lo escrito directamente en la bandeja de GHL se guarda como enviado;
//  - sin messageId no se puede distinguir del eco y se descarta, como antes;
//  - si el eco llega antes de que Sales Smart guarde su envio, no se duplica.

let empresa: Company;
let conexion: Whatsapp;
let contador = 0;

const evento = (extra: Record<string, unknown>) => {
  contador += 1;
  return {
    contactId: `ghl-${uniqueSuffix()}-${contador}`,
    phone: `+593 99${String(Date.now()).slice(-6)}${contador}`,
    contact: { name: "Cliente GHL" },
    body: "hola",
    ...extra
  };
};

const mensajesDe = (wid: string) => Message.findAll({ where: { wid, companyId: empresa.id } });

beforeAll(async () => {
  empresa = await Company.create({ name: `ghl-salientes-${uniqueSuffix()}`, planId: 1, status: true } as any);
  // Al dar de alta una empresa se crean sus ajustes (CreateCompanyService); sin
  // ellos FindOrCreateTicketService no puede decidir el estado del ticket.
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
  conexion = await Whatsapp.create({
    name: `ghl-${uniqueSuffix()}`,
    channel: "ghl",
    companyId: empresa.id,
    status: "CONNECTED",
    isDefault: false
  } as any);
});

afterAll(async () => {
  const tickets = await Ticket.findAll({ where: { companyId: empresa.id }, attributes: ["id"] });
  const ids = tickets.map(t => t.id);
  await Message.destroy({ where: { companyId: empresa.id } });
  await TicketTraking.destroy({ where: { ticketId: ids } });
  await Ticket.destroy({ where: { id: ids } });
  await Contact.destroy({ where: { companyId: empresa.id } });
  if (conexion) await Whatsapp.destroy({ where: { id: conexion.id } });
  await CompaniesSettings.destroy({ where: { companyId: empresa.id } });
  await empresa.destroy();
  await closeConnection();
});

describe("Webhook de GHL: mensajes salientes", () => {
  it("un entrante se guarda como siempre (del cliente, sin leer)", async () => {
    const wid = `in-${uniqueSuffix()}`;
    const r = await ReceiveGhlMessageService(empresa.id, evento({ messageId: wid, body: "quiero info" }));
    expect(r.atendido).toBe(true);
    const [m] = await mensajesDe(wid);
    expect(m.fromMe).toBe(false);
    expect(m.body).toBe("quiero info");
  });

  it("el eco de un mensaje que envio Sales Smart se descarta", async () => {
    const wid = `out-${uniqueSuffix()}`;
    const e = evento({ messageId: wid, direction: "outbound", body: "respuesta del asesor" });
    // Primero entra un mensaje del cliente para que exista el ticket...
    await ReceiveGhlMessageService(empresa.id, { ...e, messageId: `in-${uniqueSuffix()}`, direction: "inbound", body: "hola" });
    const [delCliente] = await Message.findAll({ where: { companyId: empresa.id }, order: [["createdAt", "DESC"]], limit: 1 });
    // ...y Sales Smart guarda su respuesta con el messageId que devolvio GHL,
    // por el mismo camino que SendGhlMessage.
    await CreateMessageService({
      messageData: {
        wid,
        body: "respuesta del asesor",
        fromMe: true,
        ticketId: delCliente.ticketId,
        contactId: delCliente.contactId,
        mediaType: "conversation",
        read: true,
        ack: 1,
        channel: "ghl"
      } as any,
      companyId: empresa.id
    });

    const r = await ReceiveGhlMessageService(empresa.id, e);
    expect(r.atendido).toBe(false);
    expect(r.motivo).toContain("eco");
    expect(await mensajesDe(wid)).toHaveLength(1);
  });

  it("un mensaje escrito directamente en GHL se guarda en el ticket como enviado", async () => {
    const wid = `ghl-inbox-${uniqueSuffix()}`;
    const r = await ReceiveGhlMessageService(
      empresa.id,
      evento({ messageId: wid, direction: "outbound", body: "te escribo desde GHL" })
    );
    expect(r.atendido).toBe(true);
    const [m] = await mensajesDe(wid);
    expect(m.fromMe).toBe(true);
    expect(m.read).toBe(true);
    const ticket = await Ticket.findByPk(m.ticketId);
    expect(ticket!.unreadMessages).toBe(0);
    expect(ticket!.lastMessage).toBe("te escribo desde GHL");
  });

  it("un saliente sin messageId se descarta: no hay con que compararlo", async () => {
    const antes = await Message.count({ where: { companyId: empresa.id } });
    const r = await ReceiveGhlMessageService(empresa.id, evento({ direction: "outgoing", body: "sin id" }));
    expect(r.atendido).toBe(false);
    expect(await Message.count({ where: { companyId: empresa.id } })).toBe(antes);
  });
});

describe("Envio a GHL cuando el eco llega antes", () => {
  it("si el webhook ya guardo el eco, el envio no lo crea otra vez", async () => {
    const wid = `carrera-${uniqueSuffix()}`;
    // El cliente escribe y el eco del envio llega por el webhook antes de que
    // SendGhlMessage termine: queda guardado como escrito en GHL.
    const e = evento({ messageId: `in-${uniqueSuffix()}`, body: "hola" });
    await ReceiveGhlMessageService(empresa.id, e);
    const contacto = await Contact.findOne({ where: { ghlContactId: e.contactId, companyId: empresa.id } });
    await ReceiveGhlMessageService(empresa.id, { ...e, messageId: wid, direction: "outbound", body: "respuesta" });

    enviarMensajeMock.mockResolvedValue({ ok: true, messageId: wid });
    const ticket = await Ticket.findOne({ where: { contactId: contacto!.id, companyId: empresa.id } });
    const conContacto = (await Ticket.findByPk(ticket!.id, { include: ["contact"] }))!;
    const envio = await SendGhlMessage({ body: "respuesta", ticket: conContacto });

    expect(envio.ok).toBe(true);
    expect(await mensajesDe(wid)).toHaveLength(1);
  });
});
