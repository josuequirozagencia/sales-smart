import { Request, Response } from "express";

import CreateService from "../services/SaleServices/CreateService";
import ListService from "../services/SaleServices/ListService";
import DeleteService from "../services/SaleServices/DeleteService";

/**
 * Ventas.
 *
 * El companyId sale siempre de req.user. El userId tambien: quien registra
 * la venta es quien esta autenticado, no quien diga el formulario.
 */

type IndexQuery = {
  contactId?: string;
  searchParam?: string;
  pageNumber?: string;
  initialDate?: string;
  finalDate?: string;
  paymentMethod?: string;
};

const aNumero = (v: any): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const {
    contactId,
    searchParam,
    pageNumber,
    initialDate,
    finalDate,
    paymentMethod
  } = req.query as IndexQuery;

  const resultado = await ListService({
    companyId,
    contactId: contactId ? Number(contactId) : undefined,
    searchParam,
    pageNumber,
    initialDate,
    finalDate,
    paymentMethod
  });

  return res.json(resultado);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const {
    contactId,
    ticketId,
    queueId,
    productId,
    productName,
    total,
    deposit,
    paymentMethod,
    notes
  } = req.body;

  const sale = await CreateService({
    companyId,
    userId: Number(userId),
    contactId: Number(contactId),
    ticketId: aNumero(ticketId),
    queueId: aNumero(queueId),
    productId: aNumero(productId),
    productName,
    // Vacio se trata como cero aqui, al reves que en el catalogo: una venta
    // sin importe es una venta de cero, no una venta sin precio fijado.
    total: aNumero(total) ?? 0,
    deposit: aNumero(deposit) ?? 0,
    paymentMethod,
    notes
  });

  return res.status(200).json(sale);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { saleId } = req.params;
  const { companyId } = req.user;

  await DeleteService(saleId, companyId);

  return res.status(200).json({ message: "Sale deleted" });
};
