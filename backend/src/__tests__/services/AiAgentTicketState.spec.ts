// El entorno node de esta version de Jest no expone fetch: openai necesita su shim.
import "openai/shims/node";
import { webcrypto } from "crypto";
// Ni globalThis.crypto, que pide Baileys al cargarse con UpdateTicketService.
if (!(globalThis as any).crypto) (globalThis as any).crypto = webcrypto;
import http from "http";
import { AddressInfo } from "net";
import Company from "../../models/Company";
import Contact from "../../models/Contact";
import ContactWallet from "../../models/ContactWallet";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import TicketTraking from "../../models/TicketTraking";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import AiAgent from "../../models/AiAgent";
import AiAgentFollowUpJob from "../../models/AiAgentFollowUpJob";
import AiAgentTicketState from "../../models/AiAgentTicketState";
import { asignarCanales, crearAgente } from "../../services/AiAgentServices/AiAgentService";
import {
  ajustarParaTests,
  atenderMensajeEntrante,
  cambiarEstadoDesdeAsesor,
  dentroDeHorario,
  esperarAtencion,
  motivoNoAtiende,
  responderEnFlujo,
  turnoDeMensaje
} from "../../services/AiAgentServices/AtenderConAgente";
import { procesarNodoAgente } from "../../services/IntegrationsServices/OpenAiService";
import {
  cambiarEstado,
  leerEstado,
  pausarPorMensajeHumano,
  registrarEnvioAgente
} from "../../services/AiAgentServices/EstadoIaTicket";
import { EnviadorCanal, usarEnviadorCanal } from "../../services/AiAgentServices/EnvioCanal";
import { procesarSeguimientosVencidos } from "../../services/AiAgentServices/SeguimientosWorker";
import { closeConnection, getSeededCompany, uniqueSuffix } from "../helpers/db";

jest.mock("../../libs/socket", () => ({ getIO: () => ({ of: () => ({ emit: () => undefined }) }) }));
jest.mock("../../libs/cache", () => ({ __esModule: true, default: { get: jest.fn(), set: jest.fn(), del: jest.fn() } }));
// La transferencia carga UpdateTicketService y con el, por la cadena de
// imports, queues.ts: sus crons (facturas, reparto, cierre automatico)
// arrancan solos y siguen consultando la base cuando la suite ya cerro la
// conexion, lo que tumbaba otras suites al ejecutarlas todas juntas.
jest.mock("../../queues", () => ({
  __esModule: true,
  campaignQueue: { add: jest.fn(), process: jest.fn() },
  parseToMilliseconds: (segundos: number) => segundos * 1000,
  randomValue: (min: number, max: number) => min + Math.floor(Math.random() * (max - min)),
  startQueueProcess: jest.fn()
}));

// Estado del agente IA por conversacion. Lo que se protege aqui:
//  - activar o pausar la IA nunca cambia la asignacion del ticket;
//  - el mensaje de una persona pausa la IA y ninguna respuesta de IA en camino
//    sale detras de el;
//  - transferir pausa y asigna sin quitar al asesor que ya tuviera.

const COMPANY_A = 1;
const LRM = String.fromCharCode(0x200e);
const CLAVE = "sk-test-estado-ABCD";

// ---------------------------------------------------------------------------
// Proveedor falso (OpenAI chat completions)

let servidor: http.Server;
let base = "";
let peticiones: any[] = [];
let responder: (cuerpo: any) => { content: string; transferir?: boolean; demoraMs?: number } = () => ({ content: "Hola" });

// Envio falso por canal: anota lo enviado y permite actuar en mitad del envio.
let enviados: { ticketId: number; texto: string }[] = [];
let alEnviar: ((n: number) => void) | null = null;
const enviadorFalso: EnviadorCanal = {
  escribiendo: async () => undefined,
  texto: async (ticket, _contact, texto) => {
    enviados.push({ ticketId: ticket.id, texto });
    if (alEnviar) alEnviar(enviados.length);
  },
  voz: async () => false
};

// ---------------------------------------------------------------------------
// Datos

