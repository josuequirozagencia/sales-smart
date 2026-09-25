import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";
import {
  leerInactividad,
  guardarInactividad
} from "../services/CompaniesSettings/SessionInactivityService";

/**
 * Tiempo de inactividad tras el que se cierra la sesion. La empresa sale
 * SIEMPRE del token (req.user.companyId). Lo lee cualquier usuario de la
 * empresa —el frontend lo necesita para contar— y solo lo cambia el admin.
 */

export const show = async (req: Request, res: Response): Promise<Response> => {
  const inactivityMinutes = await leerInactividad(req.user.companyId);
  return res.status(200).json({ inactivityMinutes });
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { companyId } = req.user;
  const inactivityMinutes = await guardarInactividad(
    companyId,
    req.body?.inactivityMinutes
  );

  // Las sesiones abiertas de la empresa toman el nuevo limite sin recargar.
  getIO()
    .of(String(companyId))
    .emit(`company-${companyId}-sessionSettings`, { inactivityMinutes });

  return res.status(200).json({ inactivityMinutes });
};
