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

/**
 * Oscurece un color una fracción dada. Sirve para derivar los estados
 * hover y active a partir del primario que configure cada empresa.
 *
 * @param {string} hex   color en formato "#rrggbb"
 * @param {number} amount  0 = sin cambio, 1 = negro
 */
export function darken(hex, amount) {
  const n = parseInt(hex.replace("#", ""), 16);
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
  border: neutral[200],
  borderStrong: neutral[300],
  textPrimary: neutral[900], // 17.85 sobre surface
  textSecondary: neutral[600], // 7.58 — hoy es 4.59, que pasa sin margen
  textMuted: neutral[500], // 4.76
};

export const dark = {
  background: neutral[900],
  surface: neutral[800],
  surfaceSecondary: neutral[700],
  border: neutral[700],
  borderStrong: neutral[600],
  textPrimary: neutral[50],
  textSecondary: neutral[300],
  textMuted: neutral[400],
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
