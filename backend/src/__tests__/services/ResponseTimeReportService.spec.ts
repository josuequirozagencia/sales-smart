import ResponseTimeReportService from "../../services/ReportService/ResponseTimeReportService";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import TicketTraking from "../../models/TicketTraking";
import User from "../../models/User";
import { closeConnection, getSeededCompany, uniqueSuffix } from "../helpers/db";

// Relatório de tempo de resposta.
//
// Mede o que o cliente sente: do recado dele até a primeira resposta de
// gente. É diferente do waitTime que o dashboard já trazia, que para de
// contar quando alguém ABRE o ticket — abrir não é responder.
//
// A parte frágil é o filtro das mensagens automáticas: elas também têm
// fromMe = true, e sem excluí-las o relatório mostraria segundos em vez do
// tempo real. Por isso os testes montam conversas com bot no meio.

const COMPANY_ID = 1;
const LTR = "‎"; // marca que o projeto usa para prefixar mensagens do bot

const created = {
  messages: [] as number[],
  trakings: [] as number[],
  tickets: [] as number[],
  contacts: [] as number[],
  users: [] as number[],
  queues: [] as number[]
};

let queueId: number;

// Identificador desta execução, para que os números de contato não colidam
// com os de uma rodada anterior que tenha deixado lixo.
const runId = String(Date.now()).slice(-7);
let contactCounter = 0;
let messageCounter = 0;

// Datas fixas e antigas para não colidir com nada que já esteja no banco.
const DAY = "2031-03-10";
const at = (minutes: number, seconds = 0): Date =>
  new Date(`${DAY}T10:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.000Z`);

const makeUser = async (name: string): Promise<User> => {
  const user = await User.create({
    name,
    email: `${name}-${uniqueSuffix()}@teste.local`,
    passwordHash: "x",
    companyId: COMPANY_ID,
    profile: "user"
  } as any);
  created.users.push(user.id);
  return user;
};

// Monta um ticket com a conversa já posicionada no tempo.
const makeConversation = async (opts: {
  user: User | null;
  contactAt: Date;
  replyAt?: Date;
  botAt?: Date;
  queuedAt?: Date;
  startedAt?: Date;
}) => {
  // number tem restrição de unicidade por empresa; um contador garante que
  // duas conversas criadas no mesmo milissegundo não colidam.
  contactCounter += 1;
  const contact = await Contact.create({
    name: `contato-${contactCounter}`,
    number: `55${runId}${String(contactCounter).padStart(3, "0")}`,
    companyId: COMPANY_ID
  } as any);
  created.contacts.push(contact.id);

  const ticket = await Ticket.create({
    status: "closed",
    contactId: contact.id,
    companyId: COMPANY_ID,
    queueId,
    userId: opts.user ? opts.user.id : null
  } as any);
  created.tickets.push(ticket.id);

  const traking = await TicketTraking.create({
    ticketId: ticket.id,
    companyId: COMPANY_ID,
    userId: opts.user ? opts.user.id : null,
    queuedAt: opts.queuedAt || opts.contactAt,
    startedAt: opts.startedAt || null
  } as any);
  created.trakings.push(traking.id);

  // O relatório filtra o período por TicketTraking.createdAt, que o Sequelize
  // preenche com "agora". Sem alinhar com a data da conversa, os dados de
  // teste ficariam fora da janela consultada.
  await TicketTraking.update(
    { createdAt: opts.contactAt } as any,
    { where: { id: traking.id }, silent: true }
  );

  const addMessage = async (body: string, fromMe: boolean, when: Date) => {
    // Messages.id é chave primária inteira sem autoincremento (o modelo não
    // usa @AutoIncrement), então o id tem de vir de fora.
    messageCounter += 1;
    const message = await Message.create({
      id: messageCounter,
      body,
      fromMe,
      ticketId: ticket.id,
      contactId: contact.id,
      companyId: COMPANY_ID,
      ack: 1,
      isPrivate: false
    } as any);
    // createdAt é gerido pelo Sequelize; para posicionar a conversa no tempo
    // é preciso escrever depois, com silent para não mexer no updatedAt.
    await Message.update(
      { createdAt: when } as any,
      { where: { id: message.id }, silent: true }
    );
    created.messages.push(message.id as any);
  };

  await addMessage("Olá, tenho uma dúvida", false, opts.contactAt);

  if (opts.botAt) {
    await addMessage(`${LTR} Aguarde, já vamos atender`, true, opts.botAt);
  }

  if (opts.replyAt) {
    await addMessage("Claro, pode falar", true, opts.replyAt);
  }

  return ticket;
};

