import {
  logRouterAssignment,
  getRotationState,
  hasHumanReplySince,
  markEscalated,
  isEscalated
} from "../../services/TicketServices/TicketRotationService";
import { ESCALATION_TAG_NAME } from "../../helpers/RotationPolicy";
import Contact from "../../models/Contact";
import LogTicket from "../../models/LogTicket";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";
import User from "../../models/User";
import { closeConnection, getSeededCompany, uniqueSuffix } from "../helpers/db";

// Parte de la rotación automática que toca la base de datos.
//
// Lo delicado aquí es qué cuenta como "respuesta". Un mensaje del bot, una
// nota interna y una respuesta de verdad son las tres filas en Messages con
// fromMe = true, y confundirlas significa no rotar un lead que nadie está
// atendiendo. Por eso las pruebas montan conversaciones con los tres casos
// mezclados.

const COMPANY_ID = 1;
const LTR = "‎"; // marca invisible con la que el proyecto prefija los del bot

const created = {
  messages: [] as number[],
  logs: [] as number[],
  ticketTags: [] as number[],
  tickets: [] as number[],
  contacts: [] as number[],
  users: [] as number[],
  queues: [] as number[],
  tags: [] as number[]
};

let queueId: number;
let messageCounter = 0;
let contactCounter = 0;
const runId = String(Date.now()).slice(-7);

const T0 = new Date("2031-04-12T09:00:00.000Z");
const mas = (minutos: number): Date =>
  new Date(T0.getTime() + minutos * 60 * 1000);

const makeUser = async (name: string): Promise<User> => {
  const user = await User.create({
    name,
    email: `${name}-${uniqueSuffix()}@rotacion.local`,
    passwordHash: "x",
    companyId: COMPANY_ID,
    profile: "user"
  } as any);
  created.users.push(user.id);
  return user;
};

const makeTicket = async (user: User | null): Promise<Ticket> => {
  contactCounter += 1;
  const contact = await Contact.create({
    name: `contacto-${runId}-${contactCounter}`,
    number: `55${runId}${String(contactCounter).padStart(3, "0")}`,
    companyId: COMPANY_ID
  } as any);
  created.contacts.push(contact.id);

  const ticket = await Ticket.create({
    status: "pending",
    companyId: COMPANY_ID,
    contactId: contact.id,
    queueId,
    userId: user ? user.id : null,
    isGroup: false
  } as any);
  created.tickets.push(ticket.id);
  return ticket;
};

// fromMe distingue quién habla; isPrivate marca las notas internas, que el
// cliente nunca llega a ver; el prefijo LTR marca los automáticos.
const addMessage = async (
  ticket: Ticket,
  opts: { body: string | null; fromMe: boolean; when: Date; isPrivate?: boolean }
): Promise<void> => {
  messageCounter += 1;
  const message = await Message.create({
    id: messageCounter,
    body: opts.body,
    fromMe: opts.fromMe,
    ticketId: ticket.id,
    contactId: ticket.contactId,
    companyId: COMPANY_ID,
    ack: 1,
    isPrivate: opts.isPrivate || false
  } as any);

  await Message.update(
    { createdAt: opts.when } as any,
    { where: { id: message.id }, silent: true }
  );
  created.messages.push(message.id as any);
};

beforeAll(async () => {
  await getSeededCompany();

  const maxId: number = (await Message.max("id")) as number;
  messageCounter = (maxId || 0) + 1;

  const queue = await Queue.create({
    name: `fila-rotacion-${uniqueSuffix()}`,
    color: `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")}`,
    companyId: COMPANY_ID,
    orderQueue: 1,
    // Ambos son NOT NULL en el modelo y no tienen valor por defecto.
    ativarRoteador: false,
    tempoRoteador: 0
  } as any);
  created.queues.push(queue.id);
  queueId = queue.id;
});

