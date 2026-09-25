import { QueryInterface, DataTypes } from "sequelize";

/**
 * Estado del agente IA en cada conversacion: activo o pausado.
 *
 * Es independiente de la asignacion (Tickets.userId / status): pausar o
 * activar la IA nunca cambia quien tiene el ticket. Ninguno de los campos que
 * ya existian sirve para esto: Tickets.isBot se pone a false con cada mensaje
 * entrante (FindOrCreateTicketService) y Tickets.useIntegration dispara la
 * cadena de Typebot y flujos.
 *
 * ticketTrakingId es la atencion en la que se fijo el estado. Al cerrarse el
 * ticket esa atencion termina; cuando el cliente vuelve a escribir se abre otra
 * y el estado guardado deja de valer: la nueva atencion empieza con la IA
 * activa. version sube con cada cambio y es lo que permite descartar una
 * respuesta de IA que se genero antes de una pausa.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiAgentTicketStates", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      ticketTrakingId: { type: DataTypes.INTEGER, allowNull: true },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      /** transfer | human_message | manual */
      reason: { type: DataTypes.STRING, allowNull: true },
      changedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    });

    await queryInterface.addIndex("AiAgentTicketStates", ["companyId"], { name: "ai_ticket_states_company" });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiAgentTicketStates");
  }
};
