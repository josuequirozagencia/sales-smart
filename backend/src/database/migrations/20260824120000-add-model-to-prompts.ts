import { QueryInterface, DataTypes } from "sequelize";

// O modelo usado pelos Prompts estava fixo no código como
// "gpt-3.5-turbo-1106", que a OpenAI desliga em 23/10/2026. Esta coluna
// passa a escolha para quem configura, igual ao que já acontece nos nós
// do FlowBuilder.
//
// O padrão é gpt-5.6-luna (faixa econômica) e não um modelo de topo:
// gpt-3.5-turbo-1106 era barato, e promover todos os prompts existentes
// para um modelo caro multiplicaria a fatura de quem já usa a integração
// sem que ninguém tivesse pedido isso.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Prompts", "model", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "gpt-5.6-luna"
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Prompts", "model");
  }
};
