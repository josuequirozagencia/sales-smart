import * as Yup from "yup";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import QueueProduct from "../../models/QueueProduct";

interface Data {
  name?: string;
  description?: string;
  price?: number;
  active?: boolean;
  order?: number;
}

interface Request {
  productId: number | string;
  companyId: number;
  data: Data;
}

const UpdateService = async ({
  productId,
  companyId,
  data
}: Request): Promise<QueueProduct> => {
  // Se filtra por companyId y no solo por id: sin eso, conociendo un id
  // ajeno se podria editar el catalogo de otra empresa.
  const product = await QueueProduct.findOne({
    where: { id: productId, companyId }
  });

  if (!product) {
    throw new AppError("ERR_NO_QUEUE_PRODUCT_FOUND", 404);
  }

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    price: Yup.number().nullable().min(0)
  });

  try {
    await schema.validate({ name: data.name, price: data.price });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (data.name) {
    const nombre = data.name.trim();
    const otro = await QueueProduct.findOne({
      where: {
        queueId: product.queueId,
        name: nombre,
        id: { [Op.ne]: product.id }
      }
    });
    if (otro) {
      throw new AppError("ERR_QUEUE_PRODUCT_DUPLICATED");
    }
    data.name = nombre;
  }

  await product.update(data);

  return product;
};

export default UpdateService;
