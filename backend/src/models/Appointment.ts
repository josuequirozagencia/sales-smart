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
  HasMany,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";
import Ticket from "./Ticket";
import User from "./User";
import AppointmentReminder from "./AppointmentReminder";

/**
 * Cita o seguimiento agendado con un contacto.
 *
 * No se reutiliza Schedule porque es otra cosa: Schedule es un mensaje
 * programado —texto y hora de envio— y una cita es un compromiso que
 * existe aunque no se mande nada, y que se cumple o se cancela.
 *
 * Al agendar se crean ademas los recordatorios pedidos —hasta tres—, cada
 * uno con su mensaje programado, y se conservan en AppointmentReminders
 * para poder anularlos si la cita se cancela.
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

  /**
   * Opcional: los eventos traidos de Google pueden no tener contacto.
   * Crear una cita desde ChatIA si lo exige, y eso se comprueba en
   * AppointmentServices/CreateService.
   */
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

  /** Identificador del evento en Google, si esta sincronizado. */
  @Column
  googleEventId: string;

  /**
   * De donde nacio: "crm" o "google".
   *
   * Decide quien manda cuando las dos versiones no coinciden. Lo que nacio
   * aqui manda sobre su copia en Google, y al reves, de modo que cada
   * evento tiene un dueño claro y nunca se pisan.
   */
  @Default("crm")
  @Column
  origin: string;

  // Los avisos viven en tabla aparte: una cita puede tener hasta tres.
  @HasMany(() => AppointmentReminder, { onDelete: "CASCADE", hooks: true })
  reminders: AppointmentReminder[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Appointment;
