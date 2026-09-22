import Company from "../../models/Company";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import WhatsappLidMap from "../../models/WhatsapplidMap";
import { repararContactosLid } from "../../services/ContactServices/RepararContactosLid";
import { closeConnection, uniqueSuffix } from "../helpers/db";

// Reparacion de los contactos a los que se les guardo el LID en el campo del
// numero. El telefono sale del historial de mensajes, no de WhatsApp.
//
// Lo que mas importa probar es lo que NO debe hacer: no inventar telefonos
// cuando el historial no los tiene, y no pisar la ficha de otro contacto que
// ya tenga ese numero.

let empresa: Company;
let ticket: Ticket;
let idMensaje = Date.now() % 1000000000;

const crearContactoLid = async (lid: string, nombre?: string) =>
  Contact.create({
    name: nombre || lid,
    number: `${lid}@lid`,
    companyId: empresa.id,
    profilePicUrl: "http://localhost:3000/nopicture.png"
  } as any);

const crearMensajeCon = async (lid: string, telefono: string) => {
  idMensaje += 1;
  return Message.create({
    id: idMensaje,
    body: "hola",
    ack: 1,
    read: true,
    fromMe: false,
    isDeleted: false,
    ticketId: ticket.id,
    companyId: empresa.id,
    dataJson: JSON.stringify({
      key: {
        remoteJid: `${lid}@lid`,
        fromMe: false,
        id: `X${idMensaje}`,
        senderPn: `${telefono}@s.whatsapp.net`
      }
    })
  } as any);
};

beforeAll(async () => {
  empresa = await Company.create({
    name: `lid-${uniqueSuffix()}`,
    planId: 1,
    status: true
  } as any);

  const contactoTicket = await Contact.create({
    name: "soporte del ticket",
    number: `9${uniqueSuffix()}`.slice(0, 12),
    companyId: empresa.id
  } as any);

  ticket = await Ticket.create({
    status: "open",
    companyId: empresa.id,
    contactId: contactoTicket.id
  } as any);
});

afterAll(async () => {
  await Message.destroy({ where: { companyId: empresa.id } });
  await WhatsappLidMap.destroy({ where: { companyId: empresa.id } });
  await Ticket.destroy({ where: { companyId: empresa.id } });
  await Contact.destroy({ where: { companyId: empresa.id } });
  await Company.destroy({ where: { id: empresa.id } });
  await closeConnection();
});

describe("repararContactosLid", () => {
  it("devuelve el telefono, mapea el LID y deja la foto por reintentar", async () => {
    const lid = "262934307541069";
    const telefono = "593986567051";
    const contacto = await crearContactoLid(lid);
    await crearMensajeCon(lid, telefono);

    const resultado = await repararContactosLid(empresa.id);

    expect(resultado.reparados).toBe(1);

    await contacto.reload();
    expect(contacto.number).toBe(telefono);
    expect(contacto.lid).toBe(lid);
    // El nombre era el propio identificador: pasa a ser el telefono, que al
    // menos es un dato que el asesor reconoce.
    expect(contacto.name).toBe(telefono);
    // Null, no el nopicture: asi el siguiente intento vuelve a pedir la foto.
    expect(contacto.profilePicUrl).toBeNull();

    const mapeo = await WhatsappLidMap.findOne({
      where: { companyId: empresa.id, lid }
    });
    expect(mapeo?.contactId).toBe(contacto.id);
  });

  it("no toca el nombre si era un nombre de verdad", async () => {
    const lid = "49912569958582";
    const contacto = await crearContactoLid(lid, "Alexandra Estrada");
    await crearMensajeCon(lid, "593911111111");

    await repararContactosLid(empresa.id);

    await contacto.reload();
    expect(contacto.number).toBe("593911111111");
    expect(contacto.name).toBe("Alexandra Estrada");
  });

  it("deja en paz al contacto cuyo telefono no esta en el historial", async () => {
    const contacto = await crearContactoLid("777777777777777");

    const resultado = await repararContactosLid(empresa.id);

    expect(resultado.sinTelefono).toBeGreaterThanOrEqual(1);
    await contacto.reload();
    expect(contacto.number).toBe("777777777777777@lid");
  });

  it("no pisa la ficha de otro contacto que ya tenga ese telefono", async () => {
    const telefono = "593922222222";
    const existente = await Contact.create({
      name: "Ficha buena",
      number: telefono,
      companyId: empresa.id
    } as any);

    const lid = "888888888888888";
    const duplicado = await crearContactoLid(lid);
    await crearMensajeCon(lid, telefono);

    const resultado = await repararContactosLid(empresa.id);

    expect(resultado.telefonoOcupado).toBeGreaterThanOrEqual(1);

    await duplicado.reload();
    await existente.reload();
    expect(duplicado.number).toBe(`${lid}@lid`);
    expect(existente.name).toBe("Ficha buena");
  });

  it("se puede volver a pasar sin repetir el mapeo", async () => {
    const primera = await repararContactosLid(empresa.id);
    const segunda = await repararContactosLid(empresa.id);

    expect(segunda.reparados).toBe(0);
    expect(primera.revisados).toBeGreaterThanOrEqual(segunda.revisados);

    const mapeos = await WhatsappLidMap.findAll({
      where: { companyId: empresa.id, lid: "262934307541069" }
    });
    expect(mapeos).toHaveLength(1);
  });
});
