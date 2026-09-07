import { Op } from "sequelize";
import * as Yup from "yup";

import AppError from "../../errors/AppError";
import User from "../../models/User";
import { hashToken } from "./RequestPasswordResetService";
import CreateAuthAuditService, {
  EVENTOS
} from "../AuthAuditServices/CreateAuthAuditService";

/**
 * Consume el enlace y cambia la contrasena.
 *
 * Cuatro defensas, cada una contra un ataque distinto:
 *
 *   Se busca por el HASH del token, nunca por correo. El enlace no dice de
 *   quien es la cuenta, asi que interceptarlo no revela a quien pertenece.
 *
 *   Se comprueba la caducidad EN LA CONSULTA. Si se comprobara despues,
 *   una condicion de carrera podria colar un token recien vencido.
 *
 *   El token se borra al usarlo. Un enlace reenviado, quedado en el
 *   historial del navegador o en un registro de correo no sirve dos veces.
 *
 *   Se sube tokenVersion, que invalida las sesiones abiertas. Si alguien
 *   habia entrado con la contrasena antigua —el motivo habitual para
 *   restablecerla— queda fuera en cuanto se cambia.
 */

interface Request {
  token: string;
  password: string;
  /** Direccion de quien lo hace, solo para la auditoria. */
  ip?: string | null;
}

const ResetPasswordService = async ({
  token,
  password,
  ip
}: Request): Promise<void> => {
  const schema = Yup.object().shape({
    // Ocho caracteres es el minimo que ya exige el registro del proyecto;
    // no se endurece aqui para no dejar fuera a quien ya tiene cuenta.
    password: Yup.string().required().min(8)
  });

  try {
    await schema.validate({ password });
  } catch (err: any) {
    throw new AppError("ERR_WEAK_PASSWORD");
  }

  if (!token || !token.trim()) {
    throw new AppError("ERR_INVALID_RESET_TOKEN", 400);
  }

  const user = await User.findOne({
    where: {
      passwordResetTokenHash: hashToken(token.trim()),
      passwordResetExpiresAt: { [Op.gt]: new Date() }
    }
  });

  // Mismo error para token inexistente, ya usado o caducado: distinguirlos
  // le diria a quien prueba enlaces cual de las tres cosas acerto.
  if (!user) {
    throw new AppError("ERR_INVALID_RESET_TOKEN", 400);
  }

  // Asignar `password` basta: el hook @BeforeUpdate del modelo lo convierte
  // en passwordHash con bcrypt. No se toca passwordHash a mano, o se
  // guardaria la contrasena en claro.
  await user.update({
    password,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    tokenVersion: (user.tokenVersion || 0) + 1
  });

  // NO se anota nada de la contrasena, ni el token. Solo que se cambio.
  await CreateAuthAuditService({
    event: EVENTOS.PASSWORD_RESET_COMPLETED,
    companyId: user.companyId,
    userId: user.id,
    email: user.email,
    ip
  });
};

export default ResetPasswordService;
