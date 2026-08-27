import { QueryInterface, DataTypes } from "sequelize";

// Créditos do round-robin ponderado, por fila.
//
// O algoritmo guarda um crédito acumulado por atendente e escolhe sempre quem
// tem mais. Como o número de atendentes de uma fila varia, guardar isso num
// JSON evita criar uma tabela de junção só para um contador.
//
// Fica ao lado do lastUserIndex já existente, que continua servindo a rotação
// antiga: filas ainda não migradas seguem funcionando sem alteração.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("QueueStates", "weightState", {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("QueueStates", "weightState");
  }
};
