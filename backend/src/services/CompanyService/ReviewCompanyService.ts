import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import User from "../../models/User";

/**
 * Aprobar, rechazar, suspender o reactivar una empresa.
 *
 * Deja constancia de QUIEN decidio y CUANDO. Sin eso, meses despues nadie
 * puede responder por que una empresa quedo fuera, que es justo lo que se
 * pregunta cuando alguien reclama.
 *
 * NO toca la columna `status`, que significa otra cosa —activa o
 * inactiva— y la leen la pantalla de empresas y la facturacion. Aprobar
 * una solicitud no es lo mismo que activar el servicio.
 */

export const ESTADOS_VALIDOS = [
  "pending",
  "approved",
  "rejected",
  "suspended"
];

interface Request {
  companyId: number | string;
  status: string;
  /** Quien decide. Debe ser superadministrador. */
  reviewerId: number;
  /** Motivo, util sobre todo al rechazar o suspender. */
  reason?: string;
}

const ReviewCompanyService = async ({
  companyId,
  status,
  reviewerId,
  reason = null
}: Request): Promise<Company> => {
  if (!ESTADOS_VALIDOS.includes(status)) {
    throw new AppError("ERR_INVALID_APPROVAL_STATUS");
  }

  // La comprobacion de superadministrador se hace AQUI y no solo en el
  // controlador: un servicio que confia en que ya lo comprobaron es un
  // servicio que se puede llamar mal desde otro sitio manana.
  const reviewer = await User.findByPk(reviewerId);
  if (!reviewer || reviewer.super !== true) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const company = await Company.findByPk(companyId);
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  // Nadie puede dejarse a si mismo fuera. El superadministrador vive en
  // una empresa como todos, y bloquear la suya lo dejaria sin forma de
  // revertirlo desde la interfaz.
  if (
    company.id === reviewer.companyId &&
    (status === "rejected" || status === "suspended")
  ) {
    throw new AppError("ERR_CANNOT_BLOCK_OWN_COMPANY", 403);
  }

  await company.update({
    approvalStatus: status,
    approvedByUserId: reviewerId,
    approvalAt: new Date(),
    // El motivo solo se conserva mientras la empresa siga apartada. Al
    // aprobarla se limpia: dejarlo colgado haria que un rechazo antiguo
    // pareciera vigente.
    rejectionReason: status === "approved" ? null : reason
  });

  return company;
};

export default ReviewCompanyService;
