import { pickWeighted } from "../../helpers/WeightedRoundRobin";

// Distribuição ponderada de leads.
//
// A rotação antiga dava exatamente um lead por volta a cada atendente. Estes
// testes cobrem o que passou a ser possível: reduzir a carga de quem está
// sobrecarregado e zerar a de quem está de licença, sem tirar ninguém da fila.
//
// Vale testar com cuidado porque é lógica que falha em silêncio: uma
// distribuição torta não gera erro, só injustiça que ninguém percebe até
// alguém reclamar.

// Roda N sorteios encadeando os créditos, como o serviço faz na prática.
const distribute = (
  candidates: { id: number; weight: number }[],
  rounds: number
): Record<number, number> => {
  const counts: Record<number, number> = {};
  let credits = {};

  for (let i = 0; i < rounds; i += 1) {
    const result = pickWeighted(candidates, credits);
    credits = result.credits;

    if (result.selectedId !== null) {
      counts[result.selectedId] = (counts[result.selectedId] || 0) + 1;
    }
  }

  return counts;
};

describe("pickWeighted", () => {
  it("reparte por igual quando todos têm o mesmo peso", () => {
    const counts = distribute(
      [
        { id: 1, weight: 100 },
        { id: 2, weight: 100 },
        { id: 3, weight: 100 }
      ],
      30
    );

    expect(counts[1]).toBe(10);
    expect(counts[2]).toBe(10);
    expect(counts[3]).toBe(10);
  });

  it("respeita a proporção dos pesos", () => {
    // Quem está sobrecarregado passa a 50: recebe metade dos turnos.
    const counts = distribute(
      [
        { id: 1, weight: 100 },
        { id: 2, weight: 50 },
        { id: 3, weight: 50 }
      ],
      20
    );

    expect(counts[1]).toBe(10);
    expect(counts[2]).toBe(5);
    expect(counts[3]).toBe(5);
  });

  it("nunca escolhe quem tem peso zero", () => {
    // O caso de quem está de licença.
    const counts = distribute(
      [
        { id: 1, weight: 100 },
        { id: 2, weight: 0 },
        { id: 3, weight: 100 }
      ],
      20
    );

    expect(counts[2]).toBeUndefined();
    expect(counts[1]).toBe(10);
    expect(counts[3]).toBe(10);
  });

  it("devolve null quando ninguém está elegível", () => {
    const { selectedId } = pickWeighted([
      { id: 1, weight: 0 },
      { id: 2, weight: 0 }
    ]);

    expect(selectedId).toBeNull();
  });

  it("devolve null quando não há candidatos", () => {
    expect(pickWeighted([]).selectedId).toBeNull();
  });

  it("distribui sem rajadas longas", () => {
    // O ponto do algoritmo "suave" não é alternar sempre — com 2:1:1 a
    // sequência real é 1,2,3,1 e quem tem peso dobrado acaba recebendo dois
    // seguidos na emenda entre ciclos. Isso é esperado: o nginx, com pesos
    // 5:1:1, também produz a,a,b,a,c,a,a.
    //
    // O que se garante, e é o que importa na prática, é que a proporção se
    // cumpre e ninguém acumula uma rajada longa — leads chegam ao longo do
    // dia, e uma rajada faria alguém receber tudo de manhã e nada à tarde.
    const candidates = [
      { id: 1, weight: 100 },
      { id: 2, weight: 50 },
      { id: 3, weight: 50 }
    ];

    const sequence: number[] = [];
    let credits = {};

    for (let i = 0; i < 12; i += 1) {
      const result = pickWeighted(candidates, credits);
      credits = result.credits;
      sequence.push(result.selectedId as number);
    }

    // Proporção 2:1:1 exata em 12 turnos.
    expect(sequence.filter(id => id === 1)).toHaveLength(6);
    expect(sequence.filter(id => id === 2)).toHaveLength(3);
    expect(sequence.filter(id => id === 3)).toHaveLength(3);

    let longestRun = 1;
    let currentRun = 1;
    for (let i = 1; i < sequence.length; i += 1) {
      currentRun = sequence[i] === sequence[i - 1] ? currentRun + 1 : 1;
      longestRun = Math.max(longestRun, currentRun);
    }

    // Com peso dobrado, no máximo dois seguidos.
    expect(longestRun).toBeLessThanOrEqual(2);
  });

  it("descarta créditos de quem saiu da rotação", () => {
    // Sem esta limpeza, quem ficasse offline por muito tempo voltaria com
    // crédito acumulado e levaria vários leads seguidos ao reaparecer.
    const credits = { "1": 500, "2": 0, "99": 9999 };

    const result = pickWeighted(
      [
        { id: 1, weight: 100 },
        { id: 2, weight: 100 }
      ],
      credits
    );

    expect(Object.keys(result.credits).sort()).toEqual(["1", "2"]);
    expect(result.credits["99"]).toBeUndefined();
  });

  it("trata a entrada e saída de gente sem travar", () => {
    let credits = {};
    const counts: Record<number, number> = {};

    // Começa com dois; no meio entra um terceiro.
    for (let i = 0; i < 12; i += 1) {
      const candidates =
        i < 6
          ? [
              { id: 1, weight: 100 },
              { id: 2, weight: 100 }
            ]
          : [
              { id: 1, weight: 100 },
              { id: 2, weight: 100 },
              { id: 3, weight: 100 }
            ];

      const result = pickWeighted(candidates, credits);
      credits = result.credits;
      counts[result.selectedId as number] =
        (counts[result.selectedId as number] || 0) + 1;
    }

    // Os 6 primeiros dividem-se entre 1 e 2; os 6 seguintes entre os três.
    expect(counts[1]).toBe(5);
    expect(counts[2]).toBe(5);
    expect(counts[3]).toBe(2);
  });
});
