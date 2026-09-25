import AppError from "../../errors/AppError";
import CompaniesSettings from "../../models/CompaniesSettings";

/**
 * Que columnas de CompaniesSettings puede nombrar el navegador.
 *
 * El nombre de la columna llegaba del cuerpo o de la query y entraba tal cual
 * en el SQL. Con lista blanca —los atributos del modelo, menos la clave, la
 * empresa y las fechas— un nombre inventado se rechaza en vez de ejecutarse.
 */
const FIJAS = ["id", "companyId", "createdAt", "updatedAt"];

export const columnasEditables = (): string[] =>
  Object.keys(CompaniesSettings.rawAttributes).filter(c => !FIJAS.includes(c));

export const exigirColumna = (columna: unknown): string => {
  if (typeof columna !== "string" || !columnasEditables().includes(columna)) {
    throw new AppError("ERR_COMPANY_SETTING_INVALID_COLUMN", 400);
  }
  return columna;
};

/**
 * Valor con el tipo de su columna.
 *
 * Antes todo se escribia entre comillas dentro del SQL, asi que en las
 * columnas booleanas acababan las cadenas "true"/"false" y Postgres las
 * convertia por su cuenta. Aqui se convierte antes, y lo que no encaja se
 * rechaza en vez de guardarse a medias.
 */
export const valorDeColumna = (columna: string, data: unknown): any => {
  // Sin valor no hay nada que guardar: antes se escribia la cadena
  // "undefined" en la columna.
  if (data === undefined) {
    throw new AppError("ERR_COMPANY_SETTING_INVALID_VALUE", 400);
  }

  const tipo = String((CompaniesSettings.rawAttributes[columna]?.type as any)?.key || "");

  if (tipo === "BOOLEAN") {
    if (typeof data === "boolean") return data;
    if (data === "true" || data === "enabled") return true;
    if (data === "false" || data === "disabled") return false;
    throw new AppError("ERR_COMPANY_SETTING_INVALID_VALUE", 400);
  }

  if (tipo === "INTEGER") {
    const numero = Number(data);
    if (data === "" || data === null || !Number.isInteger(numero)) {
      throw new AppError("ERR_COMPANY_SETTING_INVALID_VALUE", 400);
    }
    return numero;
  }

  if (data === null || data === undefined) return null;
  if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
    return String(data);
  }

  // Un objeto o un array aqui solo puede venir de una peticion manipulada.
  throw new AppError("ERR_COMPANY_SETTING_INVALID_VALUE", 400);
};