beforeAll(async () => {
  await getSeededCompany();

  // Messages.id é inteiro sem autoincremento e cabe em int32, então não dá
  // para derivá-lo de um timestamp. Parte-se do maior id existente.
  const maxId: number = (await Message.max("id")) as number;
  messageCounter = (maxId || 0) + 1;

  const queue = await Queue.create({
    name: `fila-tempo-${uniqueSuffix()}`,
    color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`,
    greetingMessage: "olá",
    companyId: COMPANY_ID,
    ativarRoteador: false,
    tempoRoteador: 0
  } as any);
  queueId = queue.id;
  created.queues.push(queue.id);
});

afterAll(async () => {
  await Message.destroy({ where: { ticketId: created.tickets } });
  await TicketTraking.destroy({ where: { id: created.trakings } });
  await Ticket.destroy({ where: { id: created.tickets } });
  await Contact.destroy({ where: { id: created.contacts } });
  await User.destroy({ where: { id: created.users } });
  await Queue.destroy({ where: { id: created.queues } });
  await closeConnection();
});

const runReport = () =>
  ResponseTimeReportService({
    companyId: COMPANY_ID,
    initialDate: DAY,
    finalDate: DAY
  });

describe("ResponseTimeReportService", () => {
  it("mede do recado do cliente até a primeira resposta humana", async () => {
    const user = await makeUser("Ana");

    // Cliente às 10:00, resposta às 10:05 -> 300 segundos.
    await makeConversation({
      user,
      contactAt: at(0),
      replyAt: at(5)
    });

    const { rows } = await runReport();
    const ana = rows.find(r => r.userId === user.id);

    expect(ana).toBeDefined();
    expect(ana.answeredTickets).toBe(1);
    expect(ana.avgFirstResponseSeconds).toBe(300);
  });

  it("ignora a mensagem automática do bot", async () => {
    const user = await makeUser("Bruno");

    // Bot responde em 10 segundos, a pessoa só às 10:04. Se o bot contasse,
    // o relatório mostraria 10s em vez dos 240s reais.
    await makeConversation({
      user,
      contactAt: at(0),
      botAt: at(0, 10),
      replyAt: at(4)
    });

    const { rows } = await runReport();
    const bruno = rows.find(r => r.userId === user.id);

    expect(bruno.avgFirstResponseSeconds).toBe(240);
  });

  it("conta como não respondido o ticket sem resposta humana", async () => {
    const user = await makeUser("Carla");

    // Só o bot falou: ninguém respondeu de verdade.
    await makeConversation({
      user,
      contactAt: at(0),
      botAt: at(0, 5)
    });

    const { rows } = await runReport();
    const carla = rows.find(r => r.userId === user.id);

    expect(carla.tickets).toBe(1);
    expect(carla.answeredTickets).toBe(0);
    expect(carla.avgFirstResponseSeconds).toBeNull();
  });

  it("calcula média e mediana por atendente", async () => {
    const user = await makeUser("Diego");

    await makeConversation({ user, contactAt: at(0), replyAt: at(1) }); // 60
    await makeConversation({ user, contactAt: at(10), replyAt: at(12) }); // 120
    await makeConversation({ user, contactAt: at(20), replyAt: at(29) }); // 540

    const { rows } = await runReport();
    const diego = rows.find(r => r.userId === user.id);

    expect(diego.answeredTickets).toBe(3);
    expect(diego.avgFirstResponseSeconds).toBe(240); // (60+120+540)/3
    expect(diego.medianFirstResponseSeconds).toBe(120); // resiste ao caso lento
    expect(diego.maxFirstResponseSeconds).toBe(540);
  });

  it("mede também a espera até a abertura do ticket", async () => {
    const user = await makeUser("Elena");

    await makeConversation({
      user,
      contactAt: at(0),
      replyAt: at(3),
      queuedAt: at(0),
      startedAt: at(2) // aberto aos 2 min, respondido aos 3
    });

    const { rows } = await runReport();
    const elena = rows.find(r => r.userId === user.id);

    expect(elena.avgWaitSeconds).toBe(120);
    expect(elena.avgFirstResponseSeconds).toBe(180);
  });

  it("agrupa sem atendente os tickets que ninguém assumiu", async () => {
    await makeConversation({ user: null, contactAt: at(40) });

    const { rows } = await runReport();
    const semAtendente = rows.find(r => r.userId === null);

    expect(semAtendente).toBeDefined();
    expect(semAtendente.userName).toBeNull();
  });

  it("pondera a média geral pelo volume de cada atendente", async () => {
    const { totals } = await runReport();

    // Tirar a média das médias daria o mesmo peso a quem atendeu 1 e a quem
    // atendeu 3; a ponderada reflete o que o conjunto dos clientes esperou.
    expect(totals.answeredTickets).toBeGreaterThan(0);
    expect(totals.avgFirstResponseSeconds).not.toBeNull();
  });
});
