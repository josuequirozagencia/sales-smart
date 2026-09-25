import Tag from "../../models/Tag";
import Contact from "../../models/Contact";
import ContactTag from "../../models/ContactTag";
import ShowContactService from "../ContactServices/ShowContactService";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import Ticket from "../../models/Ticket";
import { Op } from "sequelize";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { getIO } from "../../libs/socket";
import { sincronizarEtiquetasContacto } from "../GhlServices/SyncGhlTags";

interface Request {
  tags: Tag[];
  contactId: number;
  companyId: number;
}

const SyncTags = async ({
  tags,
  contactId,
  companyId
}: Request): Promise<Contact | null> => {

  const tagList = tags.map(t => ({ tagId: t.id, contactId }));

  // Que habia antes, para saber que cambio de verdad.
  //
  // Este servicio reemplaza el juego entero de etiquetas: borra todas y
  // vuelve a crearlas. Sin comparar antes y despues, el espejo hacia GHL
  // tendria que quitar y volver a poner todas en cada guardado, lo que son
  // dos llamadas de red por etiqueta que no cambio.
  const previas = await ContactTag.findAll({ where: { contactId } });
  const antes = previas.map(p => p.tagId);
  const despues = tags.map(t => t.id);

  const anadidas = despues.filter(id => !antes.includes(id));
  const quitadas = antes.filter(id => !despues.includes(id));

  await ContactTag.destroy({ where: { contactId } });
  await ContactTag.bulkCreate(tagList);

  if (anadidas.length || quitadas.length) {
    const contactoGhl = await Contact.findByPk(contactId);
    // Sin await: el guardado de etiquetas no espera a un tercero.
    if (anadidas.length) {
      sincronizarEtiquetasContacto(contactoGhl, anadidas, "add").catch(() => {});
    }
    if (quitadas.length) {
      sincronizarEtiquetasContacto(contactoGhl, quitadas, "remove").catch(() => {});
    }
  }

  const contact = await ShowContactService(contactId, companyId);

  const _ticket = await Ticket.findOne({ where: { contactId, status: { [Op.or]: ["open", "group"] } } });

  if (_ticket) {
    const ticket = await ShowTicketService(_ticket?.id, companyId);

    const io = getIO();
    io.of(String(companyId))
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });
  }

  return contact;
};

export default SyncTags;
