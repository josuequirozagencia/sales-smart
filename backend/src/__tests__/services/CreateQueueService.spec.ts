import CreateQueueService from "../../services/QueueService/CreateQueueService";
import Queue from "../../models/Queue";
import { closeConnection, getSeededCompany, uniqueSuffix } from "../helpers/db";

// Regressão do 500 ao criar fila sem o campo `chatbots`.
//
// CreateQueueService passa queueData direto para Queue.create com um include
// de Chatbot. Com chatbots undefined ou null, o Sequelize 5 tentava construir
// um Chatbot a partir desse valor em vez de ignorar a associação, e quebrava
// com "notNull Violation: Chatbot.name cannot be null" — depois de já ter
// gravado a fila, então o retry batia na restrição de unicidade de name/color.

const COMPANY_ID = 1;
const createdQueueIds: number[] = [];

const baseQueue = (overrides: Record<string, unknown> = {}) => {
  const suffix = uniqueSuffix();
  return {
    name: `fila-${suffix}`,
    color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`,
    greetingMessage: "olá",
    companyId: COMPANY_ID,
    ativarRoteador: false,
    tempoRoteador: 0,
    ...overrides
  };
};

beforeAll(async () => {
  await getSeededCompany();
});

afterAll(async () => {
  await Queue.destroy({ where: { id: createdQueueIds } });
  await closeConnection();
});

const create = async (overrides: Record<string, unknown> = {}) => {
  const queue = await CreateQueueService(baseQueue(overrides) as any);
  createdQueueIds.push(queue.id);
  return queue;
};

describe("CreateQueueService", () => {
  it("cria a fila quando chatbots não é informado", async () => {
    const queue = await create();

    expect(queue.id).toBeDefined();
    expect(queue.chatbots).toEqual([]);
  });

  it("cria a fila quando chatbots vem como null", async () => {
    const queue = await create({ chatbots: null });

    expect(queue.id).toBeDefined();
  });

  it("cria a fila quando chatbots vem como array vazio", async () => {
    const queue = await create({ chatbots: [] });

    expect(queue.id).toBeDefined();
  });

  it("não deixa a fila gravada quando a validação falha", async () => {
    // Cor inválida: o schema Yup rejeita antes do insert. O que importa aqui
    // é que não sobre uma fila órfã — foi esse efeito colateral que tornava o
    // bug original difícil de contornar, porque o retry batia na unicidade.
    const name = `fila-invalida-${uniqueSuffix()}`;

    // ATENÇÃO ao escrever novos testes: `.rejects.toThrow()` NÃO funciona com
    // os erros deste projeto. AppError (src/errors/AppError.ts) é uma classe
    // simples que não estende Error, e o matcher toThrow() do Jest exige uma
    // instância de Error — o teste falha com "Received function did not throw"
    // mesmo quando o serviço rejeitou corretamente. Use toMatchObject.
    await expect(
      CreateQueueService(baseQueue({ name, color: "nao-e-uma-cor" }) as any)
    ).rejects.toMatchObject({ message: "ERR_QUEUE_INVALID_COLOR" });

    const found = await Queue.findOne({ where: { name } });
    expect(found).toBeNull();
  });
});
