import moment from "moment";

import {
  crearAvisoEspaciado,
  decidirFacturacion,
  importeDePlan,
  mismaFecha,
  sentenciaActualizarVencimiento,
  sentenciaCrearFactura,
  sentenciaFacturasAbiertas,
  vencimientoDeEmpresa
} from "../../helpers/FacturacionEmpresa";

// Se usa el propio formateador de Sequelize para comprobar el SQL que acaba
// saliendo hacia Postgres. Es la unica forma honesta de probar que una
// comilla en el nombre del plan ya no rompe nada, sin levantar la base.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { formatNamedParameters } = require("sequelize/lib/utils");

// El cron de facturacion emitio tres facturas de 0.00 con la fecha guardada
// como la cadena "Invalid date", y las reescribio cada 30 segundos durante
// dias. Aqui se prueba cada uno de los pasos que lo permitieron.

describe("importeDePlan", () => {
  it("factura el precio del plan, no cero", () => {
    expect(importeDePlan("15")).toEqual({ estado: "ok", valor: "15.00" });
    expect(importeDePlan("50")).toEqual({ estado: "ok", valor: "50.00" });
  });

  it("entiende la coma decimal", () => {
    expect(importeDePlan("29,90")).toEqual({ estado: "ok", valor: "29.90" });
  });

  it("acepta un numero, no solo una cadena", () => {
    expect(importeDePlan(50)).toEqual({ estado: "ok", valor: "50.00" });
  });

  it("un plan gratis vale cero porque lo dice el plan", () => {
    expect(importeDePlan("0")).toEqual({ estado: "ok", valor: "0.00" });
  });

  it("un plan sin importe no se convierte en una factura de 0.00", () => {
    for (const vacio of [null, undefined, "", "   "]) {
      const importe = importeDePlan(vacio);

      expect(importe.estado).toBe("error");
      expect(importe).not.toMatchObject({ valor: "0.00" });
    }
  });

  it("no adivina un numero escondido en un texto", () => {
    // parseFloat("15 euros") devolvia 15 sin decir nada.
    expect(importeDePlan("15 euros").estado).toBe("error");
    expect(importeDePlan("1.234,56").estado).toBe("error");
    expect(importeDePlan("gratis").estado).toBe("error");
  });

  it("rechaza un importe negativo", () => {
    expect(importeDePlan("-10").estado).toBe("error");
  });
});

describe("vencimientoDeEmpresa", () => {
  it("lee la fecha venga como venga de la base", () => {
    const desdeDate = vencimientoDeEmpresa(new Date("2026-10-25T05:00:00Z"));
    const desdeIso = vencimientoDeEmpresa("2026-10-25");
    const desdeFormatoAntiguo = vencimientoDeEmpresa("25/10/2026");

    expect(desdeDate.estado).toBe("ok");
    expect(desdeIso.estado).toBe("ok");
    expect(desdeFormatoAntiguo.estado).toBe("ok");
  });

  it("una empresa sin fecha no produce Invalid date", () => {
    const vencimiento = vencimientoDeEmpresa(null);

    expect(vencimiento.estado).toBe("error");
    expect(JSON.stringify(vencimiento)).not.toContain("Invalid date");
  });

  it("undefined no se convierte en la fecha de hoy", () => {
    // moment(undefined) devuelve el instante actual. Si eso llegara a pasar,
    // una empresa sin fecha pareceria estar al dia todos los dias.
    expect(vencimientoDeEmpresa(undefined).estado).toBe("error");
  });
});

describe("decidirFacturacion", () => {
  const hoy = moment("2026-09-25", "YYYY-MM-DD");

  it("sin fecha de vencimiento no factura ni desactiva", () => {
    expect(decidirFacturacion(null, hoy).accion).toBe("omitir");
    expect(decidirFacturacion(undefined, hoy).accion).toBe("omitir");
  });

  it("con una fecha ilegible no factura ni desactiva", () => {
    const rotas = ["Invalid date", "", "   ", "32/13/2026", "manana", "0000"];

    for (const rota of rotas) {
      expect(decidirFacturacion(rota, hoy).accion).toBe("omitir");
    }
  });

  it("una cadena que solo parece un ano no desactiva a nadie", () => {
    // El formato ISO acepta "0000" como ano. Leida asi, la empresa acumula
    // setecientos mil dias de retraso y entra por dias <= -3: se desactiva y
    // pierde sus WhatsApp por un dato que nunca fue una fecha.
    expect(decidirFacturacion("0000", hoy).accion).toBe("omitir");
    expect(decidirFacturacion("1899", hoy).accion).toBe("omitir");
    expect(decidirFacturacion("2999", hoy).accion).toBe("omitir");
  });

  it("desactiva a los tres dias de vencida, como hasta ahora", () => {
    expect(decidirFacturacion("2026-09-22", hoy)).toMatchObject({
      accion: "desactivar",
      dias: -3
    });

    expect(decidirFacturacion("2026-09-21", hoy)).toMatchObject({
      accion: "desactivar",
      dias: -4
    });
  });

  it("no desactiva antes de los tres dias", () => {
    expect(decidirFacturacion("2026-09-23", hoy)).toMatchObject({
      accion: "facturar",
      dias: -2
    });

    expect(decidirFacturacion("2026-09-25", hoy)).toMatchObject({
      accion: "facturar",
      dias: 0
    });

    expect(decidirFacturacion("2026-10-25", hoy).accion).toBe("facturar");
  });
});

