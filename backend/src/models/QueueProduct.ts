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
  DataType,
  AllowNull
} from "sequelize-typescript";
import Queue from "./Queue";
import Company from "./Company";

/**
 * Producto o servicio que se puede vender desde una cola.
 *
 * Cuelga de la cola y no de la empresa porque cada cola atiende un negocio
 * distinto. El formulario de venta ofrece los de la cola del ticket, de
 * modo que el asesor solo ve lo que le corresponde vender.
 */
@Table
class QueueProduct extends Model<QueueProduct> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(false)
  @Column
  name: string;

  @Column
  description: string;

  /**
   * Precio sugerido. El formulario lo propone pero permite cambiarlo: se
   * negocian descuentos y no tiene sentido crear un producto por precio.
   */
  @Column(DataType.FLOAT)
  price: number;

  @Default(true)
  @Column
  active: boolean;

  /** Orden en el desplegable, para no depender del alfabeto. */
  @Default(0)
  @Column
  order: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default QueueProduct;
