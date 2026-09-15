import { QueryInterface, DataTypes } from "sequelize";

/**
 * Seguimientos automaticos pendientes de un agente en un ticket.
 *
 * Cada vez que el agente responde se programa el paso 1 (dueAt = ahora +
 * "when" del paso). Si el cliente contesta, un humano toma el ticket, se cierra
 * o se activa "Detener bot", los pendientes se cancelan. Al enviarse un paso
 * se programa el siguiente. status: pending | sent | cancelled | failed.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiAgentFollowUpJobs", {
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
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      step: { type: DataTypes.INTEGER, allowNull: false },
      dueAt: { type: DataTypes.DATE, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: "pending" },
      reason: { type: DataTypes.STRING, allowNull: true },
      lastError: { type: DataTypes.TEXT, allowNull: true },
      sentAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    });

    await queryInterface.addIndex("AiAgentFollowUpJobs", ["status", "dueAt"], { name: "ai_follow_ups_due" });
    await queryInterface.addIndex("AiAgentFollowUpJobs", ["ticketId", "status"], { name: "ai_follow_ups_ticket" });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiAgentFollowUpJobs");
  }
};
