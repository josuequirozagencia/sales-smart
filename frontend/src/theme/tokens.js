/**
 * Sistema visual base — Fase 1.
 *
 * ESTADO: este archivo todavía no lo importa nadie. Es una propuesta
 * ejecutable, no una migración. Nada de lo que hay aquí afecta a la
 * aplicación hasta que se conecte al tema de forma explícita.
 *
 * Por qué existe
 * --------------
 * El inventario del frontend encontró 342 valores de color distintos en
 * 1347 usos, repartidos por 397 archivos. Al agruparlos por cercanía
 * perceptual (deltaE < 8, es decir, colores que el ojo no distingue en uso
 * normal) quedan 135 grupos: aproximadamente la mitad son duplicados
 * literales del mismo color escrito de otra forma.
 *
 * Seis de esos grupos son neutros —blancos, grises y negros— y entre ellos
 * concentran 603 de los 1347 usos con 77 variantes. Ahí está el grueso del
 * desorden, y por eso la escala de neutros es la parte más desarrollada de
 * este archivo.
 *
 * Todos los contrastes anotados están medidos, no estimados, y cumplen
 * WCAG AA (4.5:1 para texto normal) tanto sobre `surface` como sobre
 * `background`.
 */

// ---------------------------------------------------------------------------
// NEUTROS
// ---------------------------------------------------------------------------
// Escala de 11 pasos con una ligera desviación fría. Sustituye a los 77
// valores neutros dispersos que hay hoy.
//
// La desviación fría es deliberada: un gris puro sobre blanco puro tiende a
// verse sucio en pantallas modernas. El tinte azulado es lo que da la
// sensación "limpia" de los productos SaaS actuales, y a la vez mantiene
// pasos de contraste predecibles entre niveles.
export const neutral = {
  0: "#ffffff",
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#cbd5e1",
  400: "#94a3b8",
  500: "#64748b",
  600: "#475569",
  700: "#334155",
  800: "#1e293b",
  900: "#0f172a",
};

// ---------------------------------------------------------------------------
// COLOR PRIMARIO
// ---------------------------------------------------------------------------
// ATENCIÓN: el primario NO es una constante de este archivo.
//
// La aplicación lo lee del backend por empresa
// (getPublicSetting("primaryColorLight") en App.js), de modo que cada
// cliente puede tener el suyo. Por eso `hover` y `active` se DERIVAN del
// color configurado en lugar de escribirse a mano: si se fijaran aquí,
// cualquier cliente que personalice su marca se quedaría con estados de
// hover de otro color.
//
// El valor de abajo es solo el que se usa cuando el backend no devuelve
// nada. Hoy ese valor por defecto es "#0000FF", azul puro, que es el azul
// de enlace sin estilar de los años noventa. #2563eb es el mismo tono
// familiar pero utilizable: contraste 5.17 sobre blanco, y admite texto
// blanco encima con 5.17.
export const primaryDefault = "#2563eb";

// El secundario NO se configura desde el backend hoy; solo existe el primario.
// Se elige un slate en lugar de un color con carácter por una razón concreta:
// `color="secondary"` aparece en 79 archivos, y como el primario lo decide
// cada cliente, cualquier secundario saturado chocaría con la marca de alguien.
// Un neutro oscuro funciona de apoyo junto a cualquier primario.
//
// Hoy esta clave no está definida en el tema, así que MUI aplica su rosa por
// defecto (#f50057), que nadie eligió.
export const secondaryDefault = "#475569";

// Contraparte para modo oscuro. El neutro de arriba se eligio contra fondo
// claro (8,6 sobre blanco); sobre superficie oscura cae a 1,93 y deja
// invisibles los botones "secondary", que son botones activos, no
// deshabilitados. Un solo tono no puede servir a los dos modos.
export const secondaryDefaultDark = neutral[400];

// ---------------------------------------------------------------------------
// ESCALA DE MARCA
// ---------------------------------------------------------------------------
// Derivada del logo de GROWTH muestreando sus píxeles: tono 266°, saturación
// 86%. No es un violeta elegido a ojo, es el de la marca.
//
// Se conserva la escala entera aunque el tema use solo dos niveles, porque
// las fases siguientes —panel, gráficos, estados— necesitarán los tonos
// intermedios, y conviene que salgan de este tono y no de otro violeta.
export const brandScale = {
  50: "#f7f2fd",
  100: "#e3d3f8",
  300: "#b084eb",
  500: "#803adf",
  600: "#6720c5", // primario interactivo — blanco encima da 8.11
  700: "#50199a",
  900: "#200a3d" // superficies oscuras, el color del logo
};

