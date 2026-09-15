import { QueryInterface, DataTypes } from "sequelize";

/**
 * Que conexion (fila de Whatsapps: whatsapp, whatsapp_oficial, facebook o
 * instagram) atiende cada agente. whatsappId es unico: un canal usa como
 * maximo un agente a la vez. Borrar el agente o la conexion borra el enlace.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiAgentChannels", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      agentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AiAgents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    });

    await queryInterface.addIndex("AiAgentChannels", ["agentId"], { name: "ai_agent_channels_agent" });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiAgentChannels");
  }
};
