import { QueryInterface, DataTypes } from "sequelize";

/**
 * Credenciales de Meta opcionales en la configuracion de GoHighLevel.
 *
 * GHL no deja leer las plantillas de WhatsApp por su API, pero la cuenta de
 * WhatsApp Business que hay detras sigue siendo de Meta. Con el ID de esa
 * cuenta (WABA) y un token de Meta se leen las plantillas reales directamente
 * del Graph API. El token va cifrado con SecretBox; de el solo se muestran los
 * 4 ultimos caracteres.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("GhlConfigs", "metaBusinessId", {
      type: DataTypes.STRING,
      allowNull: true
    });
    await queryInterface.addColumn("GhlConfigs", "metaAccessToken", {
      type: DataTypes.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn("GhlConfigs", "metaAccessTokenLast4", {
      type: DataTypes.STRING(4),
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("GhlConfigs", "metaAccessTokenLast4");
    await queryInterface.removeColumn("GhlConfigs", "metaAccessToken");
    await queryInterface.removeColumn("GhlConfigs", "metaBusinessId");
  }
};
