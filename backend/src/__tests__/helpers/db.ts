import sequelize from "../../database";
import Company from "../../models/Company";
import Plan from "../../models/Plan";

// Helpers compartilhados pelos testes.
//
// Os testes rodam contra o banco chatia_test, definido em .env.test e
// carregado por bootstrap.ts quando NODE_ENV=test. As migrations e os seeds
// são aplicados uma única vez (npm run test:setup), não a cada execução:
// são 317 migrations e rodá-las por suíte tornaria o ciclo inutilizável.
//
// Cada teste limpa o que cria, para poder rodar a suíte repetidamente sem
// recriar o banco.

export const closeConnection = async (): Promise<void> => {
  await sequelize.close();
};

// A empresa 1 e o plano vêm dos seeds. Vários serviços dependem deles
// (CreateQueueService checa o limite de filas do plano da empresa), então
// falhar cedo com uma mensagem clara evita perseguir erros confusos.
export const getSeededCompany = async (): Promise<Company> => {
  const company = await Company.findByPk(1, {
    include: [{ model: Plan, as: "plan" }]
  });

  if (!company) {
    throw new Error(
      "Empresa 1 não encontrada no banco de teste. Rode `npm run test:setup`."
    );
  }

  return company;
};

// Nome único por execução: name e color de Queue têm restrição de unicidade,
// e um teste que deixe lixo para trás não pode derrubar o seguinte.
export const uniqueSuffix = (): string =>
  `${Date.now()}${Math.floor(Math.random() * 1000)}`;
