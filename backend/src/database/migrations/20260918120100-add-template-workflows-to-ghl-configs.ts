import { QueryInterface, DataTypes } from "sequelize";

/**
 * Plantilla de WhatsApp -> Workflow de GHL.
 *
 * GHL no documenta como enviar una plantilla aprobada por su API de mensajes;
 * la via documentada es un Workflow con la accion "Send WhatsApp". Aqui se
 * guarda, por plantilla (nombre + idioma), que Workflow la envia y en que
 * campos personalizados del contacto van sus variables. JSON en texto, como
 * los flujos anotados de la misma tabla.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("GhlConfigs", "templateWorkflows", {
      type: DataTypes.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("GhlConfigs", "templateWorkflows");
  }
};
