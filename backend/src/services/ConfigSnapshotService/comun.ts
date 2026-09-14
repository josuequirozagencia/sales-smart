import path from "path";
import uploadConfig from "../../config/upload";
import AppError from "../../errors/AppError";
import ConfigSnapshot from "../../models/ConfigSnapshot";
import {
  ArchivoPaquete,
  Modulo,
  UbicacionArchivo,
  conDependencias,
  esModulo
} from "../ConfigPackageService/motor";

/**
 * Carpeta de las instantaneas: backend/snapshots/snapshot{id}/.
 *
 * Fuera de public/ a proposito: public se sirve tal cual por HTTP y una
 * instantanea no es de ninguna empresa. Tiene que persistir entre
 * despliegues, igual que public.
 */
export const CARPETA_INSTANTANEAS = path.resolve(
  (uploadConfig as any).directory,
  "..",
  "snapshots"
);

export const carpetaDeInstantanea = (id: number): string =>
  path.join(CARPETA_INSTANTANEAS, `snapshot${id}`);

export const archivoDeInstantanea = (
  id: number,
  archivo: ArchivoPaquete
): UbicacionArchivo => {
  const partes = [
    archivo.carpeta,
    ...(archivo.lista !== undefined && archivo.lista !== null ? [String(archivo.lista)] : []),
    archivo.nombre
  ];
  return {
    ruta: path.join(carpetaDeInstantanea(id), ...partes),
    etiqueta: path.join(`snapshot${id}`, ...partes)
  };
};

/**
 * Valida una lista de modulos pedida por el cliente y le suma sus
 * dependencias. Con `permitidos`, todos tienen que estar entre ellos.
 */
export const validarModulos = (valor: unknown, permitidos?: string[]): Modulo[] => {
  if (!Array.isArray(valor) || !valor.length || !valor.every(esModulo)) {
    throw new AppError("ERR_SNAPSHOT_INVALID_MODULES", 400);
  }
  if (permitidos && !valor.every(m => permitidos.includes(m))) {
    throw new AppError("ERR_SNAPSHOT_INVALID_MODULES", 400);
  }
  return conDependencias(valor);
};

/** Lo que se devuelve de una instantanea: todo menos el paquete. */
export const resumenDeInstantanea = (s: ConfigSnapshot) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  sourceCompanyId: s.sourceCompanyId,
  sourceCompanyName: s.sourceCompanyName,
  modules: s.modules,
  counts: s.counts,
  missingFiles: s.missingFiles,
  createdByUserId: s.createdByUserId,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt
});
