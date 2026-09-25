import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import ConfigSnapshot from "../../models/ConfigSnapshot";
import ConfigSnapshotApplication from "../../models/ConfigSnapshotApplication";
import logger from "../../utils/logger";
import {
  MODULOS,
  Modulo,
  aplicarPaquete,
  borrarArchivosCopiados
} from "../ConfigPackageService/motor";
import { archivoDeInstantanea, validarModulos } from "./comun";

/**
 * Carga una instantanea (o parte de ella) en una empresa.
 *
 * El controlador decide la empresa: el superadministrador, cualquiera; el
 * admin de una empresa, solo la suya.
 *
 * - Es aditiva, como el clonado: lo que la empresa ya tiene no se borra.
 * - Se puede cargar por partes. Un modulo ya cargado de esta instantanea en
 *   esta empresa no se vuelve a cargar (lo duplicaria): se salta y se
 *   informa. Si todo lo pedido estaba cargado, se rechaza.
 * - Las cargas guardan los mapas de ids, asi que una carga posterior (por
 *   ejemplo, el chatbot despues de las listas de ficheros) enlaza con lo que
 *   cargo la anterior.
 *
 * Todo en una transaccion; si falla, se borran los archivos ya copiados.
 */

interface Peticion {
  snapshotId: number;
  companyId: number;
  modules: unknown;
  userId: number;
}

const ApplyConfigSnapshotService = async ({
  snapshotId,
  companyId,
  modules,
  userId
}: Peticion) => {
  const id = Number(snapshotId);
  const empresa = Number(companyId);

  const instantanea = Number.isInteger(id) && id > 0 ? await ConfigSnapshot.findByPk(id) : null;
  if (!instantanea) {
    throw new AppError("ERR_SNAPSHOT_NOT_FOUND", 404);
  }

  const existeEmpresa =
    Number.isInteger(empresa) && empresa > 0 ? await Company.findByPk(empresa) : null;
  if (!existeEmpresa) {
    throw new AppError("ERR_SNAPSHOT_COMPANY_NOT_FOUND", 404);
  }

  // Con dependencias, para cargar; sin ellas, para informar: una dependencia
  // que ya estaba cargada no es algo que el usuario pidiera.
  const pedidos = validarModulos(modules, instantanea.modules);
  const explicitos = modules as string[];
  const archivosCreados: string[] = [];

  try {
    const resultado = await sequelize.transaction(async t => {
      const previa = await ConfigSnapshotApplication.findOne({
        where: { snapshotId: id, companyId: empresa },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      const yaCargados = (previa?.modules || []) as Modulo[];
      const aCargar = pedidos.filter(m => !yaCargados.includes(m));

      if (!aCargar.length) {
        throw new AppError("ERR_SNAPSHOT_ALREADY_APPLIED", 409);
      }

      const { resumen, mapas } = await aplicarPaquete(t, empresa, instantanea.payload, {
        modulos: aCargar,
        origen: instantanea.sourceCompanyId,
        archivosCreados,
        mapasPrevios: previa?.idMaps,
        leerArchivo: archivo => archivoDeInstantanea(id, archivo)
      });

      const cargados = MODULOS.filter(m => yaCargados.includes(m) || aCargar.includes(m));
      const datos = {
        snapshotId: id,
        companyId: empresa,
        userId,
        modules: cargados,
        idMaps: mapas,
        summary: JSON.stringify(resumen)
      };

      if (previa) {
        await previa.update(datos, { transaction: t });
      } else {
        await ConfigSnapshotApplication.create(datos as any, { transaction: t });
      }

      return {
        instantanea: { id, name: instantanea.name },
        companyId: empresa,
        cargados: aCargar,
        yaEstaban: pedidos.filter(m => yaCargados.includes(m) && explicitos.includes(m)),
        resumen
      };
    });

    logger.info(
      `[Instantanea] ${id} cargada en la empresa ${empresa} (${resultado.cargados.join(", ")}): ${JSON.stringify(resultado.resumen.copiados)}`
    );

    return resultado;
  } catch (err) {
    // La transaccion ya se deshizo; los archivos copiados, no.
    borrarArchivosCopiados(archivosCreados);

    // Dos primeras cargas a la vez en la misma empresa: la segunda choca con
    // el indice unico y se trata como ya cargada.
    if (
      err?.name === "SequelizeUniqueConstraintError" &&
      err.parent?.table === "ConfigSnapshotApplications"
    ) {
      throw new AppError("ERR_SNAPSHOT_ALREADY_APPLIED", 409);
    }
    throw err;
  }
};

export default ApplyConfigSnapshotService;