const creados = { tickets: [] as number[], contacts: [] as number[], users: [] as number[], wallets: [] as number[] };
let conexion: Whatsapp;
let fila: Queue;
let asesor: User;
let otroAsesor: User;
let agente: AiAgent;
let empresaB: Company;
let idMensaje = 0;
const runId = String(Date.now()).slice(-7);
let contador = 0;

const crearUsuario = async (nombre: string): Promise<User> => {
  const u = await User.create({
    name: nombre,
    email: `${nombre}-${uniqueSuffix()}@estado-ia.local`,
    passwordHash: "x",
    companyId: COMPANY_A,
    profile: "user"
  } as any);
  creados.users.push(u.id);
  return u;
};

const crearTicket = async (opts: { status?: string; userId?: number | null; queueId?: number | null } = {}) => {
  contador += 1;
  const contacto = await Contact.create({
    name: `cliente-${runId}-${contador}`,
    number: `59${runId}${String(contador).padStart(3, "0")}`,
    companyId: COMPANY_A
  } as any);
  creados.contacts.push(contacto.id);
  const ticket = await Ticket.create({
    status: opts.status || "pending",
    companyId: COMPANY_A,
    contactId: contacto.id,
    whatsappId: conexion.id,
    channel: "facebook",
    userId: opts.userId ?? null,
    queueId: opts.queueId ?? null,
    isGroup: false
  } as any);
  creados.tickets.push(ticket.id);
  await TicketTraking.create({ ticketId: ticket.id, companyId: COMPANY_A, whatsappId: conexion.id } as any);
  return { ticket, contacto };
};

let reloj = new Date("2031-05-01T10:00:00.000Z").getTime();
const mensaje = async (ticket: Ticket, body: string, fromMe: boolean, extra: Partial<Message> = {}): Promise<Message> => {
  idMensaje += 1;
  reloj += 1000;
  const m = await Message.create({
    id: idMensaje,
    wid: `wid-${runId}-${idMensaje}`,
    body,
    fromMe,
    ticketId: ticket.id,
    contactId: ticket.contactId,
    companyId: COMPANY_A,
    ack: 1,
    isPrivate: false,
    ...extra
  } as any);
  await Message.update({ createdAt: new Date(reloj) } as any, { where: { id: m.id }, silent: true });
  return (await Message.findByPk(m.id))!;
};

const recargar = (ticket: Ticket) => Ticket.findByPk(ticket.id) as Promise<Ticket>;

jest.setTimeout(30000);

