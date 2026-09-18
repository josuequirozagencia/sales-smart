import crypto from "crypto";
import GhlConfig from "../../models/GhlConfig";
import { encrypt, decrypt } from "../../helpers/SecretBox";
import AppError from "../../errors/AppError";

/**
 * Credenciales de GoHighLevel por empresa.
 *
 * Viven en su propia tabla, `GhlConfigs`. Se penso usar `Integrations`, la
 * tabla generica del proyecto, pero no encaja: no tiene las columnas que
 * hacen falta y su modelo ni siquiera esta registrado en Sequelize. El
 * detalle esta en la migracion 20260908120200.
 *
 * El token se cifra con el mismo SecretBox que ya protege los de Google.
 * Sale descifrado solo dentro de este modulo y de quien llame a
 * `obtenerCredenciales`; ninguna respuesta HTTP lo devuelve nunca.
 *
 * UNA location por empresa. Es lo que hace falta hoy: una empresa puede
 * tener a la vez una conexion Meta directa y una de GHL porque son dos
 * filas distintas de `Whatsapp`, y eso ya funciona. Si algun dia una misma
 * empresa necesitara DOS locations, el `locationId` tendria que mudarse a
 * la fila de `Whatsapp`; no se construye ahora porque no hay caso.
 */

export interface Flujo {
  id: string;
  name: string;
}

export interface CredencialesGhl {
  token: string;
  locationId: string;
}

const leerFlujos = (texto: string): Flujo[] => {
  if (!texto) return [];
  try {
    const valor = JSON.parse(texto);
    return Array.isArray(valor) ? valor : [];
  } catch (err) {
    // Un JSON corrupto no debe tumbar el canal: se trata como lista vacia.
    return [];
  }
};

/** La fila de configuracion, sin descifrar nada. */
export const buscarIntegracion = async (
  companyId: number
): Promise<GhlConfig | null> => GhlConfig.findOne({ where: { companyId } });

/**
 * Lo que se puede enviar al frontend: sin token.
 *
 * Se devuelve `tieneToken` en vez del valor para que la pantalla pueda
 * decir "ya hay uno guardado" sin que el secreto salga del servidor.
 */
export const verConfiguracion = async (companyId: number) => {
  const fila = await buscarIntegracion(companyId);

  if (!fila) {
    return {
      conectado: false,
      tieneToken: false,
      locationId: "",
      workflows: [] as Flujo[],
      webhookSecret: "",
      isActive: false,
      metaBusinessId: "",
      tieneTokenMeta: false,
      metaTokenLast4: null as string | null
    };
  }

  return {
    conectado: true,
    tieneToken: Boolean(decrypt(fila.token)),
    locationId: fila.locationId || "",
    workflows: leerFlujos(fila.workflows),
    webhookSecret: fila.webhookSecret || "",
    isActive: fila.isActive,
    // Del token de Meta solo sale si hay uno y sus 4 ultimos caracteres.
    metaBusinessId: fila.metaBusinessId || "",
    tieneTokenMeta: Boolean(fila.metaAccessToken && decrypt(fila.metaAccessToken)),
    metaTokenLast4: fila.metaAccessToken ? fila.metaAccessTokenLast4 || null : null
  };
};

/**
 * Credenciales de Meta para leer las plantillas de la cuenta de WhatsApp
 * Business que hay detras de GHL, o null si no estan completas.
 */
export const obtenerCredencialesMeta = async (
  companyId: number
): Promise<{ businessId: string; accessToken: string } | null> => {
  const fila = await buscarIntegracion(companyId);
  if (!fila?.metaBusinessId || !fila.metaAccessToken) return null;
  const accessToken = decrypt(fila.metaAccessToken);
  // Dato manipulado o clave de cifrado cambiada: como si no hubiera token.
  if (!accessToken) return null;
  return { businessId: fila.metaBusinessId, accessToken };
};

/**
 * Credenciales listas para llamar a la API.
 *
 * Lanza si faltan o si el canal esta apagado: quien envia un mensaje
 * prefiere un error claro a una peticion que sale sin cabecera y vuelve
 * con un 401 de GHL.
 */
export const obtenerCredenciales = async (
  companyId: number
): Promise<CredencialesGhl> => {
  const fila = await buscarIntegracion(companyId);

  if (!fila || !fila.isActive) {
    throw new AppError("ERR_GHL_NO_CONFIGURADO", 400);
  }

  const token = decrypt(fila.token);

  // decrypt devuelve null si el dato fue manipulado o si cambio la clave de
  // cifrado. Se trata igual que "no hay token": hay que volver a guardarlo.
  if (!token || !fila.locationId) {
    throw new AppError("ERR_GHL_CREDENCIALES_INCOMPLETAS", 400);
  }

  return { token, locationId: fila.locationId };
};

interface DatosGuardado {
  companyId: number;
  /** Solo si se quiere cambiar. Vacio o ausente deja el que ya habia. */
  token?: string;
  locationId: string;
  isActive: boolean;
  workflows?: Flujo[];
  /** Opcional. Undefined no lo toca; cadena vacia lo borra. */
  metaBusinessId?: string;
  /** Solo si se quiere cambiar. Vacio o ausente deja el que ya habia. */
  metaAccessToken?: string;
  /** Borra las credenciales de Meta (ID de cuenta y token). */
  quitarMeta?: boolean;
}

const camposMeta = (datos: DatosGuardado): Record<string, unknown> => {
  if (datos.quitarMeta) return { metaBusinessId: null, metaAccessToken: null, metaAccessTokenLast4: null };
  const campos: Record<string, unknown> = {};
  if (datos.metaBusinessId !== undefined) campos.metaBusinessId = datos.metaBusinessId.trim() || null;
  const token = (datos.metaAccessToken || "").trim();
  if (token) {
    campos.metaAccessToken = encrypt(token);
    campos.metaAccessTokenLast4 = token.slice(-4);
  }
  return campos;
};

/**
 * Guarda o actualiza la configuracion.
 *
 * Si no llega token nuevo se conserva el guardado. Es lo que permite a la
 * pantalla editar el locationId o apagar el canal sin obligar a volver a
 * escribir el secreto, que ademas nunca se le muestra.
 */
export const guardarConfiguracion = async (
  datos: DatosGuardado
): Promise<void> => {
  const { companyId, token, locationId, isActive, workflows } = datos;

  const fila = await buscarIntegracion(companyId);

  if (!fila) {
    if (!token) {
      throw new AppError("ERR_GHL_FALTA_TOKEN", 400);
    }
    await GhlConfig.create({
      companyId,
      token: encrypt(token),
      locationId,
      // Se genera una vez, al crear.
      webhookSecret: crypto.randomBytes(24).toString("hex"),
      workflows: JSON.stringify(workflows || []),
      isActive,
      ...camposMeta(datos)
    } as any);
    return;
  }

  await fila.update({
    locationId,
    isActive,
    // El secreto del webhook NO se regenera al editar: cambiarlo dejaria
    // muerta la URL ya pegada en el panel de GHL y los mensajes dejarian de
    // entrar sin que nadie tocara nada alli.
    webhookSecret: fila.webhookSecret || crypto.randomBytes(24).toString("hex"),
    ...(workflows ? { workflows: JSON.stringify(workflows) } : {}),
    ...(token ? { token: encrypt(token) } : {}),
    ...camposMeta(datos)
  });
};

export default {
  buscarIntegracion,
  verConfiguracion,
  obtenerCredenciales,
  obtenerCredencialesMeta,
  guardarConfiguracion
};
