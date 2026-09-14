import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import CompanyConfigClone from "../../models/CompanyConfigClone";
import logger from "../../utils/logger";
import {
  MODULOS,
  ResumenClon,
  aplicarPaquete,
  archivoDeEmpresa,
  borrarArchivosCopiados,
  capturarPaquete
} from "../ConfigPackageService/motor";

export { borrarArchivosCopiados };
export type { ResumenClon };

/**
 * Copia la configuracion de una empresa a otra ya creada.
 *
 * Solo para superadministrador (el controlador lo comprueba). Pensado para
 * montar una empresa nueva a partir de otra que sirve de plantilla.
 *
 * QUE SE COPIA
 *   Todos los modulos del motor de paquetes: etiquetas y columnas del
 *   Kanban, colas con su arbol de opciones y sus productos, integraciones
 *   (SIN credenciales), chatbot, listas de ficheros con sus archivos,
 *   mensajes rapidos con sus adjuntos y componentes, prompts (SIN claves de
 *   IA), ajustes de la empresa y de cumpleanos, ajustes de campana, motivos
 *   de finalizacion, presets de webhook propios y webhooks.
 *
 * QUE NO SE COPIA
 *   Canales y sus credenciales, usuarios, datos operativos (contactos,
 *   tickets, mensajes, campanas, ventas, citas...), anuncios y todo
 *   FlowBuilder, que queda para una segunda fase.
 *
 * COMO
 *   Captura la origen y aplica el paquete a la destino en UNA transaccion:
 *   si algo falla a mitad, la destino queda como estaba. Los archivos
 *   copiados, que la base no puede deshacer, se borran a mano en ese caso.
 *   Los detalles de cada modulo estan en ConfigPackageService/motor.ts.
 */

interface Peticion {
  sourceCompanyId: number;
  targetCompanyId: number;
  userId?: number;
}

const CloneCompanyConfigService = async ({
  sourceCompanyId,
  targetCompanyId,
  userId
}: Peticion): Promise<ResumenClon> => {
  const origen = Number(sourceCompanyId);
  const destino = Number(targetCompanyId);

  if (!Number.isInteger(origen) || !Number.isInteger(destino) || origen <= 0 || destino <= 0) {
    throw new AppError("ERR_CLONE_INVALID_COMPANIES", 400);
  }

  if (origen === destino) {
    throw new AppError("ERR_CLONE_SAME_COMPANY", 400);
  }

  const [empresaOrigen, empresaDestino] = await Promise.all([
    Company.findByPk(origen),
    Company.findByPk(destino)
  ]);

  if (!empresaOrigen || !empresaDestino) {
    throw new AppError("ERR_CLONE_COMPANY_NOT_FOUND", 404);
  }

  const archivosCreados: string[] = [];

  try {
    const resumen = await sequelize.transaction(t =>
      clonarConfiguracion(t, origen, destino, archivosCreados, userId)
    );

    logger.info(
      `[Clon] configuracion de la empresa ${origen} copiada a ${destino}: ${JSON.stringify(resumen.copiados)}`
    );

    return resumen;
  } catch (err) {
    // La transaccion ya se deshizo; los archivos, no.
    borrarArchivosCopiados(archivosCreados);
    throw err;
  }
};

/**
 * Nucleo del clonado, dentro de una transaccion que abre quien llama.
 *
 * Lo usan este servicio y DuplicateCompanyService, que crea la empresa
 * destino y la clona en la MISMA transaccion para que un fallo no deje una
 * empresa a medias. No valida las empresas: eso es cosa de quien llama.
 *
 * Cada archivo copiado se anota en `archivosCreados`. Si la transaccion
 * falla, quien llama tiene que borrarlos con borrarArchivosCopiados.
 */
export const clonarConfiguracion = async (
  t: Transaction,
  origen: number,
  destino: number,
  archivosCreados: string[],
  userId?: number
): Promise<ResumenClon> => {
  // Un segundo clonado del mismo par se BLOQUEA: al ser aditivo, duplicaria
  // todo. Se comprueba dentro de la transaccion, y el indice unico de la
  // tabla cubre la carrera entre dos peticiones a la vez.
  const previo = await CompanyConfigClone.findOne({
    where: { sourceCompanyId: origen, targetCompanyId: destino },
    transaction: t
  });
  if (previo) {
    throw new AppError("ERR_CLONE_ALREADY_DONE", 409);
  }

  const paquete = await capturarPaquete(t, origen, [...MODULOS]);

  const { resumen } = await aplicarPaquete(t, destino, paquete, {
    modulos: paquete.modulos,
    origen,
    archivosCreados,
    leerArchivo: archivo => archivoDeEmpresa(origen, archivo)
  });

  await CompanyConfigClone.create(
    {
      sourceCompanyId: origen,
      targetCompanyId: destino,
      userId: userId || null,
      summary: JSON.stringify(resumen)
    } as any,
    { transaction: t }
  );

  return resumen;
};

export default CloneCompanyConfigService;
