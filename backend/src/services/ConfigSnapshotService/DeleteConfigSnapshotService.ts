import fs from "fs";
import AppError from "../../errors/AppError";
import ConfigSnapshot from "../../models/ConfigSnapshot";
import logger from "../../utils/logger";
import { carpetaDeInstantanea } from "./comun";

/**
 * Borra una instantanea y su carpeta de archivos.
 *
 * Sus registros de carga se borran en cascada. Lo que ya se cargo en las
 * empresas se queda: es de ellas.
 */
const DeleteConfigSnapshotService = async (snapshotId: number): Promise<void> => {
  const id = Number(snapshotId);
  const instantanea = Number.isInteger(id) && id > 0 ? await ConfigSnapshot.findByPk(id) : null;

  if (!instantanea) {
    throw new AppError("ERR_SNAPSHOT_NOT_FOUND", 404);
  }

  await instantanea.destroy();
  fs.rmSync(carpetaDeInstantanea(id), { recursive: true, force: true });

  logger.info(`[Instantanea] ${id} «${instantanea.name}» borrada`);
};

export default DeleteConfigSnapshotService;
