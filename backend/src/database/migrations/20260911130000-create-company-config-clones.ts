import { QueryInterface, DataTypes } from "sequelize";

/**
 * Registro de cada clonado de configuracion entre empresas.
 *
 * Sirve para dos cosas:
 *
 *   - Impedir que el mismo par origen -> destino se clone dos veces. El
 *     clonado es aditivo, asi que repetirlo duplicaria colas, chatbot y
 *     mensajes rapidos en la empresa destino. El indice unico lo garantiza
 *     tambien si dos superadministradores lo lanzan a la vez: el segundo
 *     falla al insertar y su transaccion entera se deshace.
 *   - Dejar constancia de quien copio que, cuando y con que resultado.
 *
 * Borrar cualquiera de las dos empresas borra sus registros: sin la empresa
 * no hay nada que proteger de un segundo clonado.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("CompanyConfigClones", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      sourceCompanyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      targetCompanyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      // Quien lo lanzo. SET NULL: el registro sobrevive al usuario.
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      // El resumen que se devolvio al terminar, en JSON.
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
      "CompanyConfigClones",
      ["sourceCompanyId", "targetCompanyId"],
      { name: "company_config_clones_par", unique: true }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("CompanyConfigClones");
  }
};
