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
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import AiAgent from "./AiAgent";
import User from "./User";

export type TipoMovimiento =
  | "grant_admin"
  | "consumption"
  | "purchase"
  | "adjustment";

/**
 * Cada movimiento del saldo, uno por fila. Nunca se edita ni se borra una
 * fila existente: es el registro contable de lo que se cobro y por que.
 *
 * messageId no tiene clave ajena a proposito. Si manana se borra el mensaje,
 * el cobro que se hizo por el sigue siendo cierto, y su identificador tiene
 * que seguir aqui para que un reintento no lo cobre dos veces.
 */
@Table({ tableName: "AiCreditLedger" })
class AiCreditLedger extends Model<AiCreditLedger> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.STRING)
  type: TipoMovimiento;

  /** Negativo al gastar, positivo al recargar. */
  @Column(DataType.INTEGER)
  amountCents: number;

  @Column(DataType.INTEGER)
  balanceAfterCents: number;

  @Column(DataType.TEXT)
  description: string;

  @ForeignKey(() => AiAgent)
  @Column
  aiAgentId: number;

  @BelongsTo(() => AiAgent)
  aiAgent: AiAgent;

  @Column(DataType.INTEGER)
  messageId: number;

  @ForeignKey(() => User)
  @Column
  createdByUserId: number;

  @BelongsTo(() => User)
  createdBy: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiCreditLedger;
