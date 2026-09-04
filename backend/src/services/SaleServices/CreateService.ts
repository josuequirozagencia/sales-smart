import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Sale from "../../models/Sale";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import QueueProduct from "../../models/QueueProduct";
import EnsureContactTagService, {
  SALE_TAG_NAME,
  SALE_TAG_COLOR
} from "./EnsureContactTagService";

interface Request {
  companyId: number;
  contactId: number;
  userId?: number;
  ticketId?: number;
  queueId?: number;
  productId?: number;
  productName?: string;
  total: number;
  deposit?: number;
  paymentMethod?: string;
  notes?: string;
  /**
   * Si la venta viene del modal de cierre, el ticket ya se acaba de
   * actualizar con esos mismos datos y volver a escribirlo seria
   * redundante. Por defecto si se sincroniza.
   */
  syncTicket?: boolean;
}

const CreateService = async ({
  companyId,
  contactId,
  userId = null,
  ticketId = null,
  queueId = null,
  productId = null,
  productName = null,
  total,
  deposit = 0,
  paymentMethod = null,
  notes = null,
  syncTicket = true
}: Request): Promise<Sale> => {
  const schema = Yup.object().shape({
    total: Yup.number().required().min(0),
    deposit: Yup.number().min(0)
  });

  try {
    await schema.validate({ total, deposit });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // El contacto tiene que ser de esta empresa: es lo que impide registrar
  // una venta a nombre de un contacto ajeno mandando su id.
  const contact = await Contact.findOne({
    where: { id: contactId, companyId }
  });
  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  // Se copia el nombre del producto en el momento de vender, para que
  // borrarlo o renombrarlo despues no deje la venta sin saber que fue.
  let nombreProducto = productName;
  let colaDelProducto = queueId;

  if (productId) {
    const product = await QueueProduct.findOne({
      where: { id: productId, companyId }
    });
    if (!product) {
      throw new AppError("ERR_NO_QUEUE_PRODUCT_FOUND", 404);
    }
    nombreProducto = product.name;
    // La cola sale del producto y no de lo que mande el cliente: son
    // inseparables, y asi no pueden acabar contradiciendose.
    colaDelProducto = product.queueId;
  }

  const sale = await Sale.create({
    companyId,
    contactId,
    userId,
    ticketId,
    queueId: colaDelProducto,
    productId,
    productName: nombreProducto,
    total,
    deposit,
    paymentMethod,
    notes
  } as any);

  // Etiqueta automatica. Si algo fallara aqui la venta ya esta guardada y
  // no se pierde: la etiqueta es una comodidad visual, no el registro.
  try {
    await EnsureContactTagService(
      contactId,
      companyId,
      SALE_TAG_NAME,
      SALE_TAG_COLOR
    );
  } catch (err) {
    // Se traga a proposito: no vale tumbar una venta valida porque la
    // etiqueta no se pudo poner.
  }

  // Compatibilidad con lo que ya leia el ticket. La tabla es quien manda,
  // pero estos campos los siguen mirando el modal de cierre y el informe
  // antiguo, y dejarlos desfasados daria dos cifras distintas.
  if (ticketId && syncTicket) {
    const ticket = await Ticket.findOne({
      where: { id: ticketId, companyId }
    });
    if (ticket) {
      await ticket.update({
        finalizadoComVenda: true,
        valorVenda: total
      });
    }
  }

  await sale.reload();

  return sale;
};

export default CreateService;
