import axios from "axios";
import AppError from "../../errors/AppError";
import MetaConfig from "../../models/MetaConfig";
import { encrypt, decrypt } from "../../helpers/SecretBox";
import logger from "../../utils/logger";
import {
  META_GRAPH_VERSION,
  TipoErrorMeta,
  clasificarError
} from "../ConversionServices/MetaConversionsProvider";
import { reencolarBloqueados } from "../ConversionServices/ConversionService";

/**
 * Credenciales de Meta Conversions API por empresa.
 *
 * Todo recibe el companyId de quien pregunta (el controlador lo saca del
 * token, nunca del cuerpo): una empresa solo ve y toca lo suyo.
 *
 * El token se cifra con SecretBox y NUNCA sale de aqui: la respuesta dice
 * si hay uno y sus 4 ultimos caracteres, nada mas.
 */

export interface EstadoMeta {
  configured: boolean;
  datasetId: string;
  hasToken: boolean;
  tokenLast4: string | null;
  testEventCode: string;
  isActive: boolean;
  /** not_configured | unverified | ok | error */
  status: string;
  lastError: string | null;
  lastErrorAt: Date | null;
  lastSuccessAt: Date | null;
  verifiedAt: Date | null;
}

const estadoDe = (fila: MetaConfig | null): EstadoMeta => {
  if (!fila) {
    return {
      configured: false,
      datasetId: "",
      hasToken: false,
      tokenLast4: null,
      testEventCode: "",
      isActive: false,
      status: "not_configured",
      lastError: null,
      lastErrorAt: null,
      lastSuccessAt: null,
      verifiedAt: null
    };
  }

  return {
    configured: true,
    datasetId: fila.datasetId || "",
    hasToken: Boolean(fila.accessToken),
    tokenLast4: fila.tokenLast4 || null,
    testEventCode: fila.testEventCode || "",
    isActive: fila.isActive,
    status: fila.status,
    lastError: fila.lastError || null,
    lastErrorAt: fila.lastErrorAt || null,
    lastSuccessAt: fila.lastSuccessAt || null,
    verifiedAt: fila.verifiedAt || null
  };
};

export const verConfigMeta = async (companyId: number): Promise<EstadoMeta> =>
  estadoDe(await MetaConfig.findOne({ where: { companyId } }));

export type ResultadoVerificacion =
  | { ok: true }
  | { ok: false; tipo: TipoErrorMeta; mensaje: string };

export type Verificador = (datasetId: string, token: string) => Promise<ResultadoVerificacion>;

/**
 * Comprueba que el token llega al dataset: lee el dataset con ese token.
 * El token va en la cabecera y no en la URL.
 */
export const verificarEnMeta: Verificador = async (datasetId, token) => {
  try {
    await axios.get(`https://graph.facebook.com/${META_GRAPH_VERSION}/${datasetId}`, {
      params: { fields: "id,name" },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });
    return { ok: true };
  } catch (err) {
    const { tipo, mensaje } = clasificarError(err);
    return { ok: false, tipo, mensaje };
  }
};

export interface DatosConfigMeta {
  datasetId?: string;
  /** Vacio o ausente: se conserva el guardado. */
  accessToken?: string;
  testEventCode?: string;
  isActive?: boolean;
}

/**
 * Crea o actualiza la configuracion de la empresa.
 *
 * Si cambian las credenciales (o estaban con error) se verifican contra
 * Meta. Se guarda IGUAL si la verificacion falla, con el estado y el error,
 * para que la pantalla diga que esta mal; si Meta no responde, queda "sin
 * verificar". Con credenciales validas se reencola lo que estaba bloqueado.
 */
export const guardarConfigMeta = async (
  companyId: number,
  datos: DatosConfigMeta,
  verificar: Verificador = verificarEnMeta
): Promise<EstadoMeta> => {
  const datasetId = String(datos.datasetId ?? "").trim();
  if (!/^\d{5,25}$/.test(datasetId)) {
    throw new AppError("ERR_META_INVALID_DATASET", 400);
  }

  const tokenNuevo = typeof datos.accessToken === "string" ? datos.accessToken.trim() : "";
  if (tokenNuevo && (tokenNuevo.length < 20 || /\s/.test(tokenNuevo))) {
    throw new AppError("ERR_META_INVALID_TOKEN", 400);
  }

  const testEventCode = String(datos.testEventCode ?? "").trim();
  if (testEventCode && !/^[A-Za-z0-9_-]{1,40}$/.test(testEventCode)) {
    throw new AppError("ERR_META_INVALID_TEST_CODE", 400);
  }

  const fila = await MetaConfig.findOne({ where: { companyId } });

  // Sin token nuevo se usa el guardado; si no hay (o no se puede leer
  // porque cambio la clave de cifrado), hay que escribirlo.
  const token = tokenNuevo || (fila ? decrypt(fila.accessToken) : null);
  if (!token) {
    throw new AppError("ERR_META_TOKEN_REQUIRED", 400);
  }

  const cambios: Record<string, any> = {
    datasetId,
    testEventCode: testEventCode || null,
    isActive: datos.isActive !== false
  };
  if (tokenNuevo) {
    cambios.accessToken = encrypt(tokenNuevo);
    cambios.tokenLast4 = tokenNuevo.slice(-4);
  }

  const cambiaronCredenciales = !fila || Boolean(tokenNuevo) || fila.datasetId !== datasetId;

  if (cambiaronCredenciales || fila.status === "error") {
    const resultado = await verificar(datasetId, token);
    if (resultado.ok === true) {
      Object.assign(cambios, { status: "ok", verifiedAt: new Date(), lastError: null });
    } else if (resultado.tipo === "transient") {
      Object.assign(cambios, {
        status: "unverified",
        lastError: `No se pudo verificar ahora: ${resultado.mensaje}`,
        lastErrorAt: new Date()
      });
    } else {
      Object.assign(cambios, { status: "error", lastError: resultado.mensaje, lastErrorAt: new Date() });
    }
  }

  const guardada = fila
    ? await fila.update(cambios)
    : await MetaConfig.create({ companyId, ...cambios } as any);

  if (guardada.isActive && guardada.status !== "error") {
    const reencolados = await reencolarBloqueados(companyId);
    if (reencolados) {
      logger.info(`[MetaConversions] empresa ${companyId}: ${reencolados} evento(s) bloqueados vuelven a la cola`);
    }
  }

  return estadoDe(guardada);
};
