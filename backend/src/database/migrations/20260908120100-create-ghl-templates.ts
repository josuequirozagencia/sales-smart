import { QueryInterface, DataTypes } from "sequelize";

/**
 * Plantillas de WhatsApp registradas a mano.
 *
 * GoHighLevel NO expone las plantillas aprobadas por Meta a traves de su
 * API, asi que no hay forma de leerlas: se anotan a mano y esta tabla es
 * el espejo de lo que ya esta aprobado en el panel de GHL. Si alguien
 * escribe aqui una plantilla que Meta no aprobo, el envio fallara del lado
 * de GHL; esta tabla no valida nada, solo recuerda.
 *
 * `variables` guarda la lista de marcadores del cuerpo en JSON —un texto,
 * como el resto de campos JSON del proyecto (ver Integrations.jsonContent)—
 * para no depender del soporte de jsonb del motor.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("GhlTemplates", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      // El nombre exacto con el que la plantilla esta dada de alta en GHL.
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      language: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "es"
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      variables: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // La pantalla del asesor lista las plantillas de su empresa.
    await queryInterface.addIndex("GhlTemplates", ["companyId"], {
      name: "ghl_templates_company"
    });

    // Dos plantillas con el mismo nombre y el mismo idioma en una empresa
    // serian la misma plantilla anotada dos veces. Meta las identifica por
    // ese par, asi que aqui se respeta lo mismo.
    await queryInterface.addIndex("GhlTemplates", ["companyId", "name", "language"], {
      name: "ghl_templates_unicas",
      unique: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("GhlTemplates");
  }
};
