import AppError from "../../errors/AppError";
import CompaniesSettings from "../../models/CompaniesSettings";

/**
 * Cierre de sesion por inactividad, por empresa.
 *
 * El frontend cuenta el tiempo sin actividad del usuario (raton, teclado,
 * toques), avisa un minuto antes con una cuenta atras y cierra la sesion al
 * llegar al limite. Aqui solo se guarda el limite de cada empresa.
 */

export const MINUTOS_POR_DEFECTO = 300;
export const MINUTOS_MINIMO = 15;
export const MINUTOS_MAXIMO = 1440;

export const leerInactividad = async (companyId: number): Promise<number> => {
  const ajustes = await CompaniesSettings.findOne({
    where: { companyId },
    attributes: ["sessionInactivityMinutes"]
  });
  const minutos = Number(ajustes?.sessionInactivityMinutes);
  return Number.isInteger(minutos) && minutos > 0 ? minutos : MINUTOS_POR_DEFECTO;
};

export const guardarInactividad = async (
  companyId: number,
  valor: unknown
): Promise<number> => {
  const minutos = Number(valor);
  if (
    typeof valor === "boolean" ||
    valor === null ||
    valor === "" ||
    !Number.isInteger(minutos) ||
    minutos < MINUTOS_MINIMO ||
    minutos > MINUTOS_MAXIMO
  ) {
    throw new AppError("ERR_SESSION_INACTIVITY_INVALID", 400);
  }

  const [actualizadas] = await CompaniesSettings.update(
    { sessionInactivityMinutes: minutos },
    { where: { companyId } }
  );
  if (!actualizadas) throw new AppError("ERR_COMPANY_SETTINGS_NOT_FOUND", 404);

  return minutos;
};
