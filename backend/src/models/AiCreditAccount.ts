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

/**
 * El saldo de credito IA de una empresa, en centavos enteros.
 *
 * Solo cuenta para los agentes que corren con la clave compartida de la
 * agencia. Un agente con su propia apiKey no pasa por aqui. Ver la
 * migracion 20260929120000 y AiCreditService.
 */
@Table({ tableName: "AiCreditAccounts" })
class AiCreditAccount extends Model<AiCreditAccount> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  /** Puede quedar negativo: lo ya consumido se paga, pero no se empieza mas. */
  @Column(DataType.INTEGER)
  balanceCents: number;

  /**
   * La fraccion de centavo aun no cobrada, en millonesimas de centavo.
   *
   * Una respuesta de gpt-4o cuesta unas 0,3 centesimas de centavo. Si cada
   * mensaje se redondeara a centavo entero, saldria a cero y todos los
   * modelos de texto serian gratis. Aqui se guarda el resto y se cobra un
   * centavo cuando se junta.
   */
  @Column(DataType.BIGINT)
  pendingMicroCents: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiCreditAccount;