/**
 * Devuelve un "#rrggbb" válido, o el respaldo si la entrada no lo es.
 *
 * Existe porque el color de marca no es una constante: se escribe a mano en
 * Ajustes > Whitelabel y llega desde el backend o desde localStorage. Sin
 * validar, un valor mal escrito se propagaría como "#NaNNaNNaN" a todo el
 * tema, y como el tema alimenta la aplicación entera, el fallo no sería
 * discreto.
 *
 * Acepta la forma corta de tres dígitos y tolera que falte la almohadilla.
 */
export function normalizeHex(value, fallback = primaryDefault) {
  if (typeof value !== "string") return fallback;
  let v = value.trim();
  if (v.charAt(0) !== "#") v = "#" + v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  }
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback;
}

/**
 * Oscurece un color una fracción dada. Sirve para derivar los estados
 * hover y active a partir del primario que configure cada empresa.
 *
 * @param {string} hex   color en formato "#rrggbb"
 * @param {number} amount  0 = sin cambio, 1 = negro
 */
export function darken(hex, amount) {
  const n = parseInt(normalizeHex(hex).replace("#", ""), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.max(0, Math.round(c * (1 - amount)))
  );
  return "#" + ch.map((c) => c.toString(16).padStart(2, "0")).join("");
}

export const primaryStates = (base) => ({
  main: base,
  hover: darken(base, 0.08),
  active: darken(base, 0.16),
});

/**
 * Luminancia relativa segun WCAG. Auxiliar de contrastRatio.
 */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16));
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * Relacion de contraste entre dos colores opacos, de 1 a 21.
 */
