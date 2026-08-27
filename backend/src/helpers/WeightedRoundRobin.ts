// Round-robin ponderado, algoritmo "smooth weighted round-robin" (o mesmo do
// nginx).
//
// A rotação anterior era um índice simples: cada atendente recebia exatamente
// um lead por volta. Isso não permite dizer "esta pessoa está sobrecarregada,
// mande metade" nem "esta está de licença, não mande nada".
//
// Com pesos 100/50/50 a distribuição fica 2:1:1, e — esta é a graça do
// algoritmo "suave" — os turnos ficam intercalados (A, B, A, C) em vez de
// virem em rajadas (A, A, B, C). Ninguém recebe dois leads seguidos só porque
// tem peso maior.
//
// A função é pura de propósito: recebe os candidatos e os créditos atuais,
// devolve o escolhido e os créditos novos. Quem chama cuida da persistência.
// Assim a regra de distribuição pode ser testada sem banco.

export interface WeightedCandidate {
  id: number;
  weight: number;
}

export interface WeightedPick {
  selectedId: number | null;
  credits: Record<string, number>;
}

// Créditos ficam indexados por id em string porque é assim que sobrevivem a
// uma ida e volta por JSON (JSON.stringify transforma chaves numéricas em
// string de qualquer forma).
export const pickWeighted = (
  candidates: WeightedCandidate[],
  currentCredits: Record<string, number> = {}
): WeightedPick => {
  // Peso <= 0 significa "não distribuir para esta pessoa": é assim que se
  // desativa quem está de licença sem removê-la da fila.
  const eligible = candidates.filter(c => c && c.weight > 0);

  if (eligible.length === 0) {
    return { selectedId: null, credits: currentCredits };
  }

  const totalWeight = eligible.reduce((sum, c) => sum + c.weight, 0);

  // Só se mantêm créditos de quem continua elegível. Sem esta limpeza, alguém
  // que ficou offline por semanas voltaria acumulando crédito e levaria vários
  // leads seguidos ao reaparecer.
  const credits: Record<string, number> = {};
  eligible.forEach(c => {
    const previous = currentCredits[String(c.id)] || 0;
    credits[String(c.id)] = previous + c.weight;
  });

  let selected = eligible[0];
  eligible.forEach(c => {
    if (credits[String(c.id)] > credits[String(selected.id)]) {
      selected = c;
    }
  });

  credits[String(selected.id)] -= totalWeight;

  return { selectedId: selected.id, credits };
};

export default pickWeighted;
