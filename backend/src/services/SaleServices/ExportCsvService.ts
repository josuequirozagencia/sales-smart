import ListService from "./ListService";

/**
 * Exporta a CSV las ventas que cumplen el filtro.
 *
 * Se genera en el servidor y no en el navegador porque la pantalla solo
 * tiene cargada la pagina visible: un CSV hecho con eso exportaria cuarenta
 * filas y parecerian ser todas.
 */

interface Request {
  companyId: number;
  searchParam?: string;
  initialDate?: string;
  finalDate?: string;
  paymentMethod?: string;
}

/**
 * Prepara un valor para una celda.
 *
 * Ademas de las comillas y los separadores, se neutraliza el valor cuando
 * empieza por =, +, - o @. Excel y LibreOffice interpretan esas celdas como
 * FORMULAS, asi que un contacto llamado "=1+1" o algo peor se ejecutaria al
 * abrir el archivo. Anteponer un apostrofo lo deja como texto.
 */
const celda = (valor: any): string => {
  if (valor === null || valor === undefined) return '""';

  let texto = String(valor);

  if (/^[=+\-@\t\r]/.test(texto)) {
    texto = `'${texto}`;
  }

  return `"${texto.replace(/"/g, '""')}"`;
};

const ExportCsvService = async ({
  companyId,
  searchParam,
  initialDate,
  finalDate,
  paymentMethod
}: Request): Promise<string> => {
  const cabecera = [
    "Contacto",
    "Telefono",
    "Producto",
    "Cola",
    "Tipo",
    "Forma de pago",
    "Total",
    "Abono",
    "Pendiente",
    "Asesor",
    "Fecha"
  ];

  const filas: string[] = [cabecera.map(celda).join(",")];

  // Se recorren todas las paginas: exportar es justamente lo que se hace
  // cuando hay mas filas de las que caben en pantalla.
  let pagina = 1;
  let quedan = true;

  while (quedan) {
    const { sales, hasMore } = await ListService({
      companyId,
      searchParam,
      initialDate,
      finalDate,
      paymentMethod,
      pageNumber: String(pagina)
    });

    sales.forEach((s: any) => {
      const total = Number(s.total) || 0;
      const abono = Number(s.deposit) || 0;
      filas.push(
        [
          s.contact?.name,
          s.contact?.number,
          s.productName,
          s.queue?.name,
          s.dataValues.isFirstPurchase ? "Nueva" : "Cross-sell",
          s.paymentMethod,
          total.toFixed(2),
          abono.toFixed(2),
          Math.max(0, total - abono).toFixed(2),
          s.user?.name,
          s.createdAt ? new Date(s.createdAt).toISOString() : null
        ]
          .map(celda)
          .join(",")
      );
    });

    quedan = hasMore;
    pagina += 1;

    // Cinturon de seguridad: si algun dia hasMore se quedara en true por un
    // error, esto evita un bucle infinito en produccion.
    if (pagina > 500) break;
  }

  return filas.join("\r\n");
};

export default ExportCsvService;
