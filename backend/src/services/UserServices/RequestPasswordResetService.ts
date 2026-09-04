import crypto from "crypto";

import User from "../../models/User";
import { SendMail } from "../../helpers/SendMail";
import logger from "../../utils/logger";

/**
 * Pide un enlace para restablecer la contrasena.
 *
 * NUNCA revela si el correo existe. Devuelve lo mismo tanto si hay cuenta
 * como si no, y quien llame debe responder siempre el mismo mensaje
 * generico. Lo contrario convertiria este formulario en una herramienta
 * para averiguar quien tiene cuenta en el sistema, que es el primer paso de
 * cualquier ataque dirigido.
 *
 * Por eso tampoco lanza AppError cuando no encuentra al usuario: un error
 * distinguible seria la misma fuga por otra via.
 */

/** Duracion del enlace. */
export const RESET_TOKEN_MINUTES = 60;

/** Hash con el que se guarda el token. Ver la migracion para el porque. */
export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

interface Request {
  email: string;
}

const RequestPasswordResetService = async ({
  email
}: Request): Promise<void> => {
  if (!email || !email.trim()) return;

  const user = await User.findOne({
    where: { email: email.trim().toLowerCase() }
  });

  // Silencio deliberado: el que pregunta no puede distinguir este caso.
  if (!user) return;

  // 256 bits de aleatoriedad criptografica. No vale Math.random: es
  // predecible y un token adivinable equivale a no tener token.
  const token = crypto.randomBytes(32).toString("hex");

  const expira = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);

  await user.update(
    {
      passwordResetTokenHash: hashToken(token),
      passwordResetExpiresAt: expira
    },
    // silent: cambiar el token no es un cambio del usuario que deba mover
    // su updatedAt ni disparar el hook que rehashea la contrasena.
    { silent: true }
  );

  const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
  const enlace = `${frontend}/reset-password?token=${token}`;

  const cuerpo = [
    `Hola ${user.name},`,
    "",
    "Recibimos una solicitud para restablecer la contrasena de tu cuenta.",
    "",
    `Abre este enlace para elegir una nueva contrasena:`,
    enlace,
    "",
    `El enlace caduca en ${RESET_TOKEN_MINUTES} minutos y solo puede usarse una vez.`,
    "",
    "Si no fuiste tu, ignora este mensaje: tu contrasena no ha cambiado."
  ].join("\n");

  try {
    await SendMail({
      to: user.email,
      subject: "Restablecer tu contrasena",
      text: cuerpo
    });
  } catch (err) {
    // Que el correo falle no puede delatar nada al que pregunta ni tumbar
    // la peticion. Se anota para poder diagnosticarlo desde el servidor.
    logger.error(`[PasswordReset] no se pudo enviar el correo: ${err}`);
  }
};

export default RequestPasswordResetService;
