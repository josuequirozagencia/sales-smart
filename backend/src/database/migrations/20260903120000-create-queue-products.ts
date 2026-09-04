import { QueryInterface, DataTypes } from "sequelize";

/**
 * Catalogo de productos y servicios, colgado de la cola.
 *
 * Va por cola y no por empresa porque cada cola atiende un negocio
 * distinto: la de una academia vende carreras y la de un taller vende
 * reparaciones. El formulario de venta ofrece los productos de la cola del
 * ticket, asi que el asesor solo ve lo que puede vender.
 */
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface
      .createTable("QueueProducts", {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true
        },
        queueId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Queues", key: "id" },
          onUpdate: "CASCADE",
          // Si se borra la cola desaparece su catalogo. Las ventas ya
          // hechas no se pierden: guardan el nombre del producto copiado.
          onDelete: "CASCADE"
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false
        },
        description: {
          type: DataTypes.STRING,
          allowNull: true
        },
        // Precio sugerido. El formulario lo propone pero deja cambiarlo:
        // se negocian descuentos y no queremos que eso obligue a crear un
        // producto por cada precio.
        price: {
          type: DataTypes.FLOAT,
          allowNull: true
        },
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        // Orden de aparicion en el desplegable, para que lo mas vendido
        // quede arriba sin depender del alfabeto.
        order: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
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
      })
      .then(() =>
        // Dos productos con el mismo nombre en la misma cola serian
        // indistinguibles en el desplegable.
        queryInterface.addIndex("QueueProducts", ["queueId", "name"], {
          unique: true,
          name: "queue_products_queue_name_unique"
        })
      )
      .then(() =>
        queryInterface.addIndex("QueueProducts", ["queueId", "active", "order"], {
          name: "queue_products_listing"
        })
      );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("QueueProducts");
  }
};
