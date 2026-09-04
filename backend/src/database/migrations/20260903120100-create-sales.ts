import { QueryInterface, DataTypes } from "sequelize";

/**
 * Ventas registradas.
 *
 * Hasta ahora la venta vivia como tres campos sueltos en el ticket
 * —valorVenda, motivoNaoVenda, finalizadoComVenda— que se escribian al
 * cerrarlo. Eso solo admite una venta por ticket, sin producto y sin forma
 * de pago, y no deja registrar nada hasta que la conversacion termina.
 *
 * Con tabla propia un contacto puede comprar varias veces, cada venta
 * guarda que se vendio y como se pago, y se registra en cualquier momento.
 * Pasa a ser la unica fuente de "cuanto vendimos": el modal de cierre que
 * ya existia escribira aqui.
 */
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface
      .createTable("Sales", {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true
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
          references: { model: "Contacts", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        // De que conversacion salio. Nulo si el ticket se borra: la venta
        // ocurrio igual y su importe debe seguir contando.
        ticketId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Tickets", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        queueId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Queues", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        // Quien la registro.
        userId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        productId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "QueueProducts", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        // Copia del nombre del producto en el momento de vender.
        //
        // Sin esto, borrar un producto del catalogo dejaria las ventas
        // antiguas sin poder decir que se vendio. Ademas, si manana se
        // renombra "Carrera de Belleza" a otra cosa, el historico debe
        // seguir diciendo lo que se vendio entonces.
        productName: {
          type: DataTypes.STRING,
          allowNull: true
        },
        total: {
          type: DataTypes.FLOAT,
          allowNull: false,
          defaultValue: 0
        },
        // Lo ya cobrado. Lo pendiente NO se guarda: se calcula como
        // total - abono, y asi no puede quedar desincronizado.
        deposit: {
          type: DataTypes.FLOAT,
          allowNull: false,
          defaultValue: 0
        },
        // Texto libre y no una tabla de metodos: el catalogo de formas de
        // pago cambia poco y no se gana nada obligando a mantenerlo.
        paymentMethod: {
          type: DataTypes.STRING,
          allowNull: true
        },
        notes: {
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
      })
      .then(() =>
        // La pantalla de Ventas lista por empresa y fecha.
        queryInterface.addIndex("Sales", ["companyId", "createdAt"], {
          name: "sales_company_created"
        })
      )
      .then(() =>
        queryInterface.addIndex("Sales", ["contactId"], {
          name: "sales_contact"
        })
      );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("Sales");
  }
};