afterAll(async () => {
  await TicketTag.destroy({ where: { ticketId: created.tickets } });
  await LogTicket.destroy({ where: { ticketId: created.tickets } });
  await Message.destroy({ where: { ticketId: created.tickets } });
  await Ticket.destroy({ where: { id: created.tickets } });
  await Contact.destroy({ where: { id: created.contacts } });
  await User.destroy({ where: { id: created.users } });
  await Tag.destroy({ where: { id: created.tags } });
  await Queue.destroy({ where: { id: created.queues } });
  await closeConnection();
});

describe("hasHumanReplySince", () => {
  it("un mensaje del cliente NO cuenta como respuesta", async () => {
    // El caso que rompía la versión anterior: el cliente insiste y su propia
    // insistencia reiniciaba el contador de espera del asesor.
    const ana = await makeUser("ana-cliente");
    const ticket = await makeTicket(ana);

    await addMessage(ticket, {
      body: "¿Hola? ¿Sigue ahí?",
      fromMe: false,
      when: mas(10)
    });

    await expect(hasHumanReplySince(ticket.id, T0)).resolves.toBe(false);
  });

  it("una respuesta del asesor SÍ cuenta", async () => {
    const ana = await makeUser("ana-responde");
    const ticket = await makeTicket(ana);

    await addMessage(ticket, {
      body: "Buenos días, le atiendo enseguida",
      fromMe: true,
      when: mas(10)
    });

    await expect(hasHumanReplySince(ticket.id, T0)).resolves.toBe(true);
  });

  it("un mensaje del bot NO cuenta", async () => {
    // El bot también escribe con fromMe = true. Lo que lo distingue es el
    // carácter invisible con el que el proyecto prefija sus mensajes.
    const ana = await makeUser("ana-bot");
    const ticket = await makeTicket(ana);

    await addMessage(ticket, {
      body: `${LTR} Aguarde, ya le atendemos`,
      fromMe: true,
      when: mas(10)
    });

    await expect(hasHumanReplySince(ticket.id, T0)).resolves.toBe(false);
  });

  it("una nota interna NO cuenta", async () => {
    // El cliente no la ve, así que para él sigue sin haber respuesta.
    const ana = await makeUser("ana-nota");
    const ticket = await makeTicket(ana);

    await addMessage(ticket, {
      body: "Ojo, este cliente ya llamó ayer",
      fromMe: true,
      isPrivate: true,
      when: mas(10)
    });

    await expect(hasHumanReplySince(ticket.id, T0)).resolves.toBe(false);
  });

  it("un envío de medios sin texto SÍ cuenta", async () => {
    // Un audio o una foto del asesor es atención igual que un texto. La
    // columna body es NOT NULL en la base, así que esos mensajes llegan como
    // cadena vacía, nunca como null.
    const ana = await makeUser("ana-audio");
    const ticket = await makeTicket(ana);

    await addMessage(ticket, { body: "", fromMe: true, when: mas(10) });

    await expect(hasHumanReplySince(ticket.id, T0)).resolves.toBe(true);
  });

  it("solo mira a partir del momento indicado", async () => {
    // Una respuesta anterior a la asignación actual no cuenta: el reloj
    // arranca cuando el ticket cambia de dueño.
    const ana = await makeUser("ana-antes");
    const ticket = await makeTicket(ana);

    await addMessage(ticket, {
      body: "respuesta de la asignación anterior",
      fromMe: true,
      when: mas(5)
    });

    await expect(hasHumanReplySince(ticket.id, mas(30))).resolves.toBe(false);
    await expect(hasHumanReplySince(ticket.id, T0)).resolves.toBe(true);
  });

  it("distingue bien una conversación con bot, nota y respuesta mezclados", async () => {
    const ana = await makeUser("ana-mezcla");
    const ticket = await makeTicket(ana);

    await addMessage(ticket, { body: "Hola", fromMe: false, when: mas(1) });
    await addMessage(ticket, {
      body: `${LTR} Un momento`,
      fromMe: true,
      when: mas(2)
    });
    await addMessage(ticket, {
      body: "nota interna",
      fromMe: true,
      isPrivate: true,
      when: mas(3)
    });
    await addMessage(ticket, { body: "¿Hola?", fromMe: false, when: mas(4) });

    // Hasta aquí nadie ha respondido de verdad.
    await expect(hasHumanReplySince(ticket.id, T0)).resolves.toBe(false);

    await addMessage(ticket, {
      body: "Perdone la espera",
      fromMe: true,
      when: mas(5)
    });

    await expect(hasHumanReplySince(ticket.id, T0)).resolves.toBe(true);
  });
});

