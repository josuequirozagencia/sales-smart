// Fonte única dos modelos de IA oferecidos na interface.
//
// Antes cada componente tinha a sua própria cópia da lista, e elas
// envelheceram em silêncio: a lista do Gemini chegou a ficar inteiramente
// composta de modelos aposentados. Manter isto num só lugar é o que evita
// que volte a acontecer.
//
// Ao rever esta lista, confira os catálogos oficiais em vez de confiar na
// memória — os provedores aposentam IDs com frequência:
//   OpenAI  https://developers.openai.com/api/docs/models
//           https://developers.openai.com/api/docs/deprecations
//   Google  https://ai.google.dev/gemini-api/docs/models

// Removidos gpt-3.5-turbo (e variantes), gpt-4 e gpt-4-turbo: desligados
// pela OpenAI em 23/10/2026. gpt-4o e gpt-4o-mini seguem disponíveis.
export const OPENAI_MODELS = [
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-4o",
  "gpt-4o-mini"
];

// A lista anterior estava inteiramente morta: gemini-pro, gemini-1.5-pro e
// gemini-1.5-flash aposentados, gemini-2.0-flash desligado pelo Google e
// gemini-2.0-pro nunca existiu como ID estável.
export const GEMINI_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
];

// Padrão dos nós do FlowBuilder: faixa equilibrada.
export const DEFAULT_OPENAI_MODEL = "gpt-5.6-terra";
export const DEFAULT_GEMINI_MODEL = "gemini-3.7-flash";

// Padrão dos Prompts (integração por filas): faixa econômica, porque
// substitui o gpt-3.5-turbo-1106 que estava fixo no código e era barato.
// Deve casar com o defaultValue da migração 20260824120000.
export const DEFAULT_PROMPT_MODEL = "gpt-5.6-luna";

const MODEL_LABELS = {
  "gpt-5.6-sol": "GPT-5.6 Sol (máxima capacidade)",
  "gpt-5.6-terra": "GPT-5.6 Terra (equilibrado)",
  "gpt-5.6-luna": "GPT-5.6 Luna (econômico)",
  "gpt-4o": "GPT-4o (geração anterior)",
  "gpt-4o-mini": "GPT-4o Mini (geração anterior)",
  "gemini-3.7-flash": "Gemini 3.7 Flash (recomendado)",
  "gemini-3.6-flash": "Gemini 3.6 Flash",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gemini-3.5-flash-lite": "Gemini 3.5 Flash Lite (econômico)",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite (econômico)"
};

// IDs desconhecidos são devolvidos como estão: um modelo já salvo que saiu
// da lista continua legível no seletor em vez de virar uma opção em branco.
export const getModelDisplayName = model => MODEL_LABELS[model] || model;

// Opções a exibir num seletor, preservando um modelo já salvo que não esteja
// mais na lista. Trocá-lo em silêncio mudaria fluxos em produção sem aviso.
export const modelOptionsFor = (models, currentModel) =>
  !currentModel || models.includes(currentModel)
    ? models
    : [...models, currentModel];
