import { Mutex } from "async-mutex";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import CreateOrUpdateContactService, {
  updateContact
} from "../ContactServices/CreateOrUpdateContactService";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import { proto, WASocket } from "@whiskeysockets/baileys";
import WhatsappLidMap from "../../models/WhatsapplidMap";
import GetProfilePicUrl from "./GetProfilePicUrl";
import CreateOrUpdateContactServiceDefault from "../ContactServices/CreateOrUpdateContactService";
import { esFotoVacia, soloDigitos } from "../../helpers/LidTelefono";
import logger from "../../utils/logger";

const lidUpdateMutex = new Mutex();

export type Session = WASocket & {
  id?: number;
  myJid?: string;
  myLid?: string;
  cacheMessage?: (msg: proto.IWebMessageInfo) => void;
  isRefreshing?: boolean;
};

interface IMe {
  name: string;
  id: string;
  /**
   * Telefono real del contacto, en digitos, cuando el mensaje llega
   * direccionado por LID y WhatsApp lo adjunta (key.senderPn). Sin esto el
   * LID se guardaba como si fuera el numero.
   */
  pn?: string;
}

/**
 * Un intento de foto por contacto y por hora. La consulta va por la red, y
 * sin freno se haria en CADA mensaje de CADA contacto sin foto. En memoria a
 * proposito: al reiniciar se vuelve a intentar, que es justo lo que interesa
 * despues de un despliegue.
 */
const intentosFoto = new Map<number, number>();
const ESPERA_ENTRE_INTENTOS = 60 * 60 * 1000;

/**
 * La foto solo se pide si el contacto no tiene ninguna. Antes ni se pedia: la
 * llamada estaba comentada aqui y la de CreateOrUpdateContactService recibia
 * un socket sin definir, asi que siempre caia en el catch y guardaba
 * nopicture.png. Resultado: 0 de 55 contactos con foto.
 */
const asegurarFoto = async (
  contacto: Contact,
  identificador: string,
  companyId: number,
  wbot: Session
): Promise<Contact> => {
  if (!contacto || contacto.isGroup) return contacto;
  if (!esFotoVacia(contacto.profilePicUrl) && contacto.urlPicture) {
    return contacto;
  }

  const ultimo = intentosFoto.get(contacto.id) || 0;
  if (Date.now() - ultimo < ESPERA_ENTRE_INTENTOS) return contacto;
  intentosFoto.set(contacto.id, Date.now());

  try {
    const url = await GetProfilePicUrl(identificador, companyId, contacto);
    if (esFotoVacia(url)) return contacto;

    // Se pasa por el servicio de siempre para que descargue la imagen a
    // public/companyN/contacts, que es de donde la lee el frontend.
    return await CreateOrUpdateContactServiceDefault({
      name: contacto.name,
      number: contacto.number,
      profilePicUrl: url,
      isGroup: contacto.isGroup,
      companyId,
      wbot
    } as any);
  } catch (e) {
    logger.warn(`[LID] No se pudo traer la foto de ${identificador}: ${(e as Error).message}`);
    return contacto;
  }
};

export async function checkAndDedup(
  contact: Contact,
  lid: string
): Promise<void> {
  const lidContact = await Contact.findOne({
    where: {
      companyId: contact.companyId,
      number: {
        [Op.or]: [lid, lid.substring(0, lid.indexOf("@"))]
      }
    }
  });

  if (!lidContact) {
    return;
  }

  await Message.update(
    { contactId: contact.id },
    {
      where: {
        contactId: lidContact.id,
        companyId: contact.companyId
      }
    }
  );

  const notClosedTickets = await Ticket.findAll({
    where: {
      contactId: lidContact.id,
      status: {
        [Op.not]: "closed"
      }
    }
  });

  // eslint-disable-next-line no-restricted-syntax
  for (const ticket of notClosedTickets) {
    // eslint-disable-next-line no-await-in-loop
    await UpdateTicketService({
      ticketData: { status: "closed" },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });
  }

  await Ticket.update(
    { contactId: contact.id },
    {
      where: {
        contactId: lidContact.id,
        companyId: contact.companyId
      }
    }
  );

  await lidContact.destroy();
}

/** Deja constancia de que ese LID es ese contacto, una sola vez. */
const mapearLid = async (
  contacto: Contact,
  lid: string,
  companyId: number
): Promise<void> => {
  if (!contacto || !lid) return;

  if (contacto.lid !== lid) {
    await contacto.update({ lid });
  }

  const yaMapeado = await WhatsappLidMap.findOne({ where: { companyId, lid } });
  if (!yaMapeado) {
    await WhatsappLidMap.create({ companyId, lid, contactId: contacto.id } as any);
  }
};

