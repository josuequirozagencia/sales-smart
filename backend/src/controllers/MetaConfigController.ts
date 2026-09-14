import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  verConfigMeta,
  guardarConfigMeta
} from "../services/MetaConfigService/MetaConfigService";

/**
 * Configuracion de Meta Conversions API de la empresa.
 *
 * De administrador, como la de GoHighLevel. La empresa sale SIEMPRE del
 * token (req.user.companyId): un companyId en el cuerpo se ignora, asi que
 * nadie puede leer ni tocar la configuracion de otra empresa. La respuesta
 * nunca incluye el token.
 */

const soloAdmin = (req: Request) => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  return res.status(200).json(await verConfigMeta(req.user.companyId));
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  const { datasetId, accessToken, testEventCode, isActive } = req.body;

  const estado = await guardarConfigMeta(req.user.companyId, {
    datasetId,
    accessToken,
    testEventCode,
    isActive
  });

  return res.status(200).json(estado);
};
