/**
 * Reglas de formato por pais.
 *
 * La clave es el codigo de pais. Dentro, cada entrada dice: para tantos
 * digitos DESPUES del codigo, agrupalos asi. El resultado siempre sale
 * como  +codigo (area) resto-final,  que es la forma que este proyecto ya
 * usaba para Brasil; se mantiene igual para no cambiar lo que ya se veia.
 *
 * Se busca por el prefijo mas largo primero, porque 55 (Brasil) es prefijo
 * de nada, pero hay codigos de tres digitos —593 Ecuador, 591 Bolivia— que
 * empiezan por los mismos digitos que otros de dos.
 *
 * Solo estan los paises que se necesitan. Un numero de un pais que no
 * figure aqui se devuelve SIN formatear, que es preferible a partirlo con
 * la agrupacion de otro pais: hasta ahora, cualquier numero de doce
 * digitos se troceaba como si fuera brasileno, y un movil ecuatoriano
 * —593 99 123 4567— se mostraba como "+59 (39) 9123-4567", partiendo el
 * codigo de pais por la mitad.
 */
const REGLAS_POR_PAIS = {
  // Ecuador: movil 9 digitos (9 + 8), fijo 8 (area de 1 + 7).
  "593": { 9: [2, 3, 4], 8: [1, 3, 4] },
  // Brasil: DDD de 2 + movil de 9 o fijo de 8. Reproduce exactamente el
  // formato que ya daba este fichero.
  "55": { 11: [2, 5, 4], 10: [2, 4, 4] }
};

/** Codigos ordenados de mas largo a mas corto, para acertar el prefijo. */
const CODIGOS = Object.keys(REGLAS_POR_PAIS).sort((a, b) => b.length - a.length);

class FormatMask {
  /**
   * Da formato a un numero de telefono.
   *
   * Si no se reconoce ni el pais ni la longitud, devuelve el numero TAL
   * CUAL en vez de romperse. Antes no era asi: la guarda medía el texto en
   * bruto —`phoneToFormat.length < 12`— pero la expresion se aplicaba al
   * numero ya SIN separadores y exigia 12 digitos exactos. Un numero con
   * espacios, o un fijo mas corto, pasaba la guarda, no casaba, y `match`
   * devolvia null: leer `[1]` sobre null lanzaba una excepcion.
   *
   * No era un fallo cosmetico. Esto se llama durante el render de
   * ContactDrawer, y como la aplicacion no tiene error boundary, la
   * excepcion tumbaba la pantalla entera y dejaba el navegador en blanco.
   */
  setPhoneFormatMask(phoneToFormat) {
    if (!phoneToFormat) {
      return phoneToFormat;
    }

    // Se decide por los DIGITOS, no por la longitud del texto en bruto.
    //
    // La comprobacion anterior era `phoneToFormat.length < 12`, y dejaba
    // fuera a los fijos de Ecuador, que tienen once digitos. Ahora la
    // longitud la juzga la tabla de cada pais, que es quien sabe cuantos
    // digitos lleva alli un numero valido.
    const number = ("" + phoneToFormat).replace(/\D/g, "");

    const codigo = CODIGOS.find(c => number.startsWith(c));
    if (!codigo) return phoneToFormat;

    const resto = number.slice(codigo.length);
    const grupos = REGLAS_POR_PAIS[codigo][resto.length];
    // Longitud que no corresponde a ningun formato conocido de ese pais.
    // Pasa con los identificadores internos de WhatsApp, que son numericos
    // y largos pero no son telefonos.
    if (!grupos) return phoneToFormat;

    const partes = [];
    let i = 0;
    for (const largo of grupos) {
      partes.push(resto.slice(i, i + largo));
      i += largo;
    }

    // +codigo (area) resto-final
    const area = partes[0];
    const cuerpo = partes.slice(1);
    return `+${codigo} (${area}) ${cuerpo.slice(0, -1).join(" ")}-${cuerpo[cuerpo.length - 1]}`;
  }

  removeMask(number) {
    const filterNumber = number.replace(/\D/g, "");
    return filterNumber;
  }

  maskPhonePattern(phoneNumber){
    if(phoneNumber.length < 13){
      return '🇧🇷 (99) 9999 9999';
    }else{
      return '🇧🇷 (99) 99999 9999';
    }
  }
}

export { FormatMask, REGLAS_POR_PAIS };
