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
  AllowNull,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";
import Ticket from "./Ticket";
import User from "./User";
import Schedule from "./Schedule";

/**
 * Cita o seguimiento agendado con un contacto.
 *
 * No se reutiliza Schedule porque es otra cosa: Schedule es un mensaje
 * programado —texto y hora de envio— y una cita es un compromiso que
 * existe aunque no se mande nada, y que se cumple o se cancela.
 *
 * Al agendar se crea ademas un Schedule con el recordatorio, y se guarda
 * aqui cual es para poder anularlo si la cita se cancela.
 */
@Table
class Appointment extends Model<Appointment> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  /** Quien la agendo. */
  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @AllowNull(false)
  @Column
  scheduledAt: Date;

  @Column
  title: string;

  @Column(DataType.TEXT)
  notes: string;

  /** pending | done | cancelled */
  @Default("pending")
  @Column
  status: string;

  /** Recordatorio programado al crearla, si se pidio. */
  @ForeignKey(() => Schedule)
  @Column
  scheduleId: number;

  @BelongsTo(() => Schedule)
  schedule: Schedule;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Appointment;
