import { QueryInterface, DataTypes } from "sequelize";

/**
 * Citas y seguimientos agendados.
 *
 * Hace falta tabla propia porque Schedule, que ya existe, no es esto: son
 * mensajes programados —body, sendAt, sentAt— para enviar texto a una hora.
 * Una cita es un compromiso con el contacto, existe aunque no se le mande
 * nada, y hay que poder marcarla cumplida o cancelada.
 *
 * Las dos cosas se relacionan: al agendar se crea ademas un Schedule con el
 * recordatorio, y aqui se guarda cual es para poder cancelarlo si la cita
 * se anula.
 */
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface
      .createTable("Appointments", {
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
        ticketId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Tickets", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        // Quien la agendo.
        userId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        // Cuando. Es timestamptz como el resto del proyecto, asi que el
        // instante es absoluto y no depende de la zona del servidor.
        scheduledAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        title: {
          type: DataTypes.STRING,
          allowNull: true
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        // pending | done | cancelled
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "pending"
        },
        // El recordatorio que se programo al crearla, para poder anularlo
        // si la cita se cancela. Nulo si no se pidio recordatorio.
        scheduleId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Schedules", key: "id" },
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
      })
      .then(() =>
        // La agenda se consulta por empresa y fecha, y casi siempre solo
        // las pendientes.
        queryInterface.addIndex(
          "Appointments",
          ["companyId", "status", "scheduledAt"],
          { name: "appointments_company_status_date" }
        )
      )
      .then(() =>
        queryInterface.addIndex("Appointments", ["contactId"], {
          name: "appointments_contact"
        })
      );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("Appointments");
  }
};
