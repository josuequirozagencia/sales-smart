import {
  isWithinWorkingHours,
  isRotationDue,
  hasReachedRotationLimit,
  MAX_AUTO_ROTATIONS
} from "../../helpers/RotationPolicy";

// Reglas de la rotación automática por falta de respuesta.
//
// Vale la pena probarlas con cuidado porque los dos extremos hacen daño de
// formas distintas: si rota de menos, un lead se queda esperando sin que
// nadie lo note; si rota de más, el mismo lead va rebotando entre asesores y
// ninguno llega a hacerse cargo.

describe("isWithinWorkingHours", () => {
  const alas = (hhmm: string): number => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  it("acepta dentro del turno y rechaza fuera", () => {
    expect(isWithinWorkingHours("09:00", "18:00", alas("12:00"))).toBe(true);
    expect(isWithinWorkingHours("09:00", "18:00", alas("09:00"))).toBe(true);
    expect(isWithinWorkingHours("09:00", "18:00", alas("18:00"))).toBe(true);

    // El caso del enunciado: son las 19:00 y su turno acabó a las 18:00.
    expect(isWithinWorkingHours("09:00", "18:00", alas("19:00"))).toBe(false);
    expect(isWithinWorkingHours("09:00", "18:00", alas("08:59"))).toBe(false);
  });

  it("entiende el turno que cruza la medianoche", () => {
    // 22:00-06:00. Aquí el interior del intervalo son los extremos, no el
    // centro: a las 23:00 está trabajando y a las 12:00 no.
    expect(isWithinWorkingHours("22:00", "06:00", alas("23:00"))).toBe(true);
    expect(isWithinWorkingHours("22:00", "06:00", alas("02:00"))).toBe(true);
    expect(isWithinWorkingHours("22:00", "06:00", alas("06:00"))).toBe(true);
    expect(isWithinWorkingHours("22:00", "06:00", alas("12:00"))).toBe(false);
    expect(isWithinWorkingHours("22:00", "06:00", alas("21:59"))).toBe(false);
  });

  it("trata inicio igual a fin como sin restricción", () => {
    expect(isWithinWorkingHours("09:00", "09:00", alas("03:00"))).toBe(true);
    expect(isWithinWorkingHours("00:00", "00:00", alas("15:00"))).toBe(true);
  });

  it("no bloquea a nadie cuando el dato falta o es inválido", () => {
    // La decisión importa: es peor dejar un lead sin repartir que asignarlo
    // fuera de horario, así que todo dato dudoso se resuelve como disponible.
    const entradas: any[] = [
      [null, null],
      [undefined, undefined],
      ["", ""],
      ["09:00", null],
      [null, "18:00"],
      ["mañana", "tarde"],
      ["25:00", "18:00"],
      ["09:70", "18:00"],
      [9, 18],
      ["9-00", "18-00"]
    ];

    entradas.forEach(([inicio, fin]) => {
      expect(isWithinWorkingHours(inicio, fin, alas("12:00"))).toBe(true);
    });
  });

  it("acepta el formato actual de los usuarios y una sola cifra en la hora", () => {
    // Los cuatro usuarios de la instalación tienen 00:00-23:59.
    expect(isWithinWorkingHours("00:00", "23:59", alas("12:00"))).toBe(true);
    expect(isWithinWorkingHours("00:00", "23:59", alas("00:00"))).toBe(true);

    expect(isWithinWorkingHours("9:00", "18:00", alas("12:00"))).toBe(true);
    expect(isWithinWorkingHours("9:00", "18:00", alas("19:00"))).toBe(false);
  });
});

describe("isRotationDue", () => {
  const base = new Date("2031-03-10T10:00:00.000Z");
  const mas = (minutos: number): Date =>
    new Date(base.getTime() + minutos * 60 * 1000);

  it("no rota antes de cumplirse el plazo", () => {
    expect(isRotationDue(base, 20, mas(0))).toBe(false);
    expect(isRotationDue(base, 20, mas(19))).toBe(false);
    expect(isRotationDue(base, 20, mas(19.9))).toBe(false);
  });

  it("rota al cumplirse el plazo y después", () => {
    expect(isRotationDue(base, 20, mas(20))).toBe(true);
    expect(isRotationDue(base, 20, mas(45))).toBe(true);
  });

  it("no rota sin fecha de asignación", () => {
    // Un ticket anterior a esta función no tiene reloj. Se deja pasar la
    // vuelta en lugar de rotarlo de golpe.
    expect(isRotationDue(null, 20, mas(999))).toBe(false);
    expect(isRotationDue(undefined, 20, mas(999))).toBe(false);
  });

  it("no rota con un plazo sin sentido", () => {
    expect(isRotationDue(base, 0, mas(999))).toBe(false);
    expect(isRotationDue(base, -5, mas(999))).toBe(false);
    expect(isRotationDue(base, NaN, mas(999))).toBe(false);
  });

  it("respeta el plazo configurado en la cola, no un valor fijo", () => {
    // La cola Ventas tiene tempoRoteador = 1, que es demasiado agresivo para
    // producción, pero la función debe obedecer lo que diga la cola.
    expect(isRotationDue(base, 1, mas(1))).toBe(true);
    expect(isRotationDue(base, 60, mas(30))).toBe(false);
  });
});

describe("hasReachedRotationLimit", () => {
  it("permite exactamente dos rotaciones automáticas", () => {
    // assignments cuenta la primera asignación, así que:
    //   1 asignación  -> 0 rotaciones -> puede rotar
    //   2 asignaciones -> 1 rotación  -> puede rotar
    //   3 asignaciones -> 2 rotaciones -> se acabó, escala
    expect(hasReachedRotationLimit(1)).toBe(false);
    expect(hasReachedRotationLimit(2)).toBe(false);
    expect(hasReachedRotationLimit(3)).toBe(true);
    expect(hasReachedRotationLimit(4)).toBe(true);
  });

  it("aguanta un contador vacío o incoherente", () => {
    expect(hasReachedRotationLimit(0)).toBe(false);
    expect(hasReachedRotationLimit(-1)).toBe(false);
  });

  it("el límite acordado es 2", () => {
    expect(MAX_AUTO_ROTATIONS).toBe(2);
  });
});
