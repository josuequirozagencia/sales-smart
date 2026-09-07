import { Request } from "express";

import AuthAuditLog from "../../models/AuthAuditLog";
import logger from "../../utils/logger";

/**
 * Anota un hecho del camino de acceso.
 *
 * NUNCA lanza. La auditoria acompana a la accion, no la condiciona: si
 * falla la anotacion no puede caerse el registro de una empresa ni el
 * cambio de una contrasena. Un fallo aqui se queda en el log del servidor.
 *
 * Tampoco recibe contrasenas ni tokens. Ver la nota de la migracion.
 */

export const EVENTOS = {
  REGISTRATION_CREATED: "REGISTRATION_CREATED",
  REGISTRATION_APPROVED: "REGISTRATION_APPROVED",
  REGISTRATION_REJECTED: "REGISTRATION_REJECTED",
  REGISTRATION_SUSPENDED: "REGISTRATION_SUSPENDED",
  REGISTRATION_PENDING: "REGISTRATION_PENDING",
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET_COMPLETED: "PASSWORD_RESET_COMPLETED",
  LOGIN_BLOCKED: "LOGIN_BLOCKED"
} as const;

export type Evento = typeof EVENTOS[keyof typeof EVENTOS];

interface Datos {
  event: Evento | string;
  companyId?: number | null;
  userId?: number | null;
  /** Quien decide, cuando no es el propio afectado. */
  actorUserId?: number | null;
  email?: string | null;
  detail?: string | null;
  ip?: string | null;
}

/**
 * Saca la direccion de quien llama, mirando primero la cabecera que pone
 * el proxy: detras de nginx, req.ip seria siempre el del propio servidor.
 */
export const ipDePeticion = (req?: Request): string | null => {
  if (!req) return null;
  const reenviada = req.headers["x-forwarded-for"];
  if (typeof reenviada === "string" && reenviada.length > 0) {
    // Puede traer varias separadas por coma; la primera es el origen.
    return reenviada.split(",")[0].trim().slice(0, 45);
  }
  return (req.ip || "").slice(0, 45) || null;
};

const CreateAuthAuditService = async (datos: Datos): Promise<void> => {
  try {
    await AuthAuditLog.create({
      event: datos.event,
      companyId: datos.companyId ?? null,
      userId: datos.userId ?? null,
      actorUserId: datos.actorUserId ?? null,
      // Se guarda en minusculas para que buscar por correo encuentre
      // siempre lo mismo, igual que hace la busqueda de usuario.
      email: datos.email ? String(datos.email).trim().toLowerCase() : null,
      detail: datos.detail ?? null,
      ip: datos.ip ?? null
    } as any);
  } catch (err) {
    logger.error(`[AuthAudit] no se pudo anotar ${datos.event}: ${err}`);
  }
};

export default CreateAuthAuditService;
