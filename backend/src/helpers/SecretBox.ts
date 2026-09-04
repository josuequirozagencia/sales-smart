import crypto from "crypto";

/**
 * Cifrado de secretos guardados en la base.
 *
 * Se usa AES-256-GCM y no un cifrado simple porque GCM ademas AUTENTICA:
 * si alguien altera un byte del texto cifrado, el descifrado falla en vez
 * de devolver basura silenciosamente. Con un token de acceso eso importa,
 * porque un valor corrompido pero aceptado provocaria fallos raros contra
 * la API de Google en lugar de un error claro.
 *
 * Cada cifrado lleva su propio vector de inicializacion aleatorio, de modo
 * que dos tokens identicos no producen el mismo texto cifrado y no se
 * puede deducir que dos empresas comparten credencial.
 */

/** Marca de version al principio, para poder cambiar de algoritmo despues. */
const VERSION = "v1";
const ALGORITMO = "aes-256-gcm";
const LONGITUD_IV = 12; // recomendado para GCM
const LONGITUD_TAG = 16;

/**
 * Sal fija para derivar la clave.
 *
 * Fija y no aleatoria a proposito: la derivacion tiene que dar SIEMPRE la
 * misma clave, o lo cifrado ayer no se podria leer hoy. La proteccion no
 * viene de esta sal sino del secreto del que se deriva.
 */
const SAL = "chatia.token.encryption.v1";

let claveCache: Buffer = null;

/**
 * Clave de 32 bytes.
 *
 * Se prefiere una variable dedicada; si no existe, se deriva del secreto
 * de sesion que la instalacion ya tiene, para que el cifrado funcione sin
 * configuracion adicional.
 *
 * Si no hubiera ninguno de los dos se lanza un error en vez de guardar en
 * claro. Un fallo ruidoso es preferible a creer que algo esta cifrado
 * cuando no lo esta.
 *
 * OJO: cambiar el secreto del que se deriva deja ilegible lo ya cifrado.
 * Para los tokens de Google eso solo significa volver a conectar la
 * cuenta, no perder datos.
 */
const obtenerClave = (): Buffer => {
  if (claveCache) return claveCache;

  const material =
    process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || "";

  if (!material) {
    throw new Error(
      "ERR_NO_ENCRYPTION_KEY: define TOKEN_ENCRYPTION_KEY o JWT_SECRET"
    );
  }

  claveCache = crypto.scryptSync(material, SAL, 32);
  return claveCache;
};

/** ¿Es un valor ya cifrado por esta funcion? */
export const isEncrypted = (valor: string): boolean =>
  typeof valor === "string" && valor.startsWith(`${VERSION}.`);

export const encrypt = (texto: string | null): string | null => {
  // Nulo y vacio se dejan tal cual: cifrar la ausencia de un token no
  // aporta nada y complicaria las comprobaciones de "hay token?".
  if (texto === null || texto === undefined || texto === "") return texto;

  // No cifrar dos veces si el valor ya viene cifrado.
  if (isEncrypted(texto)) return texto;

  const iv = crypto.randomBytes(LONGITUD_IV);
  const cipher = crypto.createCipheriv(ALGORITMO, obtenerClave(), iv);

  const cifrado = Buffer.concat([
    cipher.update(String(texto), "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    cifrado.toString("base64")
  ].join(".");
};

export const decrypt = (valor: string | null): string | null => {
  if (valor === null || valor === undefined || valor === "") return valor;

  // Valor anterior al cifrado. Se devuelve como esta para que una base a
  // medio migrar siga funcionando; al volver a guardarlo quedara cifrado.
  if (!isEncrypted(valor)) return valor;

  try {
    const [, ivB64, tagB64, datosB64] = valor.split(".");
    const decipher = crypto.createDecipheriv(
      ALGORITMO,
      obtenerClave(),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(datosB64, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch (err) {
    // Llega aqui si el dato fue manipulado o si cambio el secreto del que
    // se deriva la clave. Se devuelve null —"no hay token"— en vez de
    // propagar el error: quien lo use pedira reconectar la cuenta, que es
    // la salida correcta, en lugar de tumbar el arranque del servidor.
    return null;
  }
};

export default { encrypt, decrypt, isEncrypted };
