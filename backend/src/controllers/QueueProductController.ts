import { Request, Response } from "express";

import ListService from "../services/QueueProductServices/ListService";
import CreateService from "../services/QueueProductServices/CreateService";
import UpdateService from "../services/QueueProductServices/UpdateService";
import DeleteService from "../services/QueueProductServices/DeleteService";

/**
 * Catalogo de productos de una cola.
 *
 * El companyId sale SIEMPRE de req.user, nunca del cuerpo de la peticion:
 * es lo que impide que alguien toque el catalogo de otra empresa mandando
 * un identificador cualquiera.
 */

type IndexQuery = {
  onlyActive?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { queueId } = req.params;
  const { onlyActive } = req.query as IndexQuery;
  const { companyId } = req.user;

  const products = await ListService({
    queueId: Number(queueId),
    companyId,
    onlyActive: onlyActive === "true"
  });

  return res.json(products);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { queueId } = req.params;
  const { name, description, price, order } = req.body;
  const { companyId } = req.user;

  const product = await CreateService({
    queueId: Number(queueId),
    companyId,
    name,
    description,
    // El formulario manda cadenas. Vacio significa "sin precio fijado", no
    // cero: un cero se sumaria como venta de importe nulo.
    price: price === "" || price === undefined || price === null
      ? null
      : Number(price),
    order: order === undefined ? 0 : Number(order)
  });

  return res.status(200).json(product);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { productId } = req.params;
  const { companyId } = req.user;
  const data = { ...req.body };

  if ("price" in data) {
    data.price =
      data.price === "" || data.price === null || data.price === undefined
        ? null
        : Number(data.price);
  }

  const product = await UpdateService({ productId, companyId, data });

  return res.status(200).json(product);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { productId } = req.params;
  const { companyId } = req.user;

  await DeleteService(productId, companyId);

  return res.status(200).json({ message: "Product deleted" });
};
