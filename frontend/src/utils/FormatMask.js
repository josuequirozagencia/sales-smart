class FormatMask {
  /**
   * Da formato a un numero de telefono.
   *
   * Si no se reconoce el formato, devuelve el numero TAL CUAL en vez de
   * romperse. Antes no era asi: la guarda de arriba mide el texto en bruto
   * —`phoneToFormat.length < 12`— pero la expresion de abajo se aplica al
   * numero ya SIN separadores y exige 12 digitos exactos. Un numero con
   * espacios o guiones, o un fijo mas corto, pasaba la guarda, no casaba
   * con la expresion, y `match` devolvia null: leer `[1]` sobre null
   * lanzaba una excepcion.
   *
   * No era un fallo cosmetico. Esto se llama durante el render de
   * ContactDrawer, y como la aplicacion no tiene error boundary, la
   * excepcion tumbaba la pantalla entera y dejaba el navegador en blanco.
   */
  setPhoneFormatMask(phoneToFormat) {
    if(!phoneToFormat || phoneToFormat.length < 12){
      return phoneToFormat;
    }

    const number = ("" + phoneToFormat).replace(/\D/g, "");

    if (number.length <= 12) {
      const phoneNumberFormatted = number.match(/^(\d{2})(\d{2})(\d{4})(\d{4})$/);
      // Sin coincidencia no hay nada que componer: se devuelve lo que llego.
      if (!phoneNumberFormatted) return phoneToFormat;
      return (
        "+" +
        phoneNumberFormatted[1] +
        " (" +
        phoneNumberFormatted[2] +
        ") " +
        phoneNumberFormatted[3] +
        "-" +
        phoneNumberFormatted[4]
      );
    }else if(number.length === 13){
      const phoneNumberFormatted = number.match(/^(\d{2})(\d{2})(\d{5})(\d{4})$/);
      // Misma proteccion: aqui la expresion si coincide con 13 digitos,
      // pero se deja igual de defensivo para que no dependa de eso.
      if (!phoneNumberFormatted) return phoneToFormat;
      return (
        "+" +
        phoneNumberFormatted[1] +
        " (" +
        phoneNumberFormatted[2] +
        ") " +
        phoneNumberFormatted[3] +
        "-" +
        phoneNumberFormatted[4]
      );
    } else {
      return phoneToFormat;
    }

    return null;
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

export { FormatMask };