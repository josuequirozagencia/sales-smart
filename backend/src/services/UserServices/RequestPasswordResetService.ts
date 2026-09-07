import crypto from "crypto";
import { fn, col, where as sqlWhere } from "sequelize";

import User from "../../models/User";
import { SendMail } from "../../helpers/SendMail";
import logger from "../../utils/logger";
import CreateAuthAuditService, {
  EVENTOS
} from "../AuthAuditServices/CreateAuthAuditService";

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
  /** Direccion de quien lo pide, solo para la auditoria. */
  ip?: string | null;
}

const RequestPasswordResetService = async ({
  email,
  ip
}: Request): Promise<void> => {
  if (!email || !email.trim()) return;

  // Busqueda SIN distinguir mayusculas.
  //
  // El correo se guarda tal y como se escribio al registrarse, asi que
  // comparar contra la version en minusculas no encontraria a quien puso
  // Nombre@Gmail.com. Y como este servicio calla a proposito cuando no
  // hay cuenta, el fallo seria invisible: ni llega el correo ni se avisa
  // de nada.
  //
  // Se compara lower(email) contra lower(lo escrito), y NO con iLike:
  // ahi los caracteres _ y % del texto actuarian como comodines y podrian
  // hacer coincidir la cuenta de otra persona.
  const user = await User.findOne({
    where: sqlWhere(fn("lower", col("email")), email.trim().toLowerCase()),
    // Si hubiera dos correos que solo se diferencian en mayusculas, se
    // elige siempre el mismo en vez de uno al azar.
    order: [["id", "ASC"]]
  });

  // Se anota SIEMPRE, exista la cuenta o no. Una rafaga de peticiones
  // para correos que no existen es justo la senal de que alguien esta
  // sondeando quien tiene cuenta, y sin registro no se ve.
  //
  // Esto no filtra nada: la tabla es interna y la respuesta al que
  // pregunta sigue siendo identica en los dos casos.
  await CreateAuthAuditService({
    event: EVENTOS.PASSWORD_RESET_REQUESTED,
    companyId: user ? user.companyId : null,
    userId: user ? user.id : null,
    email,
    detail: user ? "cuenta encontrada" : "sin cuenta",
    ip
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