describe("getRotationState", () => {
  it("un ticket sin registros no tiene reloj", async () => {
    const ticket = await makeTicket(null);
    const estado = await getRotationState(ticket.id);

    expect(estado.assignments).toBe(0);
    expect(estado.lastAssignedAt).toBeNull();
  });

  it("cuenta las asignaciones y devuelve la última", async () => {
    const ana = await makeUser("ana-cuenta");
    const bruno = await makeUser("bruno-cuenta");
    const ticket = await makeTicket(ana);

    await logRouterAssignment(ticket.id, ana.id, queueId);
    const primera = await getRotationState(ticket.id);
    expect(primera.assignments).toBe(1);
    expect(primera.lastAssignedUserId).toBe(ana.id);
    expect(primera.lastAssignedAt).toBeInstanceOf(Date);

    await logRouterAssignment(ticket.id, bruno.id, queueId);
    const segunda = await getRotationState(ticket.id);
    expect(segunda.assignments).toBe(2);
    expect(segunda.lastAssignedUserId).toBe(bruno.id);
  });

  it("no cuenta los traslados manuales", async () => {
    // Un supervisor que mueve un ticket a mano no debe gastar el límite de
    // rotaciones automáticas.
    const ana = await makeUser("ana-manual");
    const ticket = await makeTicket(ana);

    await logRouterAssignment(ticket.id, ana.id, queueId);
    await LogTicket.create({
      ticketId: ticket.id,
      userId: ana.id,
      queueId,
      type: "transfered"
    } as any);

    const estado = await getRotationState(ticket.id);
    expect(estado.assignments).toBe(1);
  });
});

describe("escalamiento", () => {
  it("marca el ticket y lo reconoce después", async () => {
    const ana = await makeUser("ana-escala");
    const ticket = await makeTicket(ana);

    await expect(isEscalated(ticket.id, COMPANY_ID)).resolves.toBe(false);

    await markEscalated(ticket.id, COMPANY_ID);

    await expect(isEscalated(ticket.id, COMPANY_ID)).resolves.toBe(true);

    const tag = await Tag.findOne({
      where: { name: ESCALATION_TAG_NAME, companyId: COMPANY_ID }
    });
    expect(tag).not.toBeNull();
    if (tag) created.tags.push(tag.id);
  });

  it("marcar dos veces no duplica la etiqueta", async () => {
    // Importa porque el cron pasa cada dos minutos: sin idempotencia, un
    // ticket escalado acumularía una fila por vuelta.
    const ana = await makeUser("ana-doble");
    const ticket = await makeTicket(ana);

    await markEscalated(ticket.id, COMPANY_ID);
    await markEscalated(ticket.id, COMPANY_ID);
    await markEscalated(ticket.id, COMPANY_ID);

    const tag = await Tag.findOne({
      where: { name: ESCALATION_TAG_NAME, companyId: COMPANY_ID }
    });
    if (tag) created.tags.push(tag.id);

    const enlaces = await TicketTag.findAll({ where: { ticketId: ticket.id } });
    expect(enlaces.length).toBe(1);
  });

  it("un ticket sin marcar no aparece como escalado", async () => {
    const ana = await makeUser("ana-limpia");
    const otro = await makeTicket(ana);

    await expect(isEscalated(otro.id, COMPANY_ID)).resolves.toBe(false);
  });
});

