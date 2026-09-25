import { Op } from "sequelize";
import Contact from "../../models/Contact";
import ContactTag from "../../models/ContactTag";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";

/**
 * Etiquetas de GoHighLevel hacia Sales Smart: el sentido inverso de
 * SyncGhlTags.
 *
 * DE DONDE SALE EL EVENTO
 * -----------------------
 * El evento ContactTagUpdate de GHL solo lo pueden recibir las apps OAuth
 * del Marketplace: la suscripcion se activa en los ajustes de webhooks de
 * la app, y un Private Integration Token —que es lo que usa este canal— no
 * tiene esa opcion. La via que queda es un Workflow con el disparador
 * "Contact Tag" (salta al poner y al quitar) y una accion "Webhook" que
 * apunta a la misma URL que los mensajes, con dos datos personalizados:
 *
 *   ghl_event  = tag_update        (marca el evento como de etiquetas)
 *   contact_id = {{contact.id}}    (a quien se refiere)
 *
 * Se pide `contact_id` explicito porque la ayuda de GHL no documenta que el
 * webhook de un Workflow lo mande por defecto, y aqui no se da por hecho un
 * formato que no esta escrito. Por lo mismo, los datos personalizados se
 * leen tanto dentro de `customData` como en la raiz del cuerpo, y `tags`
 * se acepta como lista o como texto separado por comas.
 *
 * Si algun dia el canal pasa a ser una app del Marketplace, el formato
 * ContactTagUpdate tambien se entiende: su esquema si esta documentado
 * (`type`, `id` del contacto, `tags` como lista).
 *
 * QUE CAMBIO
 * ----------
 * En ninguno de los dos formatos dice GHL que etiqueta se puso o se quito:
 * manda la lista COMPLETA de las que tiene el contacto ahora. Lo que cambio
 * se saca comparandola con la anterior, que se guarda en
 * Contact.ghlTagsSnapshot.
 *
 * Esa comparacion es lo que protege las etiquetas que solo existen en
 * Sales Smart. La alternativa, dejar el contacto con exactamente las
 * etiquetas de GHL, borraria las puestas antes de conectar GHL y las que no
 * llegaron a espejarse porque GHL estaba caido. Por la misma razon, el
 * PRIMER evento de un contacto —sin lista anterior— solo anade: no hay con
 * que comparar para saber que quito GHL.
 *
 * DECISIONES
 * ----------
 * - Una etiqueta de GHL sin equivalente en Sales Smart se IGNORA y se deja
 *   en el log; no se crea. Crearla dejaria a cualquier automatizacion de GHL
 *   que genere etiquetas llenar el catalogo de todas las empresas, y el
 *   catalogo de etiquetas lo gestiona cada empresa aqui.
 * - Solo se tocan etiquetas de CONTACTO (kanban 0). Las etapas del Kanban
 *   (kanban 1) son de ticket y no se mueven desde GHL: una etiqueta de GHL
 *   que se llame como una etapa no cambia el embudo de nadie.
 * - Se compara por nombre EXACTO. Las etiquetas de GHL distinguen
 *   mayusculas, y el espejo en el otro sentido ya manda los nombres tal cual.
 * - Se escribe directamente en ContactTag, NUNCA a traves de
 *   SyncTagsService ni de los controladores: esos espejan hacia GHL, y el
 *   cambio volveria a GHL, que volveria a disparar el Workflow. Asi no hay
 *   bucle. Y aunque lo hubiera, el eco que devuelve GHL tras un cambio hecho
 *   aqui llega sin diferencias y no hace nada.
 *
 * Como el resto del modulo, NUNCA lanza: cualquier fallo se devuelve como
 * motivo y el controlador lo deja en el log. GHL recibe su 200 igual.
 */

/** Clave de dato personalizado que marca el webhook como de etiquetas. */
export const CLAVE_MARCA = "ghl_event";
export const VALOR_MARCA = "tag_update";

/** Tipo del evento equivalente de las apps del Marketplace. */
export const TIPO_MARKETPLACE = "ContactTagUpdate";

/** Los datos personalizados del Workflow, si vienen agrupados. */
const datosPersonalizados = (evento: any): any =>
  evento && evento.customData && typeof evento.customData === "object"
    ? evento.customData
    : {};

/**
 * Valor de una clave, venga dentro de `customData` o en la raiz.
 *
 * La ayuda de GHL explica como anadir datos personalizados a la accion
 * Webhook pero no en que parte del cuerpo aparecen, asi que se miran las
 * dos antes que dar una por buena.
 */
const leerClave = (evento: any, clave: string): any => {
  const propios = datosPersonalizados(evento);
  if (propios[clave] !== undefined) return propios[clave];
  return evento ? evento[clave] : undefined;
};

/** ¿Es un evento de etiquetas y no de mensaje? */
export const esEventoDeEtiquetas = (evento: any): boolean => {
  if (!evento || typeof evento !== "object") return false;
  if (evento.type === TIPO_MARKETPLACE) return true;
  return String(leerClave(evento, CLAVE_MARCA) || "").trim() === VALOR_MARCA;
};

/**
 * Etiquetas actuales del contacto segun GHL.
 *
 * Devuelve null cuando el evento NO trae el campo, y [] cuando lo trae
 * vacio. No es lo mismo: lo primero es "no se sabe nada" y no debe borrar
 * nada; lo segundo es "el contacto se quedo sin etiquetas". Confundirlos
 * haria que un Workflow mal montado vaciara los contactos.
 */
export const leerEtiquetas = (evento: any): string[] | null => {
  const crudo = leerClave(evento, "tags");
  if (crudo === undefined || crudo === null) return null;

  let lista: any[] = null;
  if (Array.isArray(crudo)) lista = crudo;
  else if (typeof crudo === "string") lista = crudo.split(",");
  if (!lista) return null;

  const limpias = lista
    .map(t => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean);

  return Array.from(new Set(limpias));
};

