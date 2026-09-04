import AppError from "../../errors/AppError";
import Sale from "../../models/Sale";

/**
 * Borra una venta.
 *
 * No se toca la etiqueta "Venta" del contacto: puede tener otras ventas, y
 * quitarsela por borrar una seria falso. Tampoco se revierten los campos
 * del ticket, porque un ticket puede haber tenido varias.
 */
const DeleteService = async (
  saleId: number | string,
  companyId: number
): Promise<void> => {
  const sale = await Sale.findOne({ where: { id: saleId, companyId } });

  if (!sale) {
    throw new AppError("ERR_NO_SALE_FOUND", 404);
  }

  await sale.destroy();
};

export default DeleteService;