describe("reserva atomica frente a dos procesos", () => {
  it("de dos intentos simultaneos solo uno se lleva el ticket", async () => {
    // Esta es la proteccion real contra la doble rotacion, y se ejercita tal
    // cual la usa queues.ts: la condicion viaja dentro del UPDATE, asi que
    // Postgres la resuelve en una sola operacion.
    //
    // El escenario es el del cron solapandose consigo mismo: dos pasadas
    // miran el mismo ticket de Ana y cada una elige un destino distinto.
    const ana = await makeUser("ana-carrera");
    const bruno = await makeUser("bruno-carrera");
    const carla = await makeUser("carla-carrera");
    const ticket = await makeTicket(ana);

    const intentar = (destino: number) =>
      Ticket.update(
        { userId: destino },
        {
          where: { id: ticket.id, userId: ana.id, status: "pending" },
          silent: true
        }
      );

    const [uno, dos] = await Promise.all([
      intentar(bruno.id),
      intentar(carla.id)
    ]);

    const ganadores = [uno[0], dos[0]].filter(n => n === 1).length;
    const perdedores = [uno[0], dos[0]].filter(n => n === 0).length;

    expect(ganadores).toBe(1);
    expect(perdedores).toBe(1);

    // Y el ticket acabo en uno de los dos, nunca en un estado intermedio.
    await ticket.reload();
    expect([bruno.id, carla.id]).toContain(ticket.userId);
  });

  it("un segundo intento sobre un ticket ya rotado no afecta filas", async () => {
    // El caso "proceso A mueve a B, proceso B mueve a C" que hay que evitar:
    // cuando el segundo llega, la condicion ya no se cumple.
    const ana = await makeUser("ana-tarde");
    const bruno = await makeUser("bruno-tarde");
    const carla = await makeUser("carla-tarde");
    const ticket = await makeTicket(ana);

    const primero = await Ticket.update(
      { userId: bruno.id },
      { where: { id: ticket.id, userId: ana.id, status: "pending" }, silent: true }
    );
    expect(primero[0]).toBe(1);

    // El segundo proceso todavia cree que el ticket es de Ana.
    const segundo = await Ticket.update(
      { userId: carla.id },
      { where: { id: ticket.id, userId: ana.id, status: "pending" }, silent: true }
    );
    expect(segundo[0]).toBe(0);

    await ticket.reload();
    expect(ticket.userId).toBe(bruno.id);
  });

  it("no rota un ticket que dejo de estar pendiente", async () => {
    // El asesor abrio la conversacion entre la comprobacion y la escritura.
    const ana = await makeUser("ana-abierto");
    const bruno = await makeUser("bruno-abierto");
    const ticket = await makeTicket(ana);

    await ticket.update({ status: "open" });

    const intento = await Ticket.update(
      { userId: bruno.id },
      { where: { id: ticket.id, userId: ana.id, status: "pending" }, silent: true }
    );

    expect(intento[0]).toBe(0);
    await ticket.reload();
    expect(ticket.userId).toBe(ana.id);
  });
});

describe("tickets anteriores al cambio", () => {
  it("sin registro de asignacion no hay reloj, asi que no rota", async () => {
    // Un ticket asignado antes de instalar esta funcion. La primera pasada
    // del cron le crea la referencia en vez de rotarlo de golpe.
    const ana = await makeUser("ana-antiguo");
    const ticket = await makeTicket(ana);

    const antes = await getRotationState(ticket.id);
    expect(antes.assignments).toBe(0);
    expect(antes.lastAssignedAt).toBeNull();

    // Eso es lo que hace queues.ts en esa situacion.
    await logRouterAssignment(ticket.id, ana.id, queueId);

    const despues = await getRotationState(ticket.id);
    expect(despues.assignments).toBe(1);
    expect(despues.lastAssignedUserId).toBe(ana.id);
    expect(despues.lastAssignedAt).toBeInstanceOf(Date);

    // Y el reloj arranca ahora, no en la fecha de creacion del ticket.
    const edad = Date.now() - (despues.lastAssignedAt as Date).getTime();
    expect(edad).toBeLessThan(60 * 1000);
  });
});
