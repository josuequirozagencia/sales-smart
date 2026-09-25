import AppError from "../../errors/AppError";
import QueueProduct from "../../models/QueueProduct";

/**
 * Borra un producto del catalogo.
 *
 * Las ventas que lo usaron NO se pierden ni quedan huerfanas: guardan
 * copiado el nombre del producto y su productId pasa a null, asi que el
 * historico sigue diciendo que se vendio y los totales no cambian.
 *
 * Para dejar de ofrecer algo conservando el vinculo, lo correcto es
 * desactivarlo (active = false) en vez de borrarlo.
 */
const DeleteService = async (
  productId: number | string,
  companyId: number
): Promise<void> => {
  const product = await QueueProduct.findOne({
    where: { id: productId, companyId }
  });

  if (!product) {
    throw new AppError("ERR_NO_QUEUE_PRODUCT_FOUND", 404);
  }

  await product.destroy();
};

export default DeleteService;