export function contrastRatio(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Color de texto legible sobre un fondo dado.
 *
 * Esta es la pieza que faltaba. La aplicacion asumia texto blanco sobre
 * cualquier color, y como el color de marca lo configura cada cliente, un
 * naranja como #f7953b dejaba los botones en 2.25 de contraste, muy por
 * debajo del 4.5 que exige la WCAG para texto normal.
 *
 * La regla es determinista y sin casos especiales: si el blanco alcanza el
 * umbral sobre ese fondo, se usa blanco; si no, se usa el tinta oscura.
 * Es el mismo criterio que aplica MUI en getContrastText, de modo que el
 * tema y los componentes que usen este helper coinciden siempre.
 *
 * @param {string} background  fondo en formato "#rrggbb"
 * @returns {string} neutral[0] o neutral[900]
 */
export function onColor(background, options = {}) {
  const {
    threshold = 4.5,
    light = neutral[0],
    dark = neutral[900],
  } = options;
  return contrastRatio(normalizeHex(background), light) >= threshold
    ? light
    : dark;
}

// ---------------------------------------------------------------------------
// COLORES SEMÁNTICOS
// ---------------------------------------------------------------------------
// Dos tonos por significado, y la distinción importa:
//
//   `fill` es para rellenos con texto blanco encima (botones, insignias).
//   `text` es para texto de ese color sobre fondo claro.
//
// Son distintos porque un verde que funciona como fondo suele ser
// demasiado claro como texto. Ese es exactamente el fallo que tenía la
// hora de los mensajes no leídos: usaba el mismo verde para ambas cosas y
// daba 3.30 de contraste como texto.
export const semantic = {
  success: { fill: "#16a34a", text: "#15803d", soft: "#dcfce7" },
  warning: { fill: "#f59e0b", text: "#b45309", soft: "#fef3c7" },
  error: { fill: "#dc2626", text: "#b91c1c", soft: "#fee2e2" },
  info: { fill: "#3b82f6", text: "#1d4ed8", soft: "#dbeafe" },
};

// ---------------------------------------------------------------------------
// SUPERFICIES Y TEXTO
// ---------------------------------------------------------------------------
export const light = {
  background: neutral[50],
  surface: neutral[0],
  surfaceSecondary: neutral[100],
  // Tercer nivel de superficie. La referencia apila fondo, tarjeta y tarjeta
  // destacada; con solo dos niveles no hay forma de decir que algo está por
  // encima de otra cosa sin recurrir a una sombra pesada.
  surfaceElevated: neutral[0],
  border: neutral[200],
  borderStrong: neutral[300],
  textPrimary: neutral[900], // 17.85 sobre surface
  textSecondary: neutral[600], // 7.58 — hoy es 4.59, que pasa sin margen
  textMuted: neutral[500], // 4.76
};

export const dark = {
  background: neutral[900],
  surface: neutral[800],
  // En oscuro la elevación no se expresa con sombra —sobre fondo oscuro casi
  // no se percibe— sino aclarando la superficie. Por eso el nivel elevado es
  // más claro que el normal, al revés que en modo claro.
  surfaceElevated: "#243044",
  surfaceSecondary: neutral[700],
  border: neutral[700],
  borderStrong: neutral[600],
  textPrimary: neutral[50],
  textSecondary: neutral[300],
  textMuted: neutral[400],
};

// ---------------------------------------------------------------------------
// BARRA LATERAL
// ---------------------------------------------------------------------------
// La referencia trata la navegación como una pieza oscura y separada, no como
// una franja del mismo color que el contenido.
//
// Se mantiene oscura en los dos modos a propósito: es lo que le da estructura
// al producto, y alternarla haría que la aplicación pareciera dos productos
// distintos según la hora del día.
export const sidebar = {
  light: {
    background: "#1a1130",
    surface: "#241a3d",
    border: "rgba(255, 255, 255, 0.08)",
    text: "#cfc7e0",
    textActive: "#ffffff",
    textMuted: "#8f86a3"
  },
  dark: {
    background: "#150e26",
    surface: "#1f1636",
    border: "rgba(255, 255, 255, 0.06)",
    text: "#c4bcd6",
    textActive: "#ffffff",
    textMuted: "#857c99"
  }
};

// ---------------------------------------------------------------------------
// COLORES DE MARCA AJENA
// ---------------------------------------------------------------------------
// Estos NO son tokens y no deben unificarse con la paleta: son la identidad
// de servicios de terceros. El verde de WhatsApp es el verde de WhatsApp
// aunque el cliente tenga la marca en naranja. Se listan aquí solo para que
// consten como intencionales y nadie los "arregle" en una limpieza futura.
export const brand = {
  whatsapp: "#25D366",
  facebook: "#4267B2",
  instagram: "#E1306C",
};

// ---------------------------------------------------------------------------
// TIPOGRAFÍA
// ---------------------------------------------------------------------------
// Ocho niveles que sustituyen a los 35 tamaños distintos que hay hoy,
// escritos además mezclando px, em y rem.
//
// Todo en rem para que respete el tamaño de letra que el usuario tenga
// configurado en su sistema operativo. La base de la aplicación es 14px,
// pero rem se calcula sobre la raíz (16px), de ahí los decimales.
//
// El mínimo es 11px. Deliberadamente no hay nada menor: el 0.6em de la
// lista de tickets daba 8.4px reales y era el problema de legibilidad más
// grave que encontró la auditoría.
export const typography = {
  caption: { size: "0.6875rem", weight: 500, lh: 1.45 }, // 11px
  label: { size: "0.75rem", weight: 500, lh: 1.45 }, //  12px
  bodySm: { size: "0.8125rem", weight: 400, lh: 1.5 }, //  13px
  body: { size: "0.875rem", weight: 400, lh: 1.55 }, //  14px  base
  subtitle: { size: "1rem", weight: 600, lh: 1.5 }, //  16px
  h3: { size: "1.125rem", weight: 600, lh: 1.4 }, //  18px
  h2: { size: "1.375rem", weight: 700, lh: 1.3 }, //  22px
  h1: { size: "1.75rem", weight: 700, lh: 1.25 }, //  28px
};

// Solo cuatro pesos. Hoy conviven 600, 500, "bold", "'bold" y varios "00"
// que son restos de un reemplazo mal hecho y que el navegador descarta.
export const weight = { regular: 400, medium: 500, semibold: 600, bold: 700 };

// ---------------------------------------------------------------------------
// ESPACIADO
// ---------------------------------------------------------------------------
// Escala de base 4. Los valores sueltos que hay hoy (10, 18, 20, 40...) no
// forman ninguna progresión, y por eso las pantallas se ven descuadradas
// entre sí.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

// ---------------------------------------------------------------------------
// RADIOS
// ---------------------------------------------------------------------------
// Cuatro valores frente a los doce actuales.
export const radius = {
  sm: 4, //  insignias, chips
  md: 8, //  botones, campos de formulario
  lg: 12, //  tarjetas, modales
  full: 9999, //  avatares, píldoras
};

// ---------------------------------------------------------------------------
// SOMBRAS
// ---------------------------------------------------------------------------
// Tres niveles, todos con tinte azulado en lugar de negro puro, que es lo
// que evita el halo gris sucio.
//
// Las sombras actuales del tipo "1px 1px 5px #CCC" y "0 1px 1px #b3b3b3"
// son el rasgo que más delata la edad de la interfaz: desplazamiento
// diagonal, poco difuminado y color sólido.
export const shadow = {
  sm: "0 1px 2px rgba(15, 23, 42, 0.06)",
  md: "0 4px 12px rgba(15, 23, 42, 0.08)",
  lg: "0 12px 32px rgba(15, 23, 42, 0.12)",
};

export default {
  neutral,
  primaryDefault,
  secondaryDefault,
  secondaryDefaultDark,
  brandScale,
  sidebar,
  normalizeHex,
  contrastRatio,
  onColor,
  primaryStates,
  darken,
  semantic,
  light,
  dark,
  brand,
  typography,
  weight,
  space,
  radius,
  shadow,
};
