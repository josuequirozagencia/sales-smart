import { Sequelize, Op } from "sequelize";
import Invoices from "../../models/Invoices";
import AppError from "../../errors/AppError";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number;
}

interface Response {
  invoices: Invoices[];
  count: number;
  hasMore: boolean;
}

const ListInvoicesServices = async ({
  searchParam = "",
  pageNumber = "1",
  companyId
}: Request): Promise<Response> => {
  // Sin empresa no se lista nada.
  //
  // Antes la ausencia de companyId se leia como "sin filtro", asi que una
  // llamada sin sesion —la ruta /invoices/list no pedia token— devolvia las
  // facturas de TODAS las empresas. En una plataforma multicliente eso es la
  // informacion comercial de cada cliente: cuanto paga, cuando vence, que
  // plan tiene y con que limites.
  //
  // La ruta ya pide sesion, pero el arreglo tiene que estar tambien aqui: si
  // manana alguien llama sin pasar la empresa, lo que toca es fallar, no
  // servirlo todo. Falta de inquilino no puede significar todos los
  // inquilinos.
  if (!companyId) {
    throw new AppError("ERR_NO_COMPANY_ID", 400);
  }

  const whereCondition: any = {
    companyId,
    [Op.or]: [
      {
        name: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("detail")),
          "LIKE",
          `%${searchParam.toLowerCase().trim()}%`
        )
      }
    ]
  };

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: invoices } = await Invoices.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["id", "ASC"]]
  });

  const hasMore = count > offset + invoices.length;

  return {
    invoices,
    count,
    hasMore
  };
};

export default ListInvoicesServices;
