import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import User from "../models/User";

/**
 * Quien puede crear, editar, borrar, conectar o reiniciar conexiones y ver
 * el `token` de una conexion: admin, super o un usuario con
 * allowConnections "enabled". Es el mismo criterio con el que el menu del
 * frontend muestra la pantalla de Conexiones.
 *
 * Se lee de la base y no del JWT: el perfil del token puede ir hasta 15
 * minutos por detras si a alguien le quitan el permiso.
 */
export const puedeGestionarConexiones = async (
  userId: string | number
): Promise<boolean> => {
  const user = await User.findByPk(userId, {
    attributes: ["id", "profile", "super", "allowConnections"]
  });

  if (!user) return false;

  return (
    user.profile === "admin" ||
    user.super === true ||
    user.allowConnections === "enabled"
  );
};

const canManageConnections = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!(await puedeGestionarConexiones(req.user.id))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return next();
};

export default canManageConnections;
