import ConfigSnapshot from "../../models/ConfigSnapshot";
import ConfigSnapshotApplication from "../../models/ConfigSnapshotApplication";
import { resumenDeInstantanea } from "./comun";

/** Instantaneas de la plataforma, sin su paquete, las mas nuevas primero. */
const ListConfigSnapshotsService = async () => {
  const instantaneas = await ConfigSnapshot.findAll({
    attributes: { exclude: ["payload"] },
    order: [["createdAt", "DESC"]]
  });
  return instantaneas.map(resumenDeInstantanea);
};

/** Modulos de una instantanea ya cargados en una empresa. */
export const ListAppliedModulesService = async (
  snapshotId: number,
  companyId: number
): Promise<string[]> => {
  const carga = await ConfigSnapshotApplication.findOne({
    where: { snapshotId, companyId }
  });
  return carga?.modules || [];
};

export default ListConfigSnapshotsService;
