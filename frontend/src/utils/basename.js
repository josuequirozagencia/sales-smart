// Sustituto de `path.basename` del módulo `path` de Node.
//
// Tres componentes hacían `require("path")` solo para llamar a
// `path.basename` sobre rutas de medios. webpack 5 ya no incluye polyfills
// automáticos de módulos de Node, y arrastrar `path-browserify` entero al
// bundle para una sola función no compensa.
//
// Devuelve el último segmento de una ruta o URL, igual que `path.basename`
// para las entradas que maneja esta aplicación. No se eliminan query strings
// ni fragmentos, a propósito: `path.basename` tampoco lo hace, y algunos
// componentes comparan el resultado con el cuerpo del mensaje.
export const basename = value => {
  if (!value) return "";

  const segments = String(value).split(/[\\/]/);
  return segments[segments.length - 1] || "";
};

export default basename;
