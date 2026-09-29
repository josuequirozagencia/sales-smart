import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType
} from "sequelize-typescript";

/**
 * Ajustes del credito IA. Una sola fila para toda la instalacion.
 *
 * sharedOpenAiApiKey va cifrada con SecretBox, igual que AiAgent.apiKey, y
 * nunca sale del backend: la pantalla solo recibe los ultimos 4 caracteres
 * para poder decir "ya hay una configurada".
 */
@Table({ tableName: "AiCreditSettings" })
class AiCreditSettings extends Model<AiCreditSettings> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.TEXT)
  sharedOpenAiApiKey: string;

  @Column(DataType.STRING)
  sharedOpenAiApiKeyLast4: string;

  /** Porcentaje que se suma al costo real antes de descontarlo. */
  @Column(DataType.DECIMAL(6, 2))
  defaultMarginPercent: string;

  /** Recarga minima, para que la comision de la pasarela no se la coma. */
  @Column(DataType.INTEGER)
  minPurchaseCents: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiCreditSettings;
