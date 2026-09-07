import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import User from "../../models/User";
import NotifyCompanyDecisionService from "./NotifyCompanyDecisionService";
import CreateAuthAuditService, {
  EVENTOS
} from "../AuthAuditServices/CreateAuthAuditService";

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

  // Se guarda antes de escribir: despues del update ya no se puede saber
  // de donde venia, y el registro de auditoria es mucho mas util contando
  // el salto que solo el destino.
  const estadoAnterior = (company as any).approvalStatus;

  await company.update({
    approvalStatus: status,
    approvedByUserId: reviewerId,
    approvalAt: new Date(),
    // El motivo solo se conserva mientras la empresa siga apartada. Al
    // aprobarla se limpia: dejarlo colgado haria que un rechazo antiguo
    // pareciera vigente.
    rejectionReason: status === "approved" ? null : reason
  });

  // Rastro de la decision. No lanza: ver el servicio.
  await CreateAuthAuditService({
    event:
      status === "approved"
        ? EVENTOS.REGISTRATION_APPROVED
        : status === "rejected"
        ? EVENTOS.REGISTRATION_REJECTED
        : status === "suspended"
        ? EVENTOS.REGISTRATION_SUSPENDED
        : EVENTOS.REGISTRATION_PENDING,
    companyId: company.id,
    actorUserId: reviewerId,
    email: company.email,
    detail: `${estadoAnterior} -> ${status}${reason ? ` | ${reason}` : ""}`
  });

  // Aviso al interesado. Va DESPUES de guardar y NO se espera.
  //
  // Antes se esperaba, y con el correo mal configurado la llamada se
  // quedaba colgada: quien pulsaba <aprobar> veia la pantalla parada
  // aunque la decision ya estuviera guardada. El servicio no lanza
  // nunca y anota sus propios fallos, asi que no esperarlo no pierde
  // nada; el .catch esta solo para que un rechazo no quede suelto.
  NotifyCompanyDecisionService({ company, status, reason }).catch(() => {});

  return company;
};

export default ReviewCompanyService;