beforeAll(async () => {
  // La transferencia carga UpdateTicketService, y con el Baileys y todo lo
  // demas que arrastra ts-jest tarda cerca de un minuto la primera vez.
  await import("../../services/TicketServices/UpdateTicketService");
  await getSeededCompany();
  process.env.BUSINESS_TIMEZONE = "America/Guayaquil";
  idMensaje = (((await Message.max("id")) as number) || 0) + 1000;

  servidor = http.createServer((req, res) => {
    let datos = "";
    req.on("data", c => (datos += c));
    req.on("end", async () => {
      const cuerpo = datos ? JSON.parse(datos) : {};
      peticiones.push(cuerpo);
      const r = responder(cuerpo);
      if (r.demoraMs) await new Promise(ok => setTimeout(ok, r.demoraMs));
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: r.content,
                tool_calls: r.transferir
                  ? [{ id: "t1", type: "function", function: { name: "transferir_a_humano", arguments: "{}" } }]
                  : undefined
              }
            }
          ]
        })
      );
    });
  });
  await new Promise<void>(ok => servidor.listen(0, "127.0.0.1", () => ok()));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

  conexion = await Whatsapp.create({ name: `fb-estado-${uniqueSuffix()}`, channel: "facebook", companyId: COMPANY_A, status: "CONNECTED", isDefault: false } as any);
  fila = await Queue.create({
    name: `fila-ia-${uniqueSuffix()}`,
    color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`,
    companyId: COMPANY_A,
    orderQueue: 1,
    ativarRoteador: false,
    tempoRoteador: 0
  } as any);
  asesor = await crearUsuario("juan");
  otroAsesor = await crearUsuario("cartera");
  empresaB = await Company.create({ name: `estado-b-${uniqueSuffix()}`, planId: 1, status: true } as any);

  const creado = await crearAgente(COMPANY_A, {
    name: `Agente estado ${uniqueSuffix()}`,
    provider: "openai",
    model: "gpt-prueba",
    apiKey: CLAVE,
    dividirRespuestas: false,
    followUps: [{ when: { amount: 30, unit: "minutes" }, mode: "manual", content: "¿Sigues interesado?" }]
  } as any);
  await asignarCanales(COMPANY_A, creado.id, [conexion.id]);
  agente = (await AiAgent.findByPk(creado.id))!;

  ajustarParaTests({ motor: { baseURL: base }, pausa: () => 20 });
  usarEnviadorCanal(enviadorFalso);
}, 240000);

beforeEach(() => {
  peticiones = [];
  enviados = [];
  alEnviar = null;
  responder = () => ({ content: "Hola, ¿en que te ayudo?" });
});

afterAll(async () => {
  ajustarParaTests(null);
  usarEnviadorCanal(null);
  await ContactWallet.destroy({ where: { id: creados.wallets } });
  await Message.destroy({ where: { ticketId: creados.tickets } });
  await AiAgentFollowUpJob.destroy({ where: { ticketId: creados.tickets } });
  await AiAgentTicketState.destroy({ where: { ticketId: creados.tickets } });
  await TicketTraking.destroy({ where: { ticketId: creados.tickets } });
  await Ticket.destroy({ where: { id: creados.tickets } });
  await Contact.destroy({ where: { id: creados.contacts } });
  await AiAgent.destroy({ where: { id: agente.id } });
  await Whatsapp.destroy({ where: { id: conexion.id } });
  await Queue.destroy({ where: { id: fila.id } });
  await User.destroy({ where: { id: creados.users } });
  await empresaB.destroy();
  await new Promise<void>(ok => servidor.close(() => ok()));
  await closeConnection();
});

// ---------------------------------------------------------------------------
describe("Reglas puras", () => {
  it("horario del agente en la zona del negocio; 24/7 siempre abre", () => {
    const todos = [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, enabled: true, start: "09:00", end: "18:00" }));
    expect(dentroDeHorario({ mode: "custom", days: todos }, new Date("2031-05-01T14:30:00Z"))).toBe(true); // 09:30 Guayaquil
    expect(dentroDeHorario({ mode: "custom", days: todos }, new Date("2031-05-01T04:00:00Z"))).toBe(false); // 23:00 Guayaquil
    expect(dentroDeHorario({ mode: "24/7" }, new Date("2031-05-01T04:00:00Z"))).toBe(true);
  });

  it("no atiende grupos, cerrados, flujos en marcha ni contactos con Desactivar chatbot", () => {
    const ok: any = { channel: "facebook", isGroup: false, imported: null, status: "open", useIntegration: false };
    expect(motivoNoAtiende(ok, { disableBot: false } as any)).toBeNull();
    expect(motivoNoAtiende({ ...ok, channel: "ghl" }, null)).toBe("canal");
    expect(motivoNoAtiende({ ...ok, isGroup: true }, null)).toBe("grupo");
    expect(motivoNoAtiende({ ...ok, status: "closed" }, null)).toBe("estado:closed");
    expect(motivoNoAtiende({ ...ok, useIntegration: true }, null)).toBe("integracion");
    expect(motivoNoAtiende({ ...ok, flowStopped: "3", lastFlowId: "n1" }, null)).toBe("flujo");
    expect(motivoNoAtiende(ok, { disableBot: true } as any)).toBe("disableBot");
  });

  it("historial: la IA sabe que mensajes escribio un asesor y que hubo un audio o una imagen", () => {
    const m = (datos: any) => ({ ...datos, getDataValue: (k: string) => datos[k] } as any);
    expect(turnoDeMensaje(m({ body: "hola", fromMe: false }))).toEqual({ role: "user", text: "hola" });
    expect(turnoDeMensaje(m({ body: `${LRM}soy la IA`, fromMe: true }))).toEqual({ role: "assistant", text: "soy la IA" });
    expect(turnoDeMensaje(m({ body: "soy Juan", fromMe: true }))).toEqual({ role: "assistant", text: "(Mensaje del asesor humano) soy Juan" });
    expect(turnoDeMensaje(m({ body: "Áudio", fromMe: false, mediaType: "audio", mediaUrl: "a.ogg" }))).toEqual({ role: "user", text: "[un audio]" });
    expect(turnoDeMensaje(m({ body: "foto.jpg", fromMe: false, mediaType: "image", mediaUrl: "foto.jpg" }))).toEqual({ role: "user", text: "[una imagen]" });
    expect(turnoDeMensaje(m({ body: "mira", fromMe: false, mediaType: "image", mediaUrl: "foto.jpg" }))).toEqual({ role: "user", text: "[una imagen] mira" });
  });
});

// ---------------------------------------------------------------------------
describe("Estado de la IA independiente de la asignacion", () => {
  it("activar y pausar solo cambian el estado: asesor, status y fila intactos", async () => {
    const { ticket } = await crearTicket({ status: "open", userId: asesor.id, queueId: fila.id });

    expect((await leerEstado(ticket)).enabled).toBe(true);
    const pausado = await cambiarEstadoDesdeAsesor(ticket.id, COMPANY_A, false, asesor.id);
    expect(pausado.enabled).toBe(false);
    expect(pausado.reason).toBe("manual");
    const activado = await cambiarEstadoDesdeAsesor(ticket.id, COMPANY_A, true, asesor.id);
    expect(activado.enabled).toBe(true);
    expect(activado.version).toBe(pausado.version + 1);

    const despues = await recargar(ticket);
    expect(despues.userId).toBe(asesor.id);
    expect(despues.status).toBe("open");
    expect(despues.queueId).toBe(fila.id);
  });

  it("otra empresa no puede ver ni cambiar el estado", async () => {
    const { ticket } = await crearTicket();
    await expect(cambiarEstadoDesdeAsesor(ticket.id, empresaB.id, false, asesor.id)).rejects.toBeTruthy();
    expect((await leerEstado(ticket)).enabled).toBe(true);
  });

  it("si una persona ya escribio en la atencion, la IA empieza pausada", async () => {
    const { ticket } = await crearTicket({ status: "open", userId: asesor.id });
    await mensaje(ticket, "hola", false);
    await mensaje(ticket, "te atiendo yo", true);
    const estado = await leerEstado(ticket);
    expect(estado.enabled).toBe(false);
    expect(estado.reason).toBe("human_message");
  });

  it("al cerrar la atencion, la siguiente empieza con la IA activa", async () => {
    const { ticket } = await crearTicket();
    await cambiarEstado(ticket, false, "manual", asesor.id);
    expect((await leerEstado(ticket)).enabled).toBe(false);

    await TicketTraking.update({ finishedAt: new Date() } as any, { where: { ticketId: ticket.id } });
    await TicketTraking.create({ ticketId: ticket.id, companyId: COMPANY_A, whatsappId: conexion.id } as any);
    expect((await leerEstado(ticket)).enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("Atencion por el agente", () => {
  it("responde en un ticket abierto y asignado si la IA esta activa, con el contexto del asesor", async () => {
    const { ticket, contacto } = await crearTicket({ status: "open", userId: asesor.id });
    await mensaje(ticket, "precio del curso?", false);
    await mensaje(ticket, `${LRM}Cuesta 100 USD`, true);
    await cambiarEstado(ticket, false, "manual", asesor.id);
    await mensaje(ticket, "te doy descuento del 10%", true);
    await cambiarEstado(ticket, true, "manual", asesor.id);
    const entrante = await mensaje(ticket, "y cuanto queda?", false);

    responder = () => ({ content: "Te queda en 90 USD." });
    const t = (await Ticket.findByPk(ticket.id))!;
    expect(await atenderMensajeEntrante({ ticket: t, contact: contacto, wid: entrante.wid })).toBe(true);
    await esperarAtencion(ticket.id);

    expect(enviados.map(e => e.texto)).toEqual(["Te queda en 90 USD."]);
    const turnos = peticiones[0].messages.map((m: any) => `${m.role}:${typeof m.content === "string" ? m.content : ""}`);
    expect(turnos).toContain("assistant:(Mensaje del asesor humano) te doy descuento del 10%");
    expect(turnos[turnos.length - 1]).toBe("user:y cuanto queda?");

    const despues = await recargar(ticket);
    expect(despues.userId).toBe(asesor.id);
    expect(despues.status).toBe("open");
  });

  it("con la IA pausada no llama al proveedor ni responde", async () => {
    const { ticket, contacto } = await crearTicket({ status: "open", userId: asesor.id });
    await cambiarEstado(ticket, false, "manual", asesor.id);
    const entrante = await mensaje(ticket, "hola?", false);
    expect(await atenderMensajeEntrante({ ticket, contact: contacto, wid: entrante.wid })).toBe(false);
    await esperarAtencion(ticket.id);
    expect(peticiones).toHaveLength(0);
    expect(enviados).toHaveLength(0);
  });

  it("prioridad humana: si el asesor escribe mientras la IA genera, la respuesta se descarta", async () => {
    const { ticket, contacto } = await crearTicket();
    const entrante = await mensaje(ticket, "hola", false);
    responder = () => ({ content: "Respuesta tardia", demoraMs: 400 });

    expect(await atenderMensajeEntrante({ ticket, contact: contacto, wid: entrante.wid })).toBe(true);
    await new Promise(ok => setTimeout(ok, 150));
    expect(await pausarPorMensajeHumano(ticket, { userId: asesor.id })).toBe(true);
    await esperarAtencion(ticket.id);

    expect(peticiones).toHaveLength(1);
    expect(enviados).toHaveLength(0);
    const estado = await leerEstado(ticket);
    expect(estado.enabled).toBe(false);
    expect(estado.reason).toBe("human_message");
  });

  it("prioridad humana: entre dos bloques, el segundo ya no sale detras del mensaje del asesor", async () => {
    await agente.update({ dividirRespuestas: true, cantidadBloques: 2 });
    try {
      const { ticket, contacto } = await crearTicket();
      const entrante = await mensaje(ticket, "info", false);
      responder = () => ({ content: "Primer parrafo con informacion.\n\nSegundo parrafo con mas informacion." });
      let pausa: Promise<boolean> | null = null;
      alEnviar = n => {
        // Se lanza sin esperar: el envio del bloque tiene el bloqueo del ticket.
        if (n === 1) pausa = pausarPorMensajeHumano(ticket, { userId: asesor.id });
      };

      await atenderMensajeEntrante({ ticket, contact: contacto, wid: entrante.wid });
      await esperarAtencion(ticket.id);
      expect(await pausa).toBe(true);
      expect(enviados.map(e => e.texto)).toEqual(["Primer parrafo con informacion."]);
    } finally {
      await agente.update({ dividirRespuestas: false });
    }
  });

  it("los mensajes que envio el propio agente no pausan la IA", async () => {
    const { ticket } = await crearTicket();
    await cambiarEstado(ticket, true, null, null);
    registrarEnvioAgente("wid-audio-del-agente");
    expect(await pausarPorMensajeHumano(ticket, { wid: "wid-audio-del-agente" })).toBe(false);
    expect((await leerEstado(ticket)).enabled).toBe(true);
  });

  it("activar desde el asesor responde al ultimo mensaje del cliente; si el ultimo es del asesor, espera", async () => {
    const { ticket } = await crearTicket({ status: "open", userId: asesor.id });
    await mensaje(ticket, "hola", false);
    await cambiarEstado(ticket, false, "manual", asesor.id);
    await mensaje(ticket, "ahora vuelvo", true);

    await cambiarEstadoDesdeAsesor(ticket.id, COMPANY_A, true, asesor.id);
    await esperarAtencion(ticket.id);
    expect(enviados).toHaveLength(0);

    const pregunta = await mensaje(ticket, "sigues ahi?", false);
    await cambiarEstadoDesdeAsesor(ticket.id, COMPANY_A, false, asesor.id);
    responder = () => ({ content: "Si, aqui estoy." });
    await cambiarEstadoDesdeAsesor(ticket.id, COMPANY_A, true, asesor.id);
    await esperarAtencion(ticket.id);
    expect(enviados.map(e => e.texto)).toEqual(["Si, aqui estoy."]);
    expect(peticiones[0].messages[peticiones[0].messages.length - 1].content).toBe(pregunta.body);
    expect((await recargar(ticket)).userId).toBe(asesor.id);
  });
});

// ---------------------------------------------------------------------------
describe("Transferencia a humano", () => {
  it("con asesor ya asignado: pausa la IA y el asesor se queda", async () => {
    const { ticket, contacto } = await crearTicket({ status: "open", userId: asesor.id });
    const entrante = await mensaje(ticket, "quiero hablar con alguien", false);
    responder = () => ({ content: "Te paso con el equipo.", transferir: true });

    await atenderMensajeEntrante({ ticket, contact: contacto, wid: entrante.wid });
    await esperarAtencion(ticket.id);

    expect(enviados.map(e => e.texto)).toEqual(["Te paso con el equipo."]);
    const estado = await leerEstado(ticket);
    expect(estado.enabled).toBe(false);
    expect(estado.reason).toBe("transfer");
    const despues = await recargar(ticket);
    expect(despues.userId).toBe(asesor.id);
    expect(despues.status).toBe("open");
    expect(await AiAgentFollowUpJob.count({ where: { ticketId: ticket.id, status: "pending" } })).toBe(0);
  });

  it("sin asesor y con cartera: se asigna al dueno de la cartera", async () => {
    const { ticket, contacto } = await crearTicket();
    const cartera = await ContactWallet.create({ contactId: contacto.id, walletId: otroAsesor.id, queueId: fila.id, companyId: COMPANY_A } as any);
    creados.wallets.push(cartera.id);
    const entrante = await mensaje(ticket, "necesito un humano", false);
    responder = () => ({ content: "Te paso con tu asesor.", transferir: true });

    await atenderMensajeEntrante({ ticket, contact: contacto, wid: entrante.wid });
    await esperarAtencion(ticket.id);

    const despues = await recargar(ticket);
    expect(despues.userId).toBe(otroAsesor.id);
    expect(despues.status).toBe("pending");
    expect((await leerEstado(ticket)).enabled).toBe(false);
  });

  it("sin asesor ni cartera: va a la fila de transferencia del agente", async () => {
    await agente.update({ transferQueueId: fila.id });
    try {
      const { ticket, contacto } = await crearTicket();
      const entrante = await mensaje(ticket, "un humano por favor", false);
      responder = () => ({ content: "Te comunico.", transferir: true });

      await atenderMensajeEntrante({ ticket, contact: contacto, wid: entrante.wid });
      await esperarAtencion(ticket.id);

      const despues = await recargar(ticket);
      expect(despues.queueId).toBe(fila.id);
      expect(despues.userId).toBeNull();
      expect((await leerEstado(ticket)).reason).toBe("transfer");
    } finally {
      await agente.update({ transferQueueId: null });
    }
  });
});

// ---------------------------------------------------------------------------
describe("Seguimientos", () => {
  const vencer = (ticketId: number) =>
    AiAgentFollowUpJob.update({ dueAt: new Date(Date.now() - 1000) } as any, { where: { ticketId, status: "pending" } });

  it("se programan al responder y se envian si la IA sigue activa y el cliente no contesto", async () => {
    const { ticket, contacto } = await crearTicket();
    const entrante = await mensaje(ticket, "hola", false);
    await atenderMensajeEntrante({ ticket, contact: contacto, wid: entrante.wid });
    await esperarAtencion(ticket.id);
    expect(await AiAgentFollowUpJob.count({ where: { ticketId: ticket.id, status: "pending", step: 1 } })).toBe(1);

    await mensaje(ticket, `${LRM}Hola, ¿en que te ayudo?`, true);
    await vencer(ticket.id);
    enviados = [];
    await procesarSeguimientosVencidos();
    expect(enviados.map(e => e.texto)).toEqual(["¿Sigues interesado?"]);
    expect(await AiAgentFollowUpJob.count({ where: { ticketId: ticket.id, status: "sent" } })).toBe(1);
  });

  it("con la IA pausada no se envian: pausar los cancela", async () => {
    const { ticket, contacto } = await crearTicket();
    const entrante = await mensaje(ticket, "hola", false);
    await atenderMensajeEntrante({ ticket, contact: contacto, wid: entrante.wid });
    await esperarAtencion(ticket.id);

    await cambiarEstado(ticket, false, "manual", asesor.id);
    expect(await AiAgentFollowUpJob.count({ where: { ticketId: ticket.id, status: "pending" } })).toBe(0);
    const cancelado = await AiAgentFollowUpJob.findOne({ where: { ticketId: ticket.id } });
    expect(cancelado!.status).toBe("cancelled");
  });

  it("si el cliente respondio, el seguimiento vencido se cancela", async () => {
    const { ticket } = await crearTicket();
    await AiAgentFollowUpJob.create({ companyId: COMPANY_A, agentId: agente.id, ticketId: ticket.id, step: 1, dueAt: new Date(Date.now() - 1000), status: "pending" } as any);
    await mensaje(ticket, "ya te respondi", false);
    enviados = [];
    await procesarSeguimientosVencidos();
    expect(enviados).toHaveLength(0);
    expect((await AiAgentFollowUpJob.findOne({ where: { ticketId: ticket.id } }))!.reason).toBe("client_replied");
  });
});

// ---------------------------------------------------------------------------
describe("Nodos del Flow Builder con agente", () => {
  let conexionFlujo: Whatsapp;
  let agenteFlujo: AiAgent;

  beforeAll(async () => {
    // Conexion SIN agente propio: el que responde es el del nodo del flujo.
    conexionFlujo = await Whatsapp.create({ name: `fb-flujo-${uniqueSuffix()}`, channel: "facebook", companyId: COMPANY_A, status: "CONNECTED", isDefault: false } as any);
    const creado = await crearAgente(COMPANY_A, {
      name: `Agente flujo ${uniqueSuffix()}`,
      provider: "openai",
      model: "gpt-prueba",
      apiKey: CLAVE,
      disponibleEnFlujos: true
    } as any);
    agenteFlujo = (await AiAgent.findByPk(creado.id))!;
  });

  afterAll(async () => {
    await AiAgent.destroy({ where: { id: agenteFlujo.id } });
    await Ticket.update({ whatsappId: null } as any, { where: { whatsappId: conexionFlujo.id } });
    await Whatsapp.destroy({ where: { id: conexionFlujo.id } });
  });

  const ticketEnNodo = async (settings: Record<string, unknown> = {}) => {
    const { ticket, contacto } = await crearTicket();
    await ticket.update({
      whatsappId: conexionFlujo.id,
      useIntegration: true,
      dataWebhook: { type: "openai", mode: "permanent", settings: { agentId: agenteFlujo.id, flowMode: "permanent", queueId: 0, ...settings } }
    } as any);
    await TicketTraking.update({ whatsappId: conexionFlujo.id } as any, { where: { ticketId: ticket.id } });
    return { ticket: (await Ticket.findByPk(ticket.id))!, contacto };
  };

  it("responde el agente del nodo aunque la conexion no tenga agente; el enganche de conexion no interviene", async () => {
    const { ticket, contacto } = await ticketEnNodo();
    const entrante = await mensaje(ticket, "quiero informacion", false);
    responder = () => ({ content: "Claro, te cuento." });

    expect(await atenderMensajeEntrante({ ticket, contact: contacto, wid: entrante.wid })).toBe(false);
    expect(await responderEnFlujo({ ticket, contact: contacto, agentId: agenteFlujo.id, wid: entrante.wid })).toBe("respondido");
    expect(enviados.map(e => e.texto)).toEqual(["Claro, te cuento."]);
    // Los seguimientos son del agente de conexion: en un flujo manda el flujo.
    expect(await AiAgentFollowUpJob.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  it("al transferir sale del modo IA del flujo, pausa la IA y usa la fila del nodo", async () => {
    const { ticket, contacto } = await ticketEnNodo({ queueId: fila.id });
    const entrante = await mensaje(ticket, "con una persona", false);
    responder = () => ({ content: "Te paso con el equipo.", transferir: true });

    expect(
      await responderEnFlujo({ ticket, contact: contacto, agentId: agenteFlujo.id, wid: entrante.wid, filaTransferencia: fila.id })
    ).toBe("transferido");
    const despues = await recargar(ticket);
    expect(despues.useIntegration).toBe(false);
    expect(despues.dataWebhook).toBeNull();
    expect(despues.queueId).toBe(fila.id);
    expect((await leerEstado(ticket)).reason).toBe("transfer");
  });

  it("un mensaje de una persona tambien pausa al agente del flujo", async () => {
    const { ticket, contacto } = await ticketEnNodo();
    expect(await pausarPorMensajeHumano(ticket, { userId: asesor.id })).toBe(true);
    const entrante = await mensaje(ticket, "hola?", false);
    expect(await responderEnFlujo({ ticket, contact: contacto, agentId: agenteFlujo.id, wid: entrante.wid })).toBe("pausado");
    expect(enviados).toHaveLength(0);
  });

  it("los textos automaticos del flujo, sin la marca, no dejan al agente pausado de entrada", async () => {
    const { ticket, contacto } = await ticketEnNodo();
    await mensaje(ticket, "Bienvenido a la academia", true); // texto de un nodo del flujo
    const entrante = await mensaje(ticket, "info", false);
    responder = () => ({ content: "Con gusto." });
    expect(await responderEnFlujo({ ticket, contact: contacto, agentId: agenteFlujo.id, wid: entrante.wid })).toBe("respondido");
  });

  it("un agente no disponible para flujos no responde", async () => {
    await agenteFlujo.update({ disponibleEnFlujos: false });
    try {
      const { ticket, contacto } = await ticketEnNodo();
      const entrante = await mensaje(ticket, "hola", false);
      expect(await responderEnFlujo({ ticket, contact: contacto, agentId: agenteFlujo.id, wid: entrante.wid })).toBe("no_aplica");
      expect(peticiones).toHaveLength(0);
    } finally {
      await agenteFlujo.update({ disponibleEnFlujos: true });
    }
  });

  it("modo temporal: la palabra clave vuelve al flujo con un aviso marcado como automatico", async () => {
    const { ticket, contacto } = await ticketEnNodo();
    await ticket.update({
      dataWebhook: {
        ...(ticket.dataWebhook as any),
        mode: "temporary",
        flowContinuation: { nextNodeId: "nodo-siguiente", interactionCount: 0, startTime: new Date().toISOString() }
      }
    } as any);
    const conCliente = (await Ticket.findByPk(ticket.id, { include: ["contact"] }))!;
    const ajustes: any = { agentId: agenteFlujo.id, flowMode: "temporary", continueKeywords: ["continuar"], queueId: 0 };

    await procesarNodoAgente(ajustes, conCliente, contacto, "sin-wid", "quiero continuar");
    expect(peticiones).toHaveLength(0);
    // Sale por el envio de los agentes, que pone la marca de automatico: su eco
    // no pausa la IA del siguiente nodo.
    expect(enviados.map(e => e.texto)).toEqual(["Perfeito! Vou prosseguir com o atendimento."]);
    const despues = await recargar(ticket);
    expect(despues.useIntegration).toBe(false);
  });
});
