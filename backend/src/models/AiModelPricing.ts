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

/** La unidad que se cobra: un token de entrada, uno de salida, o un minuto. */
export type UnidadPrecio = "tokens_input" | "tokens_output" | "audio_minute";

/**
 * Cuanto cuesta de verdad cada modelo, al precio del proveedor y SIN margen.
 *
 * El margen se aplica al cobrar, no se guarda sumado aqui: asi se puede
 * cambiar el margen sin reescribir la tabla, y siempre se sabe cuanto costo
 * de verdad frente a cuanto se cobro.
 *
 * pricePerUnitCents lleva ocho decimales porque tiene que llevarlos: un
 * token de entrada de gpt-4o-mini cuesta 0,000015 centavos. Redondeado a
 * centavo entero seria cero, y el sistema entero dejaria de cobrar.
 */
@Table({ tableName: "AiModelPricing" })
class AiModelPricing extends Model<AiModelPricing> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.STRING)
  provider: string;

  @Column(DataType.STRING)
  model: string;

  @Column(DataType.STRING)
  unit: UnidadPrecio;

  @Column(DataType.DECIMAL(16, 8))
  pricePerUnitCents: string;

  /** Si esta, manda sobre el margen global de AiCreditSettings. */
  @Column(DataType.DECIMAL(6, 2))
  marginPercentOverride: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiModelPricing;
