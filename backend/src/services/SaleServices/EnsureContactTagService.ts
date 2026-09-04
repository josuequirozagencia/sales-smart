import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";

/**
 * Cuelga una etiqueta del contacto, creandola si no existe.
 *
 * Se etiqueta al CONTACTO y no al ticket a proposito: "compro" o "tiene
 * cita" son hechos de la persona, no de una conversacion concreta. Asi la
 * marca sigue visible en sus tickets futuros, que es lo util para un
 * asesor que lo atiende meses despues. La lista de tickets ya pinta las
 * etiquetas del contacto junto a las del ticket, asi que se ve igual.
 *
 * Es idempotente: registrar dos ventas del mismo contacto no duplica la
 * etiqueta ni crea una segunda igual.
 */
const EnsureContactTagService = async (
  contactId: number,
  companyId: number,
  name: string,
  color: string
): Promise<void> => {
  const [tag] = await Tag.findOrCreate({
    where: { name, companyId },
    defaults: { name, color, companyId, kanban: 0 } as any
  });

  const yaPuesta = await ContactTag.findOne({
    where: { contactId, tagId: tag.id }
  });

  if (!yaPuesta) {
    await ContactTag.create({ contactId, tagId: tag.id } as any);
  }
};

/** Nombres y colores de las etiquetas automaticas. */
export const SALE_TAG_NAME = "Venta";
export const SALE_TAG_COLOR = "#16a34a";
export const APPOINTMENT_TAG_NAME = "Agenda";
export const APPOINTMENT_TAG_COLOR = "#3b82f6";

export default EnsureContactTagService;
