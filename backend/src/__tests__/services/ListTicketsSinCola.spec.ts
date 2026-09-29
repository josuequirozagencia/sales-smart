import Company from "../../models/Company";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import ListTicketsService from "../../services/TicketServices/ListTicketsService";
import { closeConnection, uniqueSuffix } from "../helpers/db";

// Un ticket sin cola no es de nadie, y hasta ahora solo lo veia quien tuviera
// marcada la casilla allTicket. En la Empresa 1 eso dejo seis tickets con
// mensajes reales invisibles: una conexion sin cola los creaba sin asignar, y
// el Inbox mostraba cero mientras los clientes esperaban.
//
// Lo que se prueba aqui es que un administrador los ve aunque nadie haya
// marcado nada, y que para el perfil "user" la casilla sigue decidiendo.

const sufijo = uniqueSuffix();

let empresa: Company;
let cola: Queue;
let admin: User;
let asesora: User;
let ticketSinCola: Ticket;
let ticketConCola: Ticket;

const listar = (usuario: User) =>
  ListTicketsService({
    userId: usuario.id,
    companyId: empresa.id,
    status: "pending",
    queueIds: [cola.id],
    tags: [],
    users: []
  });

beforeAll(async () => {
  empresa = await Company.create({
    name: `sin-cola-${sufijo}`,
    planId: 1,
    status: true
  } as any);

  cola = await Queue.create({
    name: `cola-${sufijo}`,
    color: `#${sufijo.slice(-6)}`,
    companyId: empresa.id,
    orderQueue: 1,
    // Ambos son NOT NULL en el modelo y no tienen valor por defecto.
    ativarRoteador: false,
    tempoRoteador: 0
  } as any);

  // Los dos con la casilla apagada: es el estado con el que nacen y el que
  // dejo los tickets invisibles.
  admin = await User.create({
    name: `admin-${sufijo}`,
    email: `admin-${sufijo}@prueba.local`,
    passwordHash: "x",
    profile: "admin",
    allTicket: "disable",
    companyId: empresa.id
  } as any);

  asesora = await User.create({
    name: `asesora-${sufijo}`,
    email: `asesora-${sufijo}@prueba.local`,
    passwordHash: "x",
    profile: "user",
    allTicket: "disable",
    companyId: empresa.id
  } as any);

  const contacto = await Contact.create({
    name: `contacto-${sufijo}`,
    number: `593${sufijo}`.slice(0, 13),
    companyId: empresa.id
  } as any);

  ticketSinCola = await Ticket.create({
    status: "pending",
    companyId: empresa.id,
    contactId: contacto.id,
    queueId: null,
    isGroup: false
  } as any);

  ticketConCola = await Ticket.create({
    status: "pending",
    companyId: empresa.id,
    contactId: contacto.id,
    queueId: cola.id,
    isGroup: false
  } as any);
});

afterAll(async () => {
  await Ticket.destroy({ where: { companyId: empresa.id } });
  await Contact.destroy({ where: { companyId: empresa.id } });
  await User.destroy({ where: { companyId: empresa.id } });
  await Queue.destroy({ where: { companyId: empresa.id } });
  await Company.destroy({ where: { id: empresa.id } });
  await closeConnection();
});

describe("tickets sin cola en el listado", () => {
  it("un administrador los ve sin que nadie marque la casilla", async () => {
    const { tickets } = await listar(admin);
    const ids = tickets.map(t => t.id);

    expect(ids).toContain(ticketSinCola.id);
  });

  it("y sigue viendo los de su cola", async () => {
    const { tickets } = await listar(admin);
    const ids = tickets.map(t => t.id);

    expect(ids).toContain(ticketConCola.id);
  });

  it("a una asesora la casilla le sigue decidiendo", async () => {
    const { tickets } = await listar(asesora);
    const ids = tickets.map(t => t.id);

    expect(ids).not.toContain(ticketSinCola.id);
    expect(ids).toContain(ticketConCola.id);
  });

  it("con la casilla marcada, la asesora tambien los ve", async () => {
    await asesora.update({ allTicket: "enable" });

    const { tickets } = await listar(asesora);
    const ids = tickets.map(t => t.id);

    expect(ids).toContain(ticketSinCola.id);

    await asesora.update({ allTicket: "disable" });
  });

  it("no se trae tickets de otras empresas", async () => {
    // El servicio no selecciona companyId, asi que se comprueba por los ids:
    // los unicos que pueden salir son los dos de esta empresa.
    const { tickets } = await listar(admin);
    const mios = [ticketSinCola.id, ticketConCola.id];

    expect(tickets.every(t => mios.includes(t.id))).toBe(true);
  });
});
