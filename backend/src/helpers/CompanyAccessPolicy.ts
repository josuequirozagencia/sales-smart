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

/**
 * Lleva una fecha de vencimiento a YYYY-MM-DD, venga como venga.
 *
 * Hace falta porque NO siempre es una cadena. Al crear la empresa se
 * escribe como "2026-09-07", pero al leerla de la base Sequelize la
 * devuelve como objeto Date, y entonces `String(fecha).slice(0, 10)` daba
 * "Sun Sep 06" —el formato largo de JavaScript— que comparado con
 * "2026-09-08" resulta MENOR nunca. El corte por prueba vencida no
 * llegaba a actuar en ningun caso, y sin dar error: simplemente dejaba
 * entrar.
 *
 * Ante un valor que no se sepa interpretar devuelve null, que aguas
 * arriba significa "sin limite". Es la eleccion prudente: mejor un acceso
 * de mas, que se corrige desde el panel, que dejar fuera a alguien por no
 * entender su fecha.
 */
const aDiaISO = (valor: unknown): string | null => {
  if (!valor) return null;

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime())
      ? null
      : valor.toISOString().slice(0, 10);
  }

  const texto = String(valor);
  // "2026-09-07" y "2026-09-07T00:00:00.000Z" sirven los dos.
  return /^\d{4}-\d{2}-\d{2}/.test(texto) ? texto.slice(0, 10) : null;
};

interface Entrada {
  /** Estado de aprobacion de la empresa. */
  approvalStatus?: string;
  /**
   * Fecha de vencimiento, o nula si no caduca.
   *
   * Se admite tanto Date como cadena porque llega de los dos sitios: del
   * modelo (Date) y de datos ya normalizados (cadena).
   */
  dueDate?: string | Date | null;
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
  const vence = aDiaISO(dueDate);
  if (vence && isTrial) {
    // Se comparan cadenas YYYY-MM-DD, que ordenan igual que las fechas y
    // no dependen de la zona horaria del servidor. Vence AL TERMINAR el
    // dia indicado: el ultimo dia todavia se puede entrar.
    const hoy = now.toISOString().slice(0, 10);
    if (vence < hoy) {
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
