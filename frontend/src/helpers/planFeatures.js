import { toast } from "react-toastify";

/**
 * Normalização segura das flags de plano da empresa.
 *
 * O endpoint /companies/listPlan/:id devolve a empresa com o relacionamento
 * "plan". Quando a empresa não tem "planId" (ou o plano foi removido), o
 * relacionamento vem como null e qualquer leitura direta de
 * planConfigs.plan.useX lança TypeError, desmontando a árvore React
 * (tela branca). Este helper centraliza o tratamento:
 *
 *  - devolve sempre um objeto de flags completo;
 *  - sinaliza explicitamente (hasPlan) quando a empresa está sem plano;
 *  - registra diagnóstico no console e avisa o usuário uma única vez,
 *    para que a ausência de funcionalidades nunca seja silenciosa.
 */

export const PLAN_FEATURE_KEYS = [
  "useWhatsapp",
  "useFacebook",
  "useInstagram",
  "useCampaigns",
  "useSchedules",
  "useInternalChat",
  "useExternalApi",
  "useKanban",
  "useOpenAi",
  "useIntegrations",
  "useWhatsappOfficial"
];

export const EMPTY_PLAN_FEATURES = PLAN_FEATURE_KEYS.reduce((acc, key) => {
  acc[key] = false;
  return acc;
}, {});

let missingPlanNotified = false;

const notifyMissingPlan = (companyId, context) => {
  // eslint-disable-next-line no-console
  console.error(
    `[planFeatures] A empresa ${companyId ?? "desconhecida"} não possui plano associado (planId nulo). ` +
    `Origem: ${context || "não informada"}. ` +
    "Os recursos dependentes de plano permanecem desabilitados até que um plano seja atribuído à empresa."
  );

  if (!missingPlanNotified) {
    missingPlanNotified = true;
    toast.warn(
      "Esta empresa não possui um plano associado. Os recursos dependentes de plano ficarão indisponíveis até que um plano seja atribuído.",
      { toastId: "missing-company-plan", autoClose: 6000 }
    );
  }
};

/**
 * @param {object|null} planConfigs resposta de getPlanCompany
 * @param {string} context nome do componente/página (diagnóstico)
 * @returns {{ hasPlan: boolean, features: object, company: object|null }}
 */
export const resolvePlanFeatures = (planConfigs, context) => {
  const plan = planConfigs && planConfigs.plan ? planConfigs.plan : null;

  if (!plan) {
    notifyMissingPlan(planConfigs?.id, context);
    return {
      hasPlan: false,
      features: { ...EMPTY_PLAN_FEATURES },
      company: planConfigs || null
    };
  }

  return {
    hasPlan: true,
    features: { ...EMPTY_PLAN_FEATURES, ...plan },
    company: planConfigs
  };
};

export default resolvePlanFeatures;
