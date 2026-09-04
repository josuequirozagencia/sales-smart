import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  Default,
  AllowNull
} from "sequelize-typescript";
import Appointment from "./Appointment";
import Schedule from "./Schedule";

/**
 * Un aviso concreto de una cita.
 *
 * Guarda su antelacion ademas del mensaje programado: sin ella no habria
 * forma de mostrar en el formulario que un aviso es "una hora antes" ni de
 * rehacerlo si la cita cambia de hora.
 */
@Table
class AppointmentReminder extends Model<AppointmentReminder> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Appointment)
  @Column
  appointmentId: number;

  @BelongsTo(() => Appointment)
  appointment: Appointment;

  /** Nulo si no llego a programarse o si ya se borro. */
  @ForeignKey(() => Schedule)
  @Column
  scheduleId: number;

  @BelongsTo(() => Schedule)
  schedule: Schedule;

  @AllowNull(false)
  @Default(60)
  @Column
  minutesBefore: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AppointmentReminder;
