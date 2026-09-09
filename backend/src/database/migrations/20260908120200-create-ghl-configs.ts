import { QueryInterface, DataTypes } from "sequelize";

/**
 * Credenciales de GoHighLevel por empresa.
 *
 * Se penso reutilizar `Integrations`, la tabla generica que parecia servir
 * para esto. No sirve, y conviene dejarlo escrito:
 *
 *   - Sus columnas REALES son id, companyId, name, isActive, token,
 *     foneContact, userLogin, passLogin, finalCurrentMonth,
 *     initialCurrentMonth. No tiene `type` ni `jsonContent`; esos estan en
 *     `QueueIntegrations`, que es otra tabla y otro proposito.
 *   - El modelo `models/Integrations.ts` declara columnas que la tabla no
 *     tiene (projectName, jsonContent, urlN8N, language) y ademas nunca se
 *     anadio a la instancia de Sequelize, asi que cualquier consulta suya
 *     falla con "Model not initialized".
 *
 * Arreglar eso es una limpieza aparte, con impacto en ChekIntegrations y
 * UpdateIntegrationService. Una tabla propia y pequena no toca nada de lo
 * que ya funciona.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("GhlConfigs", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      // Una location por empresa. Es lo que hace falta hoy: la convivencia
      // con Meta directo ya funciona porque son dos filas distintas de
      // Whatsapp, no dos configuraciones aqui.
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      // Private Integration Token, CIFRADO. Nunca en claro.
      token: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      locationId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      // Ultimo tramo de la URL del webhook. Es lo unico que protege un
      // endpoint publico, pero no es un secreto de terceros: se muestra en
      // la pantalla porque hay que copiarlo dentro de la URL en GHL.
      webhookSecret: {
        type: DataTypes.STRING,
        allowNull: true
      },
      // Flujos anotados a mano, para cuando el API no se puede leer.
      workflows: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
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
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("GhlConfigs");
  }
};
