import * as Yup from "yup";

import AppError from "../../errors/AppError";
import QueueProduct from "../../models/QueueProduct";
import Queue from "../../models/Queue";

interface Request {
  queueId: number;
  companyId: number;
  name: string;
  description?: string;
  price?: number;
  order?: number;
}

const CreateService = async ({
  queueId,
  companyId,
  name,
  description = null,
  price = null,
  order = 0
}: Request): Promise<QueueProduct> => {
  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    // Un precio negativo no significa nada aqui y arruinaria los totales de
    // la pantalla de ventas. Vacio si se permite: hay servicios cuyo precio
    // se pacta en cada venta.
    price: Yup.number().nullable().min(0)
  });

  try {
    await schema.validate({ name, price });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // La cola tiene que ser de esta empresa. Sin esta comprobacion, mandando
  // un queueId ajeno se podrian colar productos en la cola de otra.
  const queue = await Queue.findOne({ where: { id: queueId, companyId } });
  if (!queue) {
    throw new AppError("ERR_NO_QUEUE_FOUND", 404);
  }

  const yaExiste = await QueueProduct.findOne({
    where: { queueId, name: name.trim() }
  });
  if (yaExiste) {
    throw new AppError("ERR_QUEUE_PRODUCT_DUPLICATED");
  }

  const product = await QueueProduct.create({
    queueId,
    companyId,
    name: name.trim(),
    description,
    price,
    order,
    active: true
  } as any);

  return product;
};

export default CreateService;
