import { QueryInterface, DataTypes } from "sequelize";

/**
 * Recordatorios de una cita.
 *
 * Antes la cita guardaba UN scheduleId, asi que solo admitia un aviso. Con
 * tabla hija admite varios —el formulario ofrece hasta tres— y cada uno
 * recuerda su antelacion, que es lo que permite mostrarlos y rehacerlos.
 *
 * La migracion traslada los avisos que ya existieran y despues retira la
 * columna, para no dejar dos sitios donde mirar lo mismo.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AppointmentReminders", {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      appointmentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Appointments", key: "id" },
        onUpdate: "CASCADE",
        // Si la cita desaparece, sus avisos no tienen sentido.
        onDelete: "CASCADE"
      },
      // El mensaje programado que lo envia. Nulo si nunca llego a
      // programarse —por caer en el pasado— o si ya se borro.
      scheduleId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Schedules", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      minutesBefore: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 60
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

    await queryInterface.addIndex("AppointmentReminders", ["appointmentId"], {
      name: "appointment_reminders_appointment"
    });

    // Traslado de lo que ya hubiera. La antelacion original no se guardaba
    // en ninguna parte, asi que se deduce restando la hora de envio a la de
    // la cita, que es exactamente como se calculo al crearla.
    await queryInterface.sequelize.query(`
      insert into "AppointmentReminders"
        ("appointmentId", "scheduleId", "minutesBefore", "createdAt", "updatedAt")
      select a.id,
             a."scheduleId",
             greatest(0, round(extract(epoch from (a."scheduledAt" - s."sendAt")) / 60))::int,
             now(),
             now()
      from "Appointments" a
      join "Schedules" s on s.id = a."scheduleId"
      where a."scheduleId" is not null
    `);

    await queryInterface.removeColumn("Appointments", "scheduleId");
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Appointments", "scheduleId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Schedules", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    // Se devuelve el primero de cada cita: la columna solo admitia uno.
    await queryInterface.sequelize.query(`
      update "Appointments" a
      set "scheduleId" = r."scheduleId"
      from (
        select distinct on ("appointmentId") "appointmentId", "scheduleId"
        from "AppointmentReminders"
        order by "appointmentId", id
      ) r
      where r."appointmentId" = a.id
    `);

    await queryInterface.dropTable("AppointmentReminders");
  }
};
