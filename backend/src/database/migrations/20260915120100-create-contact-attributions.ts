import { QueryInterface, DataTypes } from "sequelize";

/**
 * Atribucion de anuncios Click-to-WhatsApp por contacto.
 *
 * Tabla aparte y no columnas en Contacts: son siete campos que solo tienen
 * los contactos llegados por un anuncio, y Contacts ya es ancha y la leen
 * todos los canales.
 *
 * Una fila por contacto (contactId unico). Meta solo manda el `referral`
 * en el primer mensaje despues de pulsar un anuncio, asi que los mensajes
 * normales no la tocan; si el contacto vuelve a entrar por OTRO anuncio, se
 * actualiza con el clic nuevo (capturedAt), porque el ctwa_clid solo
 * atribuye durante 7 dias y el viejo ya no serviria. firstCapturedAt
 * conserva cuando llego por primera vez.
 *
 * wabaId se copia de la conexion por la que entro: Meta lo exige junto al
 * ctwa_clid y la conexion podria cambiar o borrarse despues.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("ContactAttributions", {
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
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      wabaId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      ctwaClid: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      sourceId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      sourceType: {
        type: DataTypes.STRING,
        allowNull: true
      },
      sourceUrl: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      headline: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      mediaType: {
        type: DataTypes.STRING,
        allowNull: true
      },
      firstCapturedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      capturedAt: {
        type: DataTypes.DATE,
        allowNull: false
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

    await queryInterface.addIndex("ContactAttributions", ["companyId"], {
      name: "contact_attributions_company"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("ContactAttributions");
  }
};
