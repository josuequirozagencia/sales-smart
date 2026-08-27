import { QueryInterface, DataTypes } from "sequelize";

// Peso de distribuição de leads por atendente.
//
// 100 é o normal, 50 faz a pessoa receber metade dos turnos e 0 tira-a da
// distribuição sem removê-la da fila — o caso de quem está de licença.
//
// O padrão é 100 justamente para que aplicar esta migração não mude o
// comportamento de ninguém: com todos em 100 a distribuição continua igual à
// rotação simples que existia antes.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "distributionWeight", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "distributionWeight");
  }
};
