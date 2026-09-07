import { FormatMask } from './FormatMask';

/**
 * Banderas por codigo de pais.
 *
 * Antes solo existia Brasil, sustituyendo el texto "+55" por su bandera.
 * Al anadir Ecuador quedaba descolgado: un numero brasileno se veia con
 * bandera y uno ecuatoriano con "+593" en crudo, en la misma lista.
 *
 * La sustitucion se hace sobre el PREFIJO, no en cualquier posicion: con
 * un replace suelto, un "+55" que apareciera dentro del numero tambien se
 * cambiaria.
 */
const BANDERAS = {
  '+55': '🇧🇷',
  '+593': '🇪🇨'
};

// De mas largo a mas corto, para que "+593" gane antes de mirar "+59".
const PREFIJOS = Object.keys(BANDERAS).sort((a, b) => b.length - a.length);

const formatSerializedId = (serializedId) => {
  const formatMask = new FormatMask();
  const number = serializedId?.replace('@c.us', '');

  const formateado = formatMask.setPhoneFormatMask(number);
  if (!formateado) return formateado;

  const prefijo = PREFIJOS.find(p => formateado.startsWith(p));
  return prefijo ? formateado.replace(prefijo, BANDERAS[prefijo]) : formateado;
};

export default formatSerializedId;
