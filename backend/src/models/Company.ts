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
  DataType,
  HasMany,
  Default
} from "sequelize-typescript";
import Contact from "./Contact";
import Message from "./Message";

import Plan from "./Plan";
import Queue from "./Queue";
import Setting from "./Setting";
import Ticket from "./Ticket";
import TicketTraking from "./TicketTraking";
import User from "./User";
import UserRating from "./UserRating";
import Whatsapp from "./Whatsapp";
import CompaniesSettings from "./CompaniesSettings";
import BirthdaySettings from "./BirthdaySettings";
import Invoices from "./Invoices";

@Table
class Company extends Model<Company> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column
  phone: string;

  @Column
  email: string;

  @Column({ defaultValue: "" })
  document: string;

  @Column({ defaultValue: "" })
  paymentMethod: string;

  @Column
  lastLogin: Date;

  /** Activa o desactivada. NO es el ciclo de aprobacion: eso es
   *  approvalStatus. Son dos cosas distintas y ya habia codigo leyendo
   *  esta como booleano. */
  @Column
  status: boolean;

  /**
   * Ciclo de la solicitud: pending | approved | rejected | suspended.
   * Las empresas anteriores a esto quedaron en "approved".
   */
  @Default("approved")
  @Column
  approvalStatus: string;

  @Column
  approvedByUserId: number;

  @Column
  approvalAt: Date;

  @Column(DataType.TEXT)
  rejectionReason: string;

  @Column
  dueDate: string;

  @Column
  recurrence: string;

  // Prueba gratuita y suscripcion, separadas de dueDate.
  //
  // dueDate queda SOLO como fecha de cobro. El fin de prueba vive en
  // trialEndsAt, y el momento de contratar en subscribedAt: darse de alta
  // no es contratar, y antes ambas cosas compartian columna.
  //
  // Las cinco son nulas en las empresas anteriores a este cambio, y ese
  // NULL significa "regimen anterior", nunca "prueba vencida".

  @Column
  trialStartAt: Date;

  @Column
  trialEndsAt: Date;

  @Column
  subscribedAt: Date;

  /** trial | pending_payment | active | expired, o nulo. */
  @Column
  subscriptionStatus: string;

  /**
   * El dia de cobro PRETENDIDO, que no siempre es el de la ultima factura.
   *
   * Una suscripcion del 31 cobra el 28 en febrero; sin guardar el 31 se
   * quedaria en 28 para siempre en vez de volver a su dia en marzo.
   */
  @Column
  billingDayOfMonth: number;

  @Column({
    type: DataType.JSONB
  })
  schedules: [];

  @ForeignKey(() => Plan)
  @Column
  planId: number;

  @BelongsTo(() => Plan)
  plan: Plan;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @Column
  folderSize: string;

  @Default(true)
  @Column
  generateInvoice: boolean;

  @Default("BRL")
  @Column
  currency: string;

  @Column
  numberFileFolder: string;

  @Column
  updatedAtFolder: string;

  @HasMany(() => User, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  users: User[];

  @HasMany(() => UserRating, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  userRatings: UserRating[];

  @HasMany(() => Queue, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  queues: Queue[];

  @HasMany(() => Whatsapp, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  whatsapps: Whatsapp[];

  @HasMany(() => Message, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  messages: Message[];

  @HasMany(() => Contact, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  contacts: Contact[];

  @HasMany(() => Setting, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  settings: Setting[];

  @HasMany (() => CompaniesSettings, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  companieSettings: CompaniesSettings;

  // Faltaba, y BirthdaySettings solo declaraba su lado. Las asociaciones de
  // Sequelize son direccionales, asi que el job de cumpleanos —que pide la
  // empresa incluyendo sus ajustes— reventaba cada 15 minutos con
  // "BirthdaySettings is not associated to Company!".
  @HasMany(() => BirthdaySettings, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  birthdaySettings: BirthdaySettings[];

  @HasMany(() => Ticket, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  tickets: Ticket[];

  @HasMany(() => TicketTraking, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  ticketTrankins: TicketTraking[];

  @HasMany(() => Invoices, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  invoices: Invoices[];

}

export default Company;
