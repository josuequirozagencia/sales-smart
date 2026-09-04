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
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";
import Ticket from "./Ticket";
import Queue from "./Queue";
import User from "./User";
import QueueProduct from "./QueueProduct";

/**
 * Una venta registrada.
 *
 * Es la unica fuente de "cuanto vendimos". Los campos valorVenda y
 * finalizadoComVenda del ticket se siguen escribiendo por compatibilidad
 * con lo que ya los lee, pero quien manda es esta tabla.
 */
@Table
class Sale extends Model<Sale> {
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

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  /** Quien la registro. */
  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => QueueProduct)
  @Column
  productId: number;

  @BelongsTo(() => QueueProduct)
  product: QueueProduct;

  /**
   * Copia del nombre del producto al vender.
   *
   * Sin ella, borrar o renombrar un producto dejaria el historico sin poder
   * decir que se vendio entonces.
   */
  @Column
  productName: string;

  @Default(0)
  @Column(DataType.FLOAT)
  total: number;

  /** Lo ya cobrado. */
  @Default(0)
  @Column(DataType.FLOAT)
  deposit: number;

  @Column
  paymentMethod: string;

  @Column(DataType.TEXT)
  notes: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  /**
   * Lo que falta por cobrar.
   *
   * Se calcula y no se guarda: una columna aparte podria quedar
   * desincronizada con total y deposit, y entonces habria dos respuestas
   * distintas a la misma pregunta. Nunca es negativo, para que un abono
   * mayor que el total no reste del pendiente global.
   */
  get pending(): number {
    const total = Number(this.getDataValue("total")) || 0;
    const deposit = Number(this.getDataValue("deposit")) || 0;
    return Math.max(0, total - deposit);
  }
}

export default Sale;
