import fs from "fs";
import path from "path";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import ConfigSnapshot from "../../models/ConfigSnapshot";
import logger from "../../utils/logger";
import {
  archivoDeEmpresa,
  capturarPaquete,
  contarPaquete
} from "../ConfigPackageService/motor";
import {
  archivoDeInstantanea,
  carpetaDeInstantanea,
  resumenDeInstantanea,
  validarModulos
} from "./comun";

/**
 * Crea una instantanea: captura los modulos pedidos de una empresa y los
 * guarda congelados, con copia de sus archivos.
 *
 * Solo para superadministrador (el controlador lo comprueba). La captura ya
 * sale sin secretos (ver capturarPaquete): la instantanea nunca guarda
 * credenciales de integraciones, claves de IA ni flujos de webhooks.
 *
 * Fila y archivos van juntos: si algo falla, la transaccion se deshace y la
 * carpeta de la instantanea se borra.
 */

interface Peticion {
  sourceCompanyId: number;
  name: string;
  description?: string;
  modules: unknown;
  userId: number;
}

const CreateConfigSnapshotService = async ({
  sourceCompanyId,
  name,
  description,
  modules,
  userId
}: Peticion) => {
  const origen = Number(sourceCompanyId);
  const nombre = String(name || "").trim();

  if (nombre.length < 2) {
    throw new AppError("ERR_SNAPSHOT_INVALID_NAME", 400);
  }

  const modulos = validarModulos(modules);

  const empresa = Number.isInteger(origen) && origen > 0 ? await Company.findByPk(origen) : null;
  if (!empresa) {
    throw new AppError("ERR_SNAPSHOT_COMPANY_NOT_FOUND", 404);
  }

  if (await ConfigSnapshot.findOne({ where: { name: nombre } })) {
    throw new AppError("ERR_SNAPSHOT_NAME_IN_USE", 409);
  }

  let carpeta: string | null = null;

  try {
    const instantanea = await sequelize.transaction(async t => {
      const paquete = await capturarPaquete(t, origen, modulos);

      const creada = await ConfigSnapshot.create(
        {
          name: nombre,
          description: String(description || "").trim() || null,
          sourceCompanyId: origen,
          sourceCompanyName: empresa.name,
          modules: paquete.modulos,
          payload: paquete,
          counts: contarPaquete(paquete),
          missingFiles: [],
          createdByUserId: userId
        } as any,
        { transaction: t }
      );

      carpeta = carpetaDeInstantanea(creada.id);
      const faltan: string[] = [];

      for (const archivo of paquete.archivos) {
        // Solo nombres sueltos: un valor con ruta no se lee ni se escribe.
        if (!archivo.nombre || path.basename(archivo.nombre) !== archivo.nombre) {
          faltan.push(archivo.nombre);
          continue;
        }

        const origenArchivo = archivoDeEmpresa(origen, archivo);
        if (!fs.existsSync(origenArchivo.ruta)) {
          faltan.push(origenArchivo.etiqueta);
          continue;
        }

        const { ruta } = archivoDeInstantanea(creada.id, archivo);
        fs.mkdirSync(path.dirname(ruta), { recursive: true });
        // Dos mensajes rapidos pueden compartir adjunto.
        if (!fs.existsSync(ruta)) fs.copyFileSync(origenArchivo.ruta, ruta);
      }

      if (faltan.length) {
        await creada.update({ missingFiles: faltan }, { transaction: t });
      }

      return creada;
    });

    logger.info(
      `[Instantanea] ${instantanea.id} «${instantanea.name}» creada desde la empresa ${origen}: ${JSON.stringify(instantanea.counts)}`
    );

    return resumenDeInstantanea(instantanea);
  } catch (err) {
    if (carpeta) fs.rmSync(carpeta, { recursive: true, force: true });

    // Otra peticion tomo el mismo nombre entre la comprobacion y el insert.
    if (err?.name === "SequelizeUniqueConstraintError") {
      throw new AppError("ERR_SNAPSHOT_NAME_IN_USE", 409);
    }
    throw err;
  }
};

export default CreateConfigSnapshotService;
