import { diasDePruebaRestantes } from "./index";

// El contador del banner. Lo que se vigila aqui es que el numero NO este
// escrito en ninguna parte y que cuente igual que el backend: por dia
// natural en UTC. Si contara de otra forma habria un dia en el que el aviso
// y el control de acceso dirian cosas distintas.

const FIN = "2026-10-05T15:00:00.000Z";

describe("diasDePruebaRestantes", () => {
  it("cuenta del 7 al 1 segun avanza la prueba", () => {
    const esperado = [
      ["2026-09-28T16:00:00.000Z", 7],
      ["2026-09-29T16:00:00.000Z", 6],
      ["2026-09-30T16:00:00.000Z", 5],
      ["2026-10-01T16:00:00.000Z", 4],
      ["2026-10-02T16:00:00.000Z", 3],
      ["2026-10-03T16:00:00.000Z", 2],
      ["2026-10-04T16:00:00.000Z", 1],
    ];

    esperado.forEach(([ahora, dias]) => {
      expect(diasDePruebaRestantes(FIN, new Date(ahora))).toBe(dias);
    });
  });

  it("el ultimo dia vale cero: termina hoy", () => {
    expect(diasDePruebaRestantes(FIN, new Date("2026-10-05T00:01:00.000Z"))).toBe(0);
    expect(diasDePruebaRestantes(FIN, new Date("2026-10-05T23:59:00.000Z"))).toBe(0);
  });

  it("pasado el plazo es negativo: prueba terminada", () => {
    expect(diasDePruebaRestantes(FIN, new Date("2026-10-06T00:01:00.000Z"))).toBe(-1);
    expect(diasDePruebaRestantes(FIN, new Date("2026-10-12T00:01:00.000Z"))).toBe(-7);
  });

  it("no cambia a lo largo del mismo dia", () => {
    // Si dependiera de la hora, el contador bajaria a media jornada.
    const manana = diasDePruebaRestantes(FIN, new Date("2026-10-02T00:10:00.000Z"));
    const noche = diasDePruebaRestantes(FIN, new Date("2026-10-02T23:50:00.000Z"));

    expect(manana).toBe(noche);
    expect(manana).toBe(3);
  });

  it("cruza el cambio de mes", () => {
    expect(
      diasDePruebaRestantes("2026-10-02T10:00:00.000Z", new Date("2026-09-28T10:00:00.000Z"))
    ).toBe(4);
  });

  it("sin fecha no dice que se acabo, dice que no sabe", () => {
    // Las empresas anteriores a la prueba gratuita tienen el campo nulo: el
    // banner no debe aparecerles.
    expect(diasDePruebaRestantes(null)).toBeNull();
    expect(diasDePruebaRestantes(undefined)).toBeNull();
    expect(diasDePruebaRestantes("")).toBeNull();
    expect(diasDePruebaRestantes("manana")).toBeNull();
  });
});
