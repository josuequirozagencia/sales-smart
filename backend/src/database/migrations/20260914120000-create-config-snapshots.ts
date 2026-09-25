import { QueryInterface, DataTypes } from "sequelize";

/**
 * Instantaneas de configuracion y sus cargas.
 *
 * ConfigSnapshots guarda una captura CONGELADA de la configuracion de una
 * empresa (el paquete del motor de ConfigPackageService, ya sin secretos) y
 * sus archivos viven en backend/snapshots/snapshot{id}/. Sobrevive a la
 * empresa de la que salio: sourceCompanyId pasa a null y se conserva su
 * nombre en sourceCompanyName.
 *
 * ConfigSnapshotApplications recuerda que modulos de cada instantanea se
 * cargaron ya en cada empresa y con que ids quedaron, para que una carga
 * posterior por partes encuentre lo que cargo la anterior y un modulo no se
 * cargue dos veces. Borrar la instantanea o la empresa borra sus registros;
 * lo que se cargo se queda en la empresa.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("ConfigSnapshots", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      sourceCompanyId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      sourceCompanyName: {
        type: DataTypes.STRING,
        allowNull: true
      },
      // Modulos que lleva, ya con sus dependencias.
      modules: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      // El paquete capturado: filas saneadas, archivos, omitidos y avisos.
      payload: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      // Filas por tipo, para mostrar sin leer el paquete entero.
      counts: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      // Archivos que ya faltaban en la empresa al capturar.
      missingFiles: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
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

    await queryInterface.addIndex("ConfigSnapshots", ["name"], {
      name: "config_snapshots_name",
      unique: true
    });

    await queryInterface.createTable("ConfigSnapshotApplications", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      snapshotId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ConfigSnapshots", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      // Quien hizo la ultima carga. SET NULL: el registro sobrevive al usuario.
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      // Modulos ya cargados en esta empresa, sumando todas las cargas.
      modules: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      // id viejo -> id nuevo por tipo, para las cargas siguientes.
      idMaps: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      // Resumen de la ultima carga, en JSON.
      summary: {
        type: DataTypes.TEXT,
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

    await queryInterface.addIndex(
      "ConfigSnapshotApplications",
      ["snapshotId", "companyId"],
      { name: "config_snapshot_applications_par", unique: true }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("ConfigSnapshotApplications");
    await queryInterface.dropTable("ConfigSnapshots");
  }
};
