import { QueryInterface, DataTypes } from "sequelize";

/**
 * Conexion con Google Calendar.
 *
 * Una por empresa: se conecta una cuenta y todas las citas del CRM van a
 * su calendario. Dentro de ChatIA cada asesor sigue viendo solo las suyas,
 * pero eso lo decide el CRM al consultar; el calendario de Google es uno
 * solo y quien lo abra vera todo.
 *
 * Aqui NO hay contraseña de Google, y no puede haberla: OAuth existe
 * justamente para que una aplicacion de terceros nunca la vea. Lo que se
 * guarda es un permiso revocable, limitado al calendario, que el dueño
 * puede retirar desde su cuenta de Google sin tocar el CRM.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("GoogleCalendarIntegrations", {
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
      /** Cuenta conectada, solo para poder mostrarla en pantalla. */
      email: {
        type: DataTypes.STRING,
        allowNull: true
      },
      /**
       * Permiso de corta duracion. Caduca en una hora y se renueva solo
       * con el refreshToken, asi que no vale de nada por si mismo.
       */
      accessToken: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      /**
       * El que de verdad importa: permite pedir accesos nuevos sin volver
       * a molestar al usuario. Google solo lo entrega la PRIMERA vez que
       * se autoriza, de ahi que al conectar se pida consentimiento
       * explicito para recuperarlo si se reconecta.
       */
      refreshToken: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      /** Calendario destino. "primary" es el principal de la cuenta. */
      calendarId: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "primary"
      },
      /**
       * Marca que Google devuelve para pedir "solo lo que cambio desde la
       * ultima vez". Sin ella habria que releer el calendario entero en
       * cada pasada.
       */
      syncToken: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      lastSyncAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      active: {
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

    // Una conexion por empresa: dos cuentas a la vez no tendrian a cual
    // enviar las citas.
    await queryInterface.addIndex(
      "GoogleCalendarIntegrations",
      ["companyId"],
      { unique: true, name: "google_calendar_company_unique" }
    );

    // Identificador del evento en Google, para no duplicarlo en cada
    // sincronizacion y poder actualizarlo o borrarlo despues.
    await queryInterface.addColumn("Appointments", "googleEventId", {
      type: DataTypes.STRING,
      allowNull: true
    });

    // De donde nacio la cita. Decide quien manda cuando las dos versiones
    // no coinciden: lo que nacio en el CRM manda sobre su copia en Google,
    // y al reves.
    await queryInterface.addColumn("Appointments", "origin", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "crm"
    });

    await queryInterface.addIndex("Appointments", ["googleEventId"], {
      name: "appointments_google_event"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Appointments", "appointments_google_event");
    await queryInterface.removeColumn("Appointments", "origin");
    await queryInterface.removeColumn("Appointments", "googleEventId");
    await queryInterface.dropTable("GoogleCalendarIntegrations");
  }
};
