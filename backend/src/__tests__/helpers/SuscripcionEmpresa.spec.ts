import {
  DIAS_DE_PRUEBA,
  activarSuscripcion,
  cobroDelMes,
  diasDePruebaRestantes,
  enPrueba,
  facturacionEnEspera,
  iniciarPrueba,
  proximoCobro,
  pruebaAgotada
} from "../../helpers/SuscripcionEmpresa";

// Darse de alta no es contratar. Lo que se prueba aqui es esa frontera: la
// prueba gratuita por un lado, la suscripcion de verdad por otro, y que el
// dia de cobro no se desplace solo con el paso de los meses.

const enUTC = (iso: string): Date => new Date(iso);

describe("iniciarPrueba", () => {
  it("da siempre 7 dias, sin mirar el plan", () => {
    expect(DIAS_DE_PRUEBA).toBe(7);

    const alta = iniciarPrueba(enUTC("2026-09-28T15:00:00.000Z"));

    expect(alta.trialStartAt.toISOString()).toBe("2026-09-28T15:00:00.000Z");
    expect(alta.trialEndsAt.toISOString()).toBe("2026-10-05T15:00:00.000Z");
    expect(alta.subscriptionStatus).toBe("trial");
  });

  it("nace sin fecha de cobro y sin suscripcion", () => {
    const alta = iniciarPrueba(enUTC("2026-09-28T15:00:00.000Z"));

    // Antes el alta escribia siempre dueDate = hoy + 3, incluso con un plan
    // de pago, y eso entraba en la facturacion como si hubiera que cobrar.
    expect(alta.dueDate).toBeNull();
    expect(alta.subscribedAt).toBeNull();
    expect(alta.billingDayOfMonth).toBeNull();
    expect(alta.recurrence).toBe("monthly");
  });

  it("cruza el cambio de mes sin perderse", () => {
    const alta = iniciarPrueba(enUTC("2026-09-28T15:00:00.000Z"));
    expect(alta.trialEndsAt.toISOString().slice(0, 10)).toBe("2026-10-05");
  });
});

describe("diasDePruebaRestantes", () => {
  const fin = "2026-10-05T15:00:00.000Z";

  it("cuenta del 7 al 1 segun avanza la prueba", () => {
    const esperado: Array<[string, number]> = [
      ["2026-09-28T16:00:00.000Z", 7],
      ["2026-09-29T16:00:00.000Z", 6],
      ["2026-09-30T16:00:00.000Z", 5],
      ["2026-10-01T16:00:00.000Z", 4],
      ["2026-10-02T16:00:00.000Z", 3],
      ["2026-10-03T16:00:00.000Z", 2],
      ["2026-10-04T16:00:00.000Z", 1]
    ];

    for (const [ahora, dias] of esperado) {
      expect(diasDePruebaRestantes(fin, enUTC(ahora))).toBe(dias);
    }
  });

  it("el ultimo dia vale cero: termina hoy", () => {
    expect(diasDePruebaRestantes(fin, enUTC("2026-10-05T00:01:00.000Z"))).toBe(0);
    expect(diasDePruebaRestantes(fin, enUTC("2026-10-05T23:59:00.000Z"))).toBe(0);
  });

  it("pasado el plazo es negativo", () => {
    expect(diasDePruebaRestantes(fin, enUTC("2026-10-06T00:01:00.000Z"))).toBe(-1);
  });

  it("no cuenta la hora, solo el dia natural", () => {
    // Dos momentos del mismo dia tienen que dar lo mismo, o el contador
    // cambiaria a mitad de la jornada.
    const manana = diasDePruebaRestantes(fin, enUTC("2026-10-02T00:10:00.000Z"));
    const noche = diasDePruebaRestantes(fin, enUTC("2026-10-02T23:50:00.000Z"));

    expect(manana).toBe(noche);
  });

  it("sin fecha no dice que se acabo, dice que no sabe", () => {
    expect(diasDePruebaRestantes(null)).toBeNull();
    expect(diasDePruebaRestantes(undefined)).toBeNull();
    expect(diasDePruebaRestantes("")).toBeNull();
    expect(diasDePruebaRestantes("manana")).toBeNull();
  });
});

describe("enPrueba y pruebaAgotada", () => {
  const fin = "2026-10-05T15:00:00.000Z";

  it("esta en prueba mientras quedan dias, incluido el ultimo", () => {
    expect(enPrueba("trial", fin, enUTC("2026-09-28T16:00:00.000Z"))).toBe(true);
    expect(enPrueba("trial", fin, enUTC("2026-10-05T23:00:00.000Z"))).toBe(true);
  });

  it("deja de estarlo al dia siguiente", () => {
    expect(enPrueba("trial", fin, enUTC("2026-10-06T00:01:00.000Z"))).toBe(false);
    expect(pruebaAgotada("trial", fin, enUTC("2026-10-06T00:01:00.000Z"))).toBe(true);
  });

  it("una empresa ya suscrita no esta en prueba", () => {
    expect(enPrueba("pending_payment", fin, enUTC("2026-09-29T00:00:00.000Z"))).toBe(false);
    expect(enPrueba("active", fin, enUTC("2026-09-29T00:00:00.000Z"))).toBe(false);
  });

  it("las empresas del regimen antiguo no entran en nada de esto", () => {
    // Las tres empresas que ya existen tienen las columnas nuevas en NULL.
    expect(enPrueba(null, null, enUTC("2026-09-29T00:00:00.000Z"))).toBe(false);
    expect(pruebaAgotada(null, null, enUTC("2026-09-29T00:00:00.000Z"))).toBe(false);
  });
});