/** Identificador del contacto en GHL. */
export const leerContactoGhl = (evento: any): string => {
  const candidatos =
    evento && evento.type === TIPO_MARKETPLACE
      ? [evento.id, evento.contactId]
      : [
          leerClave(evento, "contact_id"),
          leerClave(evento, "contactId"),
          evento?.contact?.id
        ];

  for (const c of candidatos) {
    if (typeof c === "string" && c.trim() !== "") return c.trim();
  }
  return "";
};

const leerInstantanea = (texto: string): string[] | null => {
  if (!texto) return null;
  try {
    const valor = JSON.parse(texto);
    return Array.isArray(valor)
      ? valor.filter(v => typeof v === "string")
      : null;
  } catch (err) {
    // Una instantanea corrupta se trata como "no hay": el siguiente evento
    // solo anadira, que es lo prudente.
    return null;
  }
};

/** Etiquetas de contacto de la empresa con esos nombres. Nunca etapas. */
const etiquetasDeContacto = async (
  companyId: number,
  nombres: string[]
): Promise<Tag[]> => {
  if (!nombres.length) return [];
  return Tag.findAll({
    where: {
      companyId,
      name: nombres,
      [Op.or]: [{ kanban: 0 }, { kanban: null }]
    }
  });
};

/**
 * Refresca la pantalla del asesor.
 *
 * Igual que SyncTagsService, que es el precedente de "cambiaron las
 * etiquetas de un contacto": se reenvia el ticket abierto de ese contacto,
 * que es de donde el panel de contacto lee las etiquetas. Se incluye
 * "pending" porque los tickets de GHL suelen estarlo mientras nadie los
 * acepta.
 */
const avisarPantalla = async (contactId: number, companyId: number) => {
  const abierto = await Ticket.findOne({
    where: {
      contactId,
      companyId,
      status: { [Op.or]: ["open", "group", "pending"] }
    },
    order: [["id", "DESC"]]
  });

  if (!abierto) return;

  const ticket = await ShowTicketService(abierto.id, companyId);
  getIO()
    .of(String(companyId))
    .emit(`company-${companyId}-ticket`, { action: "update", ticket });
};

export interface ResultadoEtiquetas {
  atendido: boolean;
  motivo?: string;
}

const ReceiveGhlTagEventService = async (
  companyId: number,
  evento: any
): Promise<ResultadoEtiquetas> => {
  try {
    const contactIdGhl = leerContactoGhl(evento);
    if (!contactIdGhl) {
      return {
        atendido: false,
        motivo: "evento de etiquetas sin contact_id (revisa los datos personalizados del Workflow)"
      };
    }

    const actuales = leerEtiquetas(evento);
    if (actuales === null) {
      return {
        atendido: false,
        motivo: `evento de etiquetas sin campo tags (contacto ${contactIdGhl}); no se toca nada`
      };
    }

    // Mismo criterio que la entrada de mensajes: por identificador de GHL.
    // Un evento de etiquetas no crea contactos: si GHL etiqueta a alguien
    // que nunca escribio, aqui no hay ficha que actualizar.
    const contact = await Contact.findOne({
      where: { ghlContactId: contactIdGhl, companyId }
    });

    if (!contact) {
      return {
        atendido: false,
        motivo: `contacto ${contactIdGhl} no fichado en Sales Smart`
      };
    }

    const previas = leerInstantanea(contact.ghlTagsSnapshot);

    const anadidas =
      previas === null ? actuales : actuales.filter(t => !previas.includes(t));
    const quitadas =
      previas === null ? [] : previas.filter(t => !actuales.includes(t));

    const [paraAnadir, paraQuitar] = await Promise.all([
      etiquetasDeContacto(companyId, anadidas),
      etiquetasDeContacto(companyId, quitadas)
    ]);

    for (const tag of paraAnadir) {
      await ContactTag.findOrCreate({
        where: { contactId: contact.id, tagId: tag.id }
      });
    }

    if (paraQuitar.length) {
      await ContactTag.destroy({
        where: { contactId: contact.id, tagId: paraQuitar.map(t => t.id) }
      });
    }

    // La instantanea se guarda SIEMPRE, se haya aplicado algo o no: es la
    // foto de GHL, no la de Sales Smart. Si guardara solo lo aplicado, una
    // etiqueta ignorada volveria a aparecer como "nueva" en cada evento.
    await contact.update({ ghlTagsSnapshot: JSON.stringify(actuales) });

    if (paraAnadir.length || paraQuitar.length) {
      await avisarPantalla(contact.id, companyId);
    }

    const reconocidas = new Set([...paraAnadir, ...paraQuitar].map(t => t.name));
    const ignoradas = [...anadidas, ...quitadas].filter(n => !reconocidas.has(n));

    logger.info(
      `[GHL] etiquetas desde GHL en contacto ${contact.id}: ` +
        `+[${paraAnadir.map(t => t.name).join(", ")}] ` +
        `-[${paraQuitar.map(t => t.name).join(", ")}]` +
        (previas === null ? " (primer evento: solo se anade)" : "")
    );

    if (ignoradas.length) {
      logger.info(
        `[GHL] etiquetas de GHL sin equivalente de contacto en Sales Smart, ignoradas: ${ignoradas.join(", ")}`
      );
    }

    return { atendido: true };
  } catch (err) {
    return {
      atendido: false,
      motivo: `fallo al aplicar etiquetas desde GHL: ${err.message}`
    };
  }
};

export default ReceiveGhlTagEventService;
