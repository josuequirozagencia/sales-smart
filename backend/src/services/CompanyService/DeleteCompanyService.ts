import Company from "../../models/Company";
import User from "../../models/User";
import AppError from "../../errors/AppError";

/**
 * Borra una empresa, con dos negativas.
 *
 * Borrar una empresa deja a sus usuarios con companyId en nulo —la clave
 * ajena es SET NULL, no los borra—, y un usuario sin empresa NO PUEDE
 * ENTRAR: el login busca su empresa y se cae al no encontrarla. Asi que
 * borrar la empresa equivocada deja gente fuera sin tocarle la cuenta.
 *
 * Por eso no se permite:
 *  - borrar la empresa a la que pertenece quien lo pide, y
 *  - borrar una empresa que contenga algun superadministrador.
 *
 * Las dos pasaron el 22 sep 2026 en produccion y costaron entrar a la base
 * por SSH para recuperar el acceso.
 */
const DeleteCompanyService = async (
  id: string,
  companyIdDelSolicitante?: number
): Promise<void> => {
  const company = await Company.findOne({
    where: { id }
  });

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  if (
    companyIdDelSolicitante !== undefined &&
    Number(companyIdDelSolicitante) === Number(id)
  ) {
    throw new AppError("ERR_CANNOT_DELETE_OWN_COMPANY", 400);
  }

  const supersDentro = await User.count({
    where: { companyId: Number(id), super: true }
  });

  if (supersDentro > 0) {
    throw new AppError("ERR_COMPANY_HAS_SUPER_USER", 400);
  }

  await company.destroy();
};

export default DeleteCompanyService;
