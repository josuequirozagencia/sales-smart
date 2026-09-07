import AppError from "../../errors/AppError";
import AuthAuditLog from "../../models/AuthAuditLog";
import User from "../../models/User";

/**
 * Lee el registro de auditoria de una empresa.
 *
 * Solo para el SUPERADMINISTRADOR. La comprobacion se hace aqui ademas de
 * en el controlador: un servicio que da por hecho que ya le comprobaron el
 * permiso es un servicio que se puede llamar mal desde otro sitio manana.
 *
 * Es un motivo distinto del habitual: aqui no se protege un dato de la
 * competencia, sino que se evita que un administrador vea desde que
 * direcciones se ha intentado entrar a su cuenta y con que correos, que es
 * material de vigilancia y no de gestion.
 */

interface Request {
  companyId: number | string;
  requesterId: number;
  limit?: number;
}

/** Tope de filas devueltas, para no traerse el historico entero. */
const TOPE = 100;

const ListAuthAuditService = async ({
  companyId,
  requesterId,
  limit = 50
}: Request): Promise<AuthAuditLog[]> => {
  const requester = await User.findByPk(requesterId);
  if (!requester || requester.super !== true) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return AuthAuditLog.findAll({
    where: { companyId },
    // Lo ultimo primero: es lo que se viene a mirar.
    order: [["createdAt", "DESC"]],
    limit: Math.min(Number(limit) || 50, TOPE),
    include: [
      {
        model: User,
        as: "actor",
        // Solo lo justo para decir quien decidio. Nada del resto del
        // usuario tiene por que viajar hasta el navegador.
        attributes: ["id", "name"],
        required: false
      }
    ]
  });
};

export default ListAuthAuditService;
