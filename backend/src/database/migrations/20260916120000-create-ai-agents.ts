import { QueryInterface, DataTypes } from "sequelize";

/**
 * Agentes IA reutilizables, por empresa. Ver docs/AGENTES_IA.md.
 *
 * - apiKey y voiceKey van cifradas con SecretBox, como el token de Meta; los
 *   *Last4 permiten decir en pantalla que clave hay sin descifrarla.
 * - provider: openai | gemini | openrouter.
 * - maxCharacters: corte posterior sobre la respuesta ya generada, no un
 *   parametro que se le pida al modelo.
 * - schedule: { mode: "24/7" } o { mode: "custom", days: [{ day, enabled,
 *   start, end }] }. Fuera de horario el agente no responde.
 * - followUps: hasta 5 pasos { when: { amount, unit }, mode: ia|manual,
 *   content }. La ejecucion vive en AiAgentFollowUpJobs.
 * - transferQueueId: fila a la que va el ticket al transferir a un humano.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiAgents", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      name: { type: DataTypes.STRING, allowNull: false },
      provider: { type: DataTypes.STRING, allowNull: false },
      model: { type: DataTypes.STRING, allowNull: false },
      apiKey: { type: DataTypes.TEXT, allowNull: true },
      apiKeyLast4: { type: DataTypes.STRING(4), allowNull: true },
      systemPrompt: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      temperature: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.7 },
      maxTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1000 },
      maxCharacters: { type: DataTypes.INTEGER, allowNull: true },
      maxMessages: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
      voice: { type: DataTypes.STRING, allowNull: false, defaultValue: "texto" },
      voiceKey: { type: DataTypes.TEXT, allowNull: true },
      voiceKeyLast4: { type: DataTypes.STRING(4), allowNull: true },
      voiceRegion: { type: DataTypes.STRING, allowNull: true },
      escuchaAudio: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      leeImagenes: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      dividirRespuestas: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      cantidadBloques: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2 },
      knowledgeText: { type: DataTypes.TEXT, allowNull: true },
      knowledgeFileName: { type: DataTypes.STRING, allowNull: true },
      schedule: { type: DataTypes.JSONB, allowNull: false, defaultValue: { mode: "24/7" } },
      followUps: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      transferQueueId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Queues", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      disponibleEnFlujos: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    });

    await queryInterface.addIndex("AiAgents", ["companyId"], { name: "ai_agents_company" });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiAgents");
  }
};
