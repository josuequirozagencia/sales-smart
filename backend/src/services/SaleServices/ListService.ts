import { Op } from "sequelize";

import Sale from "../../models/Sale";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import User from "../../models/User";

interface Request {
  companyId: number;
  /** Si viene, solo las ventas de ese contacto (ficha del contacto). */
  contactId?: number;
  searchParam?: string;
  pageNumber?: string | number;
  initialDate?: string;
  finalDate?: string;
  paymentMethod?: string;
}

export interface SaleTotals {
  /** Suma de los importes vendidos. */
  billed: number;
  /** Suma de lo ya cobrado. */
  paid: number;
  /** Lo que falta por cobrar. */
  pending: number;
  /** Cuantas ventas hay en el periodo. */
  count: number;
  /** Ventas que son la PRIMERA compra de ese contacto. */
  newCount: number;
  /** Ventas a quien ya habia comprado antes. */
  crossSellCount: number;
}

interface Response {
  sales: Sale[];
  totals: SaleTotals;
  count: number;
  hasMore: boolean;
}

const ListService = async ({
  companyId,
  contactId,
  searchParam = "",
  pageNumber = "1",
  initialDate,
  finalDate,
  paymentMethod
}: Request): Promise<Response> => {
  const where: any = { companyId };

  if (contactId) where.contactId = contactId;
  if (paymentMethod) where.paymentMethod = paymentMethod;

  if (initialDate && finalDate) {
    where.createdAt = {
      [Op.gte]: `${initialDate} 00:00:00`,
      [Op.lte]: `${finalDate} 23:59:59`
    };
  }

  const includeContact: any = {
    model: Contact,
    as: "contact",
    attributes: ["id", "name", "number", "urlPicture"],
    required: true
  };

  // La busqueda mira el nombre del contacto y el del producto, que es por
  // lo que se busca una venta en la practica.
  if (searchParam.trim()) {
    const termino = `%${searchParam.trim().toLowerCase()}%`;
    where[Op.or] = [
      { productName: { [Op.iLike]: termino } },
      { paymentMethod: { [Op.iLike]: termino } },
      { "$contact.name$": { [Op.iLike]: termino } },
      { "$contact.number$": { [Op.iLike]: termino } }
    ];
  }

  const limit = 40;
  const offset = limit * (Number(pageNumber) - 1);

  const { count, rows: sales } = await Sale.findAndCountAll({
    where,
    include: [
      includeContact,
      { model: Ticket, as: "ticket", attributes: ["id", "uuid", "status"] },
      { model: Queue, as: "queue", attributes: ["id", "name", "color"] },
      { model: User, as: "user", attributes: ["id", "name"] }
    ],
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    distinct: true,
    subQuery: false
  });

  // Los totales se calculan sobre TODAS las ventas que cumplen el filtro,
  // no sobre la pagina: la cabecera dice "facturado", y si solo sumara los
  // cuarenta visibles mentiria en cuanto hubiera mas.
  const todas = await Sale.findAll({
    where,
    include: [includeContact],
    attributes: ["id", "contactId", "total", "deposit"],
    raw: true
  });

  // Primera compra de cada contacto, mirando TODO su historial y no solo el
  // periodo filtrado. Si se mirara solo el filtro, la primera venta del mes
  // pasaria por "nueva" aunque el cliente llevara comprando un ano.
  const contactos = [...new Set(todas.map((s: any) => s.contactId))];
  const primeras = new Set<number>();

  if (contactos.length) {
    const historial = await Sale.findAll({
      where: { companyId, contactId: { [Op.in]: contactos } },
      attributes: ["id", "contactId", "createdAt"],
      order: [["createdAt", "ASC"], ["id", "ASC"]],
      raw: true
    });
    const vistos = new Set<number>();
    historial.forEach((s: any) => {
      if (!vistos.has(s.contactId)) {
        vistos.add(s.contactId);
        primeras.add(s.id);
      }
    });
  }

  const totals = todas.reduce<SaleTotals>(
    (acc, s: any) => {
      const total = Number(s.total) || 0;
      const deposit = Number(s.deposit) || 0;
      acc.billed += total;
      acc.paid += deposit;
      // Nunca negativo, igual que el getter del modelo: un abono de mas en
      // una venta no puede restar de lo pendiente de las otras.
      acc.pending += Math.max(0, total - deposit);
      acc.count += 1;
      if (primeras.has(s.id)) acc.newCount += 1;
      else acc.crossSellCount += 1;
      return acc;
    },
    { billed: 0, paid: 0, pending: 0, count: 0, newCount: 0, crossSellCount: 0 }
  );

  // Cada venta lleva si fue la primera de ese contacto, para que la tabla
  // pueda etiquetarla sin volver a preguntar.
  sales.forEach(s => {
    (s as any).setDataValue("isFirstPurchase", primeras.has(s.id));
  });

  return {
    sales,
    totals,
    count,
    hasMore: count > offset + sales.length
  };
};

export default ListService;
