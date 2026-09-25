/**
 * LID y telefono.
 *
 * WhatsApp esta migrando a identificadores anonimos (LID). Cuando un cliente
 * escribe, el mensaje puede venir de "262934307541069@lid" en vez de su
 * numero. Hasta ahora ese identificador se guardaba como si fuera el telefono
 * del contacto: de 55 contactos de la empresa 1, 47 tenian por numero un LID.
 *
 * Eso rompe tres cosas a la vez:
 *  - el nombre, que se queda en los 15 digitos del LID cuando no hay pushName
 *    (de ahi los circulos con "25" o "21" en la lista),
 *  - la foto, porque la consulta contra ese identificador falla y se guarda
 *    nopicture.png,
 *  - cualquier cosa que necesite el telefono de verdad, como llamar.
 *
 * El telefono viene en el propio mensaje: WhatsApp adjunta `senderPn` (y
 * `participantPn` en grupos) junto al LID. Aqui se extrae.
 *
 * Lo que NO se hace: cambiar la direccion de envio. Se envia al @lid, que es
 * una direccion valida; fabricar un telefono a partir del LID tumbaba la
 * conexion (ver normalizeJid en utils).
 */

/** Clave de un mensaje de Baileys, con los campos que traen el telefono. */
export interface ClaveMensaje {
  remoteJid?: string | null;
  participant?: string | null;
  senderPn?: string | null;
  participantPn?: string | null;
  fromMe?: boolean | null;
}

export const esLid = (jid?: string | null): boolean =>
  typeof jid === "string" && jid.includes("@lid");

/** "593986567051@s.whatsapp.net" -> "593986567051" */
export const soloDigitos = (jid?: string | null): string =>
  (jid || "").replace(/\D/g, "");

/**
 * Un telefono de WhatsApp tiene entre 8 y 15 digitos. Los LID rondan los 15
 * tambien, asi que la longitud no distingue: lo que distingue es el sufijo
 * del JID, y por eso esto solo se llama sobre un @s.whatsapp.net.
 */
const pareceTelefono = (digitos: string): boolean =>
  /^\d{8,15}$/.test(digitos);

/**
 * El telefono real que acompana a un mensaje direccionado por LID, o undefined
 * si el mensaje no lo trae (mensajes antiguos, o enviados por nosotros).
 */
export const telefonoDeClave = (
  clave?: ClaveMensaje | null
): string | undefined => {
  if (!clave || clave.fromMe) return undefined;

  const candidatos = [clave.senderPn, clave.participantPn];

  for (const jid of candidatos) {
    if (typeof jid === "string" && jid.includes("@s.whatsapp.net")) {
      const digitos = soloDigitos(jid);
      if (pareceTelefono(digitos)) return digitos;
    }
  }

  return undefined;
};

/** El LID al que corresponde ese telefono, sin sufijo: "262934307541069". */
export const lidDeClave = (clave?: ClaveMensaje | null): string | undefined => {
  if (!clave) return undefined;

  const candidatos = [clave.participant, clave.remoteJid];

  for (const jid of candidatos) {
    if (esLid(jid)) {
      const digitos = soloDigitos(jid);
      if (digitos) return digitos;
    }
  }

  return undefined;
};

export interface ParLidTelefono {
  lid: string;
  telefono: string;
}

/**
 * Saca el par (LID, telefono) de un mensaje ya guardado. Sirve para reparar
 * los contactos que se crearon antes de todo esto: el historial de mensajes
 * ya tiene la correspondencia, no hay que preguntarsela a WhatsApp.
 */
export const parDeMensajeGuardado = (
  dataJson?: string | null
): ParLidTelefono | null => {
  if (!dataJson || !dataJson.includes("senderPn")) return null;

  let clave: ClaveMensaje;
  try {
    clave = JSON.parse(dataJson)?.key;
  } catch (e) {
    return null;
  }

  const telefono = telefonoDeClave(clave);
  const lid = lidDeClave(clave);

  return telefono && lid ? { lid, telefono } : null;
};

/**
 * Un nombre que es solo digitos no es un nombre: es el identificador que se
 * colo por falta de pushName. Saberlo permite reemplazarlo en cuanto llega
 * uno de verdad, en vez de dejarlo fijo para siempre.
 */
export const nombreEsIdentificador = (nombre?: string | null): boolean =>
  typeof nombre === "string" && /^\d{6,}$/.test(nombre.trim());

/**
 * La aplicacion guardaba una URL a nopicture.png cuando fallaba la consulta
 * de la foto. Eso dejaba al contacto marcado como "ya tiene foto" y no se
 * volvia a intentar nunca.
 */
export const esFotoVacia = (url?: string | null): boolean =>
  !url || url.trim() === "" || url.includes("nopicture");
