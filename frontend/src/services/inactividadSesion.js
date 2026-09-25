// Cierre de sesion por inactividad.
//
// La ultima actividad y el limite viven en localStorage y no en el estado de
// React por dos motivos:
//  - se comparten entre pestanas: trabajar en una mantiene viva la sesion en
//    las demas (el aviso de las otras se cierra solo);
//  - sobreviven a una recarga o al cierre del navegador: al volver, si ya
//    paso el limite, la sesion se da por cerrada sin llegar a usarla.
//
// El limite (minutos) es de la empresa: lo ajusta su administrador en
// Configuracion > Opciones y llega de GET /session-settings.

export const CLAVE_ULTIMA_ACTIVIDAD = "sesionUltimaActividad";
export const CLAVE_LIMITE = "sesionInactividadMinutos";

export const MINUTOS_POR_DEFECTO = 300;
const MINUTOS_MINIMO = 15;
const MINUTOS_MAXIMO = 1440;

// Cuanto antes del cierre aparece el aviso con la cuenta atras.
export const MS_AVISO = 60 * 1000;

// localStorage puede no estar disponible (modo privado estricto): sin el, la
// sesion funciona igual, solo que sin cierre por inactividad entre recargas.
const leer = (clave) => {
  try {
    return localStorage.getItem(clave);
  } catch (err) {
    return null;
  }
};

const escribir = (clave, valor) => {
  try {
    localStorage.setItem(clave, valor);
  } catch (err) {
    // Sin almacenamiento no hay nada que guardar.
  }
};

const esLimiteValido = (n) =>
  Number.isInteger(n) && n >= MINUTOS_MINIMO && n <= MINUTOS_MAXIMO;

export const limiteMinutos = () => {
  const n = Number(leer(CLAVE_LIMITE));
  return esLimiteValido(n) ? n : MINUTOS_POR_DEFECTO;
};

export const guardarLimite = (minutos) => {
  const n = Number(minutos);
  if (esLimiteValido(n)) escribir(CLAVE_LIMITE, String(n));
};

export const ultimaActividad = () => {
  const n = Number(leer(CLAVE_ULTIMA_ACTIVIDAD));
  return n > 0 ? n : null;
};

export const marcarActividad = (ahora = Date.now()) => {
  escribir(CLAVE_ULTIMA_ACTIVIDAD, String(ahora));
};

export const olvidarActividad = () => {
  try {
    localStorage.removeItem(CLAVE_ULTIMA_ACTIVIDAD);
  } catch (err) {
    // Nada que borrar.
  }
};

// Milisegundos que quedan hasta el cierre. Sin actividad registrada (primera
// carga tras instalar esta funcion) cuenta el limite entero.
export const msRestantes = (ahora = Date.now()) => {
  const ultima = ultimaActividad();
  const limite = limiteMinutos() * 60 * 1000;
  return ultima ? ultima + limite - ahora : limite;
};

export const sesionCaducadaPorInactividad = (ahora = Date.now()) =>
  ultimaActividad() !== null && msRestantes(ahora) <= 0;