describe("facturacionEnEspera", () => {
  it("no se factura durante la prueba ni despues de agotarse sin contratar", () => {
    expect(facturacionEnEspera("trial")).toBe(true);
    expect(facturacionEnEspera("expired")).toBe(true);
  });

  it("si se factura cuando hay suscripcion", () => {
    expect(facturacionEnEspera("pending_payment")).toBe(false);
    expect(facturacionEnEspera("active")).toBe(false);
  });

  it("el regimen antiguo sigue facturando como hasta ahora", () => {
    expect(facturacionEnEspera(null)).toBe(false);
    expect(facturacionEnEspera(undefined)).toBe(false);
  });
});

describe("activarSuscripcion", () => {
  it("la fecha de suscripcion es la de contratar, no la del alta", () => {
    const alta = activarSuscripcion(enUTC("2026-10-02T09:30:00.000Z"));

    expect(alta.subscribedAt.toISOString()).toBe("2026-10-02T09:30:00.000Z");
    expect(alta.billingDayOfMonth).toBe(2);
    expect(alta.dueDate).toBe("2026-11-02");
    expect(alta.recurrence).toBe("monthly");
  });

  it("nunca queda activa por pulsar un boton", () => {
    const alta = activarSuscripcion(enUTC("2026-10-02T09:30:00.000Z"));
    expect(alta.subscriptionStatus).toBe("pending_payment");
    expect(alta.subscriptionStatus).not.toBe("active");
  });

  it("el ejemplo de la regla: suscrito el 15, cobro el 15", () => {
    const alta = activarSuscripcion(enUTC("2026-10-15T12:00:00.000Z"));

    expect(alta.billingDayOfMonth).toBe(15);
    expect(alta.dueDate).toBe("2026-11-15");
  });
});

describe("proximoCobro", () => {
  it("avanza un mes de calendario, no 30 dias", () => {
    expect(proximoCobro("2026-10-15", 15).format("YYYY-MM-DD")).toBe("2026-11-15");
    expect(proximoCobro("2026-11-15", 15).format("YYYY-MM-DD")).toBe("2026-12-15");
    expect(proximoCobro("2026-12-15", 15).format("YYYY-MM-DD")).toBe("2027-01-15");
  });

  it("doce meses seguidos conservan el dia", () => {
    // Con "+30 dias" el dia 15 habria caido al 9 antes de terminar el ano.
    let fecha = "2026-01-15";
    for (let i = 0; i < 12; i += 1) {
      fecha = proximoCobro(fecha, 15).format("YYYY-MM-DD");
    }

    expect(fecha).toBe("2027-01-15");
  });

  it("el dia 31 pasa por febrero y VUELVE al 31", () => {
    // Lo que no puede pasar es quedarse en 28 para siempre.
    const febrero = proximoCobro("2026-01-31", 31);
    expect(febrero.format("YYYY-MM-DD")).toBe("2026-02-28");

    const marzo = proximoCobro(febrero.format("YYYY-MM-DD"), 31);
    expect(marzo.format("YYYY-MM-DD")).toBe("2026-03-31");

    const abril = proximoCobro(marzo.format("YYYY-MM-DD"), 31);
    expect(abril.format("YYYY-MM-DD")).toBe("2026-04-30");

    const mayo = proximoCobro(abril.format("YYYY-MM-DD"), 31);
    expect(mayo.format("YYYY-MM-DD")).toBe("2026-05-31");
  });

  it("respeta el ano bisiesto", () => {
    // 2028 es bisiesto; 2026 no.
    expect(proximoCobro("2028-01-30", 30).format("YYYY-MM-DD")).toBe("2028-02-29");
    expect(proximoCobro("2026-01-30", 30).format("YYYY-MM-DD")).toBe("2026-02-28");
  });

  it("el dia 29 sobrevive a un febrero corto", () => {
    const febrero = proximoCobro("2026-01-29", 29);
    expect(febrero.format("YYYY-MM-DD")).toBe("2026-02-28");
    expect(proximoCobro(febrero.format("YYYY-MM-DD"), 29).format("YYYY-MM-DD")).toBe(
      "2026-03-29"
    );
  });

  it("cruza el cambio de ano", () => {
    expect(proximoCobro("2026-12-31", 31).format("YYYY-MM-DD")).toBe("2027-01-31");
  });
});

describe("cobroDelMes", () => {
  it("recorta al ultimo dia disponible sin olvidar el pretendido", () => {
    expect(cobroDelMes(2026, 1, 31).format("YYYY-MM-DD")).toBe("2026-02-28");
    expect(cobroDelMes(2026, 3, 31).format("YYYY-MM-DD")).toBe("2026-04-30");
    expect(cobroDelMes(2026, 0, 31).format("YYYY-MM-DD")).toBe("2026-01-31");
  });
});
