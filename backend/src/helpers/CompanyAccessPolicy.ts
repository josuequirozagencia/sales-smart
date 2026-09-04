import Company from "../models/Company";
import User from "../models/User";

/**
 * Decide si una empresa puede entrar.
 *
 * Vive aparte del login y sin acceso a base de datos para poder probarse
 * caso por caso. El camino de acceso es el unico sitio donde un fallo deja
 * fuera a TODO el mundo, asi que la decision tiene que ser verificable sin
 * levantar nada.
 *
 * Dos salvaguardas que no son un detalle:
 *
 *   El SUPERADMIN nunca queda bloqueado. Si una prueba vence o alguien
 *   marca mal un estado, tiene que quedar alguien capaz de entrar a
 *   arreglarlo; si no, el sistema se cierra sobre si mismo sin salida.
 *
 *   Un vencimiento NULO significa "sin limite", no "vencida". Las empresas
 *   que ya existen no tienen fecha, y leerlo al reves las dejaria fuera a
 *   todas de golpe.
 */

export type MotivoBloqueo =
  | "ERR_COMPANY_PENDING"
  | "ERR_COMPANY_REJECTED"
  | "ERR_COMPANY_SUSPENDED"
  | "ERR_TRIAL_EXPIRED";

interface Entrada {
  /** Estado de aprobacion de la empresa. */
  approvalStatus?: string;
  /** Fecha de vencimiento en formato YYYY-MM-DD, o nula si no caduca. */
  dueDate?: string | null;
  /** Si quien entra es superadministrador. */
  isSuper?: boolean;
  /**
   * Si la empresa esta en un plan de PRUEBA.
   *
   * Solo se bloquea por vencimiento a las pruebas. Una empresa con plan de
   * pago que se atrasa sigue el camino que ya existia: entra y se le lleva
   * a la pantalla de facturacion. Bloquearla tambien le impediria PAGAR,
   * que es justo lo contrario de lo que interesa.
   */
  isTrial?: boolean;
  /** Momento actual, inyectable para poder probar fechas. */
  now?: Date;
}

/**
 * @returns el motivo del bloqueo, o null si puede entrar
 */
export const evaluarAcceso = ({
  approvalStatus,
  dueDate,
  isSuper = false,
  isTrial = false,
  now = new Date()
}: Entrada): MotivoBloqueo | null => {
  // El superadministrador entra siempre. Ver la nota de cabecera.
  if (isSuper) return null;

  switch (approvalStatus) {
    case "pending":
      return "ERR_COMPANY_PENDING";
    case "rejected":
      return "ERR_COMPANY_REJECTED";
    case "suspended":
      return "ERR_COMPANY_SUSPENDED";
    default:
      // "approved", ausente o cualquier valor no reconocido se tratan como
      // permitidos. Ante un dato inesperado se deja pasar y no se cierra:
      // el coste de un bloqueo indebido en el login es mucho mayor que el
      // de un acceso de mas, que ademas se corrige desde el panel.
      break;
  }

  // Solo las pruebas se cortan por fecha. Ver la nota de isTrial.
  if (dueDate && isTrial) {
    // Se comparan cadenas YYYY-MM-DD, que ordenan igual que las fechas y
    // no dependen de la zona horaria del servidor. Vence AL TERMINAR el
    // dia indicado: el ultimo dia todavia se puede entrar.
    const hoy = now.toISOString().slice(0, 10);
    if (String(dueDate).slice(0, 10) < hoy) {
      return "ERR_TRIAL_EXPIRED";
    }
  }

  return null;
};

/** Version que toma los modelos, para usar desde el login. */
export const evaluarAccesoDeUsuario = (
  user: User,
  company: Company | null,
  now: Date = new Date()
): MotivoBloqueo | null =>
  evaluarAcceso({
    approvalStatus: company ? (company as any).approvalStatus : undefined,
    dueDate: company ? company.dueDate : null,
    isSuper: user.super === true,
    // El plan viene incluido si quien llama lo cargo; si no, se trata como
    // NO prueba, que es la opcion que no bloquea a nadie.
    isTrial: !!(company && (company as any).plan && (company as any).plan.trial),
    now
  });

export default { evaluarAcceso, evaluarAccesoDeUsuario };