export async function verifyContact(
  msgContact: IMe,
  wbot: Session,
  companyId: number
): Promise<Contact> {
  const contacto = await resolverContacto(msgContact, wbot, companyId);

  if (msgContact.pn && msgContact.id.includes("@lid")) {
    await mapearLid(contacto, soloDigitos(msgContact.id), companyId);
  }

  const identificador = msgContact.pn
    ? `${msgContact.pn}@s.whatsapp.net`
    : msgContact.id;

  return asegurarFoto(contacto, identificador, companyId, wbot);
}

async function resolverContacto(
  msgContact: IMe,
  wbot: Session,
  companyId: number
): Promise<Contact> {
  let profilePicUrl: string;
  
  // try {
  //   profilePicUrl = await wbot.profilePictureUrl(msgContact.id);
  // } catch (e) {
  //   profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
  // }

  const isLid = msgContact.id.includes("@lid");
  const isGroup = msgContact.id.includes("@g.us");

  // El LID que trae el mensaje, en digitos, para dejarlo mapeado al contacto.
  const lidDelMensaje = isLid ? soloDigitos(msgContact.id) : "";

  // Cuando el mensaje llega por LID pero trae el telefono, el numero del
  // contacto es el telefono. Antes se guardaba el JID entero del LID
  // ("257720267587711@lid") en el campo del numero, y de ahi salian los
  // nombres de 15 digitos de la lista y la imposibilidad de llamar.
  const number = isLid
    ? msgContact.pn || msgContact.id
    : msgContact.id.substring(0, msgContact.id.indexOf("@"));

  // Para la foto se prefiere el telefono: la consulta contra un @lid es la
  // que venia fallando.
  const identificadorFoto = msgContact.pn
    ? `${msgContact.pn}@s.whatsapp.net`
    : msgContact.id;

  const contactData = {
    // Sin pushName se cae al numero. Con el cambio de arriba ese numero ya es
    // el telefono cuando se conoce, no los 15 digitos del LID.
    name: msgContact?.name || soloDigitos(number),
    number,
    profilePicUrl,
    isGroup: msgContact.id.includes("g.us"),
    companyId,
    lid: lidDelMensaje || undefined
  };

  if (isGroup) {
    return CreateOrUpdateContactService(contactData);
  }

  return lidUpdateMutex.runExclusive(async () => {
    const foundContact = await Contact.findOne({
      where: {
        companyId,
        number
      },
      include: ["tags", "extraInfo", "whatsappLidMap"]
    });

    if (isLid) {
      if (foundContact) {
        return updateContact(foundContact, {
          profilePicUrl: contactData.profilePicUrl
        });
      }

      const foundMappedContact = await WhatsappLidMap.findOne({
        where: {
          companyId,
          lid: number
        },
        include: [
          {
            model: Contact,
            as: "contact",
            include: ["tags", "extraInfo"]
          }
        ]
      });

      if (foundMappedContact) {
        return updateContact(foundMappedContact.contact, {
          profilePicUrl: contactData.profilePicUrl
        });
      }

      const partialLidContact = await Contact.findOne({
        where: {
          companyId,
          number: number.substring(0, number.indexOf("@"))
        },
        include: ["tags", "extraInfo"]
      });

      if (partialLidContact) {
        return updateContact(partialLidContact, {
          number: contactData.number,
          profilePicUrl: contactData.profilePicUrl
        });
      }
    } else if (foundContact) {
      if (!foundContact.whatsappLidMap) {
        const ow = await wbot.onWhatsApp(msgContact.id);
        if (!ow?.[0]?.exists) {
          throw new Error("ERR_WAPP_CONTACT_NOT_FOUND");
        }
        const lid = ow?.[0]?.lid as string;
        if (lid) {
          await checkAndDedup(foundContact, lid);
          await WhatsappLidMap.create({
            companyId,
            lid,
            contactId: foundContact.id
          });
        }
      }
      return updateContact(foundContact, {
        profilePicUrl: contactData.profilePicUrl
      });
    } else if (!isGroup && !foundContact) {
      const ow = await wbot.onWhatsApp(msgContact.id);
      if (!ow?.[0]?.exists) {
        throw new Error("ERR_WAPP_CONTACT_NOT_FOUND");
      }
      const lid = ow?.[0]?.lid as string;

      if (lid) {
        const lidContact = await Contact.findOne({
          where: {
            companyId,
            number: {
              [Op.or]: [lid, lid.substring(0, lid.indexOf("@"))]
            }
          },
          include: ["tags", "extraInfo"]
        });

        if (lidContact) {
          await WhatsappLidMap.create({
            companyId,
            lid,
            contactId: lidContact.id
          });
          return updateContact(lidContact, {
            number: contactData.number,
            profilePicUrl: contactData.profilePicUrl
          });
        }
      }
    }

    return CreateOrUpdateContactService(contactData);
  });
}
