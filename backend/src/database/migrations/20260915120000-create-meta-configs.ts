import { QueryInterface, DataTypes } from "sequelize";

/**
 * Credenciales de Meta Conversions API, una fila por empresa.
 *
 * Ver docs/META_CONVERSIONS_API.md.
 *
 * - accessToken va cifrado con SecretBox, igual que los tokens de Google y
 *   de GHL. tokenLast4 permite decir en pantalla que token hay guardado sin
 *   descifrarlo ni devolverlo.
 * - status: unverified | ok | error. Con "error" (token o dataset
 *   rechazados por Meta) los eventos nuevos se guardan bloqueados y no se
 *   envian hasta que se corrijan las credenciales.
 * - testEventCode: codigo de "Probar eventos" del Administrador de eventos.
 *   Mientras este puesto, Meta muestra los eventos en esa pestana y no los
 *   cuenta para las campanas.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("MetaConfigs", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      datasetId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      accessToken: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      tokenLast4: {
        type: DataTypes.STRING(4),
        allowNull: true
      },
      testEventCode: {
        type: DataTypes.STRING,
        allowNull: true
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "unverified"
      },
      lastError: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      lastErrorAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      lastSuccessAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      verifiedAt: {
        type: DataTypes.DATE,
        allowNull: true
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
    await queryInterface.dropTable("MetaConfigs");
  }
};
