import Contact from "../../models/Contact";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import logger from "../../utils/logger";
import { buscarIntegracion } from "./GhlConfigService";
import { clienteDeEmpresa, anadirEtiquetas, quitarEtiquetas } from "./GhlApiClient";
import { resolverContactoGhl } from "./SendGhlMessage";
import { CANAL } from "./ReceiveGhlMessageService";

/**
 * Espejo de etiquetas hacia GoHighLevel.
 *
 * NUNCA lanza. Una etiqueta es una accion secundaria: si GHL esta caido o
 * el token caducado, el asesor debe poder seguir etiquetando en ChatIA y
 * enterarse por el log, no ver un error rojo a mitad de su trabajo. Por lo
 * mismo se llama sin esperar (`.catch(() => {})`) desde los controladores.
 *
 * GHL no tiene colores en sus etiquetas: solo el nombre. Se manda el
 * nombre y el color se queda en ChatIA, que es donde existe.
 */

/** ¿Esta empresa tiene el canal encendido? Evita llamadas inutiles. */
const hayCanalGhl = async (companyId: number): Promise<boolean> => {
  const fila = await buscarIntegracion(companyId);
  return Boolean(fila?.isActive);
};

/**
 * Contacto de GHL al que aplicar la etiqueta.
 *
 * Devuelve null cuando no procede sincronizar: contacto de otro canal,
 * empresa sin GHL, o contacto que no se pudo dar de alta alli.
 */
const prepararContacto = async (
  contact: Contact
): Promise<{ cliente: any; contactIdGhl: string } | null> => {
  if (!contact) return null;

  if (!(await hayCanalGhl(contact.companyId))) return null;

  const cliente = await clienteDeEmpresa(contact.companyId);
  const contactIdGhl = await resolverContactoGhl(cliente, contact);

  return contactIdGhl ? { cliente, contactIdGhl } : null;
};

const nombresDeEtiquetas = async (tagIds: number[]): Promise<string[]> => {
  if (!tagIds.length) return [];
  const tags = await Tag.findAll({ where: { id: tagIds } });
  return tags.map(t => t.name).filter(Boolean);
};

/** Aplica un cambio de etiquetas sobre el contacto de GHL. */
export const sincronizarEtiquetasContacto = async (
  contact: Contact,
  tagIds: number[],
  accion: "add" | "remove"
): Promise<void> => {
  try {
    const preparado = await prepararContacto(contact);
    if (!preparado) return;

    const nombres = await nombresDeEtiquetas(tagIds);
    if (!nombres.length) return;

    const ok =
      accion === "add"
        ? await anadirEtiquetas(preparado.cliente, preparado.contactIdGhl, nombres)
        : await quitarEtiquetas(preparado.cliente, preparado.contactIdGhl, nombres);

    if (ok) {
      logger.info(
        `[GHL] etiquetas ${accion} en contacto ${contact.id}: ${nombres.join(", ")}`
      );
    }
  } catch (err) {
    // Incluye el caso de empresa sin credenciales, que obtenerCredenciales
    // lanza. No es un fallo: es que ese contacto no va por GHL.
    logger.warn(`[GHL] sincronizacion de etiquetas omitida: ${err.message}`);
  }
};

/**
 * Igual, pero partiendo de un ticket.
 *
 * Solo sincroniza si el ticket es de canal GHL: etiquetar un ticket de
 * WhatsApp normal no debe tocar nada en GHL aunque la empresa lo tenga
 * configurado.
 */
export const sincronizarEtiquetasTicket = async (
  ticketId: number | string,
  tagIds: number[],
  accion: "add" | "remove"
): Promise<void> => {
  try {
    const ticket = await Ticket.findByPk(ticketId, { include: ["contact"] });
    if (!ticket || ticket.channel !== CANAL) return;

    await sincronizarEtiquetasContacto(ticket.contact, tagIds, accion);
  } catch (err) {
    logger.warn(`[GHL] sincronizacion de etiquetas del ticket omitida: ${err.message}`);
  }
};

export default { sincronizarEtiquetasContacto, sincronizarEtiquetasTicket };
