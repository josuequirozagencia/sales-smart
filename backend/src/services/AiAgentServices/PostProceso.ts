/**
 * Tratamiento de la respuesta ya generada por el modelo, igual para cualquier
 * proveedor: marcador de transferencia, corte por caracteres y division en
 * bloques. Funciones puras: se prueban sin red ni base de datos.
 */

/**
 * Texto literal con el que los Prompts antiguos pedian transferir. Se sigue
 * aceptando como respaldo cuando el modelo no admite herramientas.
 */
export const MARCADOR_TRANSFERENCIA = "Ação: Transferir para o setor de atendimento";

const MARCADORES = [
  /a[çc][ãa]o:\s*transferir para o setor de atendimento\.?/i,
  /acci[óo]n:\s*transferir al (sector|área|area) de atenci[óo]n\.?/i
];

export const extraerMarcadorTransferencia = (texto: string): { texto: string; transferir: boolean } => {
  let transferir = false;
  let limpio = texto || "";
  for (const patron of MARCADORES) {
    if (patron.test(limpio)) {
      transferir = true;
      limpio = limpio.replace(patron, "");
    }
  }
  return { texto: limpio.trim(), transferir };
};

const FIN_ORACION = /[.!?…](?=\s|$)|\n/g;

/**
 * maxCharacters: corta sin partir palabras y, si puede, en el ultimo fin de
 * oracion. No es un limite que se le pida al modelo sino un recorte posterior.
 */
export const recortarCaracteres = (texto: string, max: number | null | undefined): string => {
  const limpio = (texto || "").trim();
  if (!max || limpio.length <= max) return limpio;

  const trozo = limpio.slice(0, max);
  let ultimoFin = -1;
  let m: RegExpExecArray | null;
  FIN_ORACION.lastIndex = 0;
  while ((m = FIN_ORACION.exec(trozo)) !== null) ultimoFin = m.index + 1;

  // Mejor una oracion entera algo mas corta que una frase cortada con puntos
  // suspensivos: se acepta el fin de oracion si deja al menos la mitad.
  if (ultimoFin >= max * 0.5) return trozo.slice(0, ultimoFin).trim();

  const ultimoEspacio = trozo.lastIndexOf(" ");
  const base = ultimoEspacio > max * 0.5 ? trozo.slice(0, ultimoEspacio) : trozo.slice(0, max - 1);
  return `${base.trim()}…`;
};

const oraciones = (texto: string): string[] =>
  (texto.match(/[^.!?…\n]+(?:[.!?…]+|\n|$)/g) || [texto]).map(s => s.trim()).filter(Boolean);

/** Agrupa piezas consecutivas en n grupos de longitud parecida, sin reordenar. */
const agrupar = (piezas: string[], n: number, separador: string): string[] => {
  const total = piezas.reduce((s, p) => s + p.length, 0);
  const objetivo = total / n;
  const grupos: string[][] = [];
  let actual: string[] = [];
  let acumulado = 0;

  piezas.forEach((pieza, i) => {
    actual.push(pieza);
    acumulado += pieza.length;
    const quedanPiezas = piezas.length - i - 1;
    const quedanGrupos = n - grupos.length - 1;
    const tocaCerrar = acumulado >= objetivo * (grupos.length + 1) || quedanPiezas === quedanGrupos;
    if (tocaCerrar && quedanGrupos > 0 && quedanPiezas >= quedanGrupos) {
      grupos.push(actual);
      actual = [];
    }
  });
  if (actual.length) grupos.push(actual);
  return grupos.map(g => g.join(separador).trim()).filter(Boolean);
};

/**
 * dividirRespuestas: parte la respuesta en hasta `n` mensajes. Prefiere
 * parrafos; si hay menos parrafos que bloques, parte por oraciones. Nunca
 * inventa bloques: una respuesta de una sola oracion sale en un mensaje.
 */
export const dividirEnBloques = (texto: string, n: number): string[] => {
  const limpio = (texto || "").trim();
  if (!limpio) return [];
  const bloques = Math.max(1, Math.min(3, Math.floor(n || 1)));
  if (bloques === 1) return [limpio];

  const parrafos = limpio.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (parrafos.length >= bloques) return agrupar(parrafos, bloques, "\n\n");

  const frases = oraciones(limpio);
  if (frases.length <= 1) return [limpio];
  return agrupar(frases, Math.min(bloques, frases.length), " ");
};

/** Pausa antes de enviar un bloque: entre 1 y 3 s segun su largo. */
export const pausaParaBloque = (bloque: string): number =>
  Math.max(1000, Math.min(3000, 600 + (bloque || "").length * 25));
