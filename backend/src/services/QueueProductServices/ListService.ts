import { Op } from "sequelize";
import QueueProduct from "../../models/QueueProduct";

/**
 * Productos de una cola.
 *
 * Se usa desde dos sitios con necesidades distintas, de ahi `onlyActive`:
 * la pantalla de configuracion los quiere todos, para poder reactivar uno
 * apagado; el formulario de venta solo los activos, porque no tiene
 * sentido ofrecer algo que ya no se vende.
 */
interface Request {
  queueId: number;
  companyId: number;
  onlyActive?: boolean;
}

const ListService = async ({
  queueId,
  companyId,
  onlyActive = false
}: Request): Promise<QueueProduct[]> => {
  const where: any = { queueId, companyId };

  if (onlyActive) where.active = true;

  return QueueProduct.findAll({
    where,
    // El orden manual manda; el nombre solo desempata, para que la lista no
    // baile entre recargas cuando varios comparten posicion.
    order: [
      ["order", "ASC"],
      ["name", "ASC"]
    ]
  });
};

export default ListService;