describe("mismaFecha", () => {
  it("reconoce la fecha que el propio cron dejo escrita", () => {
    // Esta es la vuelta completa que fallaba: el INSERT guarda un ISO y la
    // comprobacion lo leia en estricto como DD/MM/YYYY, asi que nunca
    // coincidia y la factura se actualizaba cada 30 segundos.
    const vencimiento = moment("2026-10-25", "YYYY-MM-DD");
    const guardada = vencimiento.format();

    expect(mismaFecha(guardada, vencimiento)).toBe(true);
  });

  it("sigue reconociendo el formato antiguo", () => {
    const vencimiento = moment("2026-10-25", "YYYY-MM-DD");

    expect(mismaFecha("25/10/2026", vencimiento)).toBe(true);
    expect(mismaFecha(new Date(2026, 9, 25, 13, 40), vencimiento)).toBe(true);
  });

  it("no da por buena una fecha corrupta ni una ausente", () => {
    const vencimiento = moment("2026-10-25", "YYYY-MM-DD");

    expect(mismaFecha("Invalid date", vencimiento)).toBe(false);
    expect(mismaFecha(null, vencimiento)).toBe(false);
    expect(mismaFecha("24/10/2026", vencimiento)).toBe(false);
  });
});

describe("crearAvisoEspaciado", () => {
  it("deja pasar el primer aviso y calla los de las vueltas siguientes", () => {
    const avisar = crearAvisoEspaciado(60 * 60 * 1000);
    const ahora = 1_000_000;

    expect(avisar("vencimiento:1", ahora)).toBe(true);
    expect(avisar("vencimiento:1", ahora + 30_000)).toBe(false);
    expect(avisar("vencimiento:1", ahora + 59 * 60 * 1000)).toBe(false);
    expect(avisar("vencimiento:1", ahora + 60 * 60 * 1000)).toBe(true);
  });

  it("no calla a una empresa porque haya avisado de otra", () => {
    const avisar = crearAvisoEspaciado(60 * 60 * 1000);
    const ahora = 1_000_000;

    expect(avisar("vencimiento:1", ahora)).toBe(true);
    expect(avisar("vencimiento:2", ahora)).toBe(true);
    expect(avisar("importe:1", ahora)).toBe(true);
  });
});

describe("sentencias de facturacion", () => {
  const datos = {
    companyId: 7,
    dueDate: "2026-10-25T00:00:00-05:00",
    detail: "O'Brien & Co",
    value: 15,
    users: 3,
    connections: 2,
    queues: 4,
    timestamp: "2026-09-25T10:00:00-05:00"
  };

  it("no mete ningun valor dentro del SQL", () => {
    const { sql, replacements } = sentenciaCrearFactura(datos);

    expect(sql).not.toContain("O'Brien");
    expect(sql).not.toContain("2026-10-25");
    expect(sql).toContain(":detail");
    expect(sql).toContain(":companyId");
    expect(replacements).toMatchObject({
      companyId: 7,
      detail: "O'Brien & Co",
      value: 15
    });
  });

  it("un nombre de plan con comilla ya no rompe la sentencia", () => {
    const { sql, replacements } = sentenciaCrearFactura(datos);
    const final = formatNamedParameters(sql, replacements, "postgres");

    expect(final).toContain("'O''Brien & Co'");
    // Con la interpolacion anterior la comilla cerraba el literal a media
    // frase; si las comillas quedan pareadas, la sentencia sigue entera.
    expect((final.match(/'/g) || []).length % 2).toBe(0);
    expect(final).toContain("'open'");
  });

  it("un nombre de plan hostil se queda dentro del literal", () => {
    const { sql, replacements } = sentenciaCrearFactura({
      ...datos,
      detail: `Plan'); DROP TABLE "Invoices"; --`
    });
    const final = formatNamedParameters(sql, replacements, "postgres");

    // El payload entero viaja como texto dentro de una sola cadena: la
    // comilla va doblada, asi que nunca llega a cerrar el literal.
    expect(final).toContain(`'Plan''); DROP TABLE "Invoices"; --'`);
    expect((final.match(/'/g) || []).length % 2).toBe(0);
  });

  it("el update de la fecha tampoco interpola", () => {
    const { sql, replacements } = sentenciaActualizarVencimiento(
      12,
      "2026-10-25T00:00:00-05:00"
    );

    expect(sql).toContain(":dueDate");
    expect(sql).not.toContain("2026-10-25");
    expect(replacements).toEqual({ id: 12, dueDate: "2026-10-25T00:00:00-05:00" });
  });

  it("la busqueda de facturas abiertas tampoco interpola", () => {
    const { sql, replacements } = sentenciaFacturasAbiertas(7);

    expect(sql).toContain(":companyId");
    expect(sql).not.toContain("= 7");
    expect(replacements).toEqual({ companyId: 7 });
  });
});
