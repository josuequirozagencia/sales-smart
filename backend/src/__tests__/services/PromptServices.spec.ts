import CreatePromptService from "../../services/PromptServices/CreatePromptService";
import UpdatePromptService from "../../services/PromptServices/UpdatePromptService";
import ShowPromptService from "../../services/PromptServices/ShowPromptService";
import Prompt from "../../models/Prompt";
import Queue from "../../models/Queue";
import { closeConnection, getSeededCompany, uniqueSuffix } from "../helpers/db";

// Cobre a coluna `model` dos Prompts.
//
// Antes dela o modelo estava fixo em wbotMessageListener como
// "gpt-3.5-turbo-1106", que a OpenAI desliga em 23/10/2026: ninguém podia
// trocá-lo e a integração de IA por filas ia parar de responder naquela data.
// Estes testes garantem que a escolha continua chegando ao banco.

const COMPANY_ID = 1;

let queueId: number;
const createdPromptIds: number[] = [];

const basePrompt = (overrides: Record<string, unknown> = {}) => ({
  name: `prompt-${uniqueSuffix()}`,
  apiKey: "sk-chave-de-teste-nao-real",
  prompt: "Você é um assistente de teste.",
  queueId,
  maxMessages: 10,
  maxTokens: 500,
  temperature: 1,
  voice: "texto",
  companyId: COMPANY_ID,
  ...overrides
});

beforeAll(async () => {
  await getSeededCompany();

  const queue = await Queue.create({
    name: `fila-prompt-${uniqueSuffix()}`,
    color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`,
    greetingMessage: "olá",
    companyId: COMPANY_ID,
    ativarRoteador: false,
    tempoRoteador: 0
  });

  queueId = queue.id;
});

afterAll(async () => {
  await Prompt.destroy({ where: { id: createdPromptIds } });
  await Queue.destroy({ where: { id: queueId } });
  await closeConnection();
});

const create = async (overrides: Record<string, unknown> = {}) => {
  const prompt = await CreatePromptService(basePrompt(overrides) as any);
  createdPromptIds.push(prompt.id);
  return prompt;
};

describe("CreatePromptService", () => {
  it("persiste o modelo informado", async () => {
    const prompt = await create({ model: "gpt-5.6-sol" });

    expect(prompt.model).toBe("gpt-5.6-sol");

    // Relido do banco, não apenas o objeto devolvido em memória.
    const fromDb = await Prompt.findByPk(prompt.id);
    expect(fromDb?.model).toBe("gpt-5.6-sol");
  });

  it("usa o padrão da migração quando o modelo não é informado", async () => {
    const prompt = await create();

    // Faixa econômica, escolhida para não multiplicar o custo de quem já
    // usava o gpt-3.5-turbo-1106 que estava fixo no código.
    expect(prompt.model).toBe("gpt-5.6-luna");
  });
});

describe("UpdatePromptService", () => {
  it("troca o modelo de um prompt existente", async () => {
    const prompt = await create({ model: "gpt-5.6-sol" });

    await UpdatePromptService({
      promptId: prompt.id,
      companyId: COMPANY_ID,
      promptData: basePrompt({ name: prompt.name, model: "gpt-4o-mini" }) as any
    });

    const fromDb = await Prompt.findByPk(prompt.id);
    expect(fromDb?.model).toBe("gpt-4o-mini");
  });

  it("não apaga o modelo ao atualizar outros campos", async () => {
    const prompt = await create({ model: "gpt-5.6-sol" });

    await UpdatePromptService({
      promptId: prompt.id,
      companyId: COMPANY_ID,
      promptData: basePrompt({
        name: prompt.name,
        model: "gpt-5.6-sol",
        maxMessages: 25
      }) as any
    });

    const fromDb = await Prompt.findByPk(prompt.id);
    expect(fromDb?.maxMessages).toBe(25);
    expect(fromDb?.model).toBe("gpt-5.6-sol");
  });
});

describe("ShowPromptService", () => {
  it("devolve o modelo junto com o prompt", async () => {
    const prompt = await create({ model: "gpt-4o" });

    const shown = await ShowPromptService({
      promptId: prompt.id,
      companyId: COMPANY_ID
    });

    expect(shown.model).toBe("gpt-4o");
  });
});
