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
  Default
} from "sequelize-typescript";
import Company from "./Company";

/**
 * Credenciales de GoHighLevel de una empresa.
 *
 * Tabla propia y no `Integrations`: esa no tiene las columnas que hacen
 * falta y su modelo ni siquiera esta registrado en Sequelize. El motivo
 * completo esta en la migracion 20260908120200.
 */
@Table({ tableName: "GhlConfigs" })
class GhlConfig extends Model<GhlConfig> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  /** Private Integration Token, cifrado con SecretBox. */
  @Column(DataType.TEXT)
  token: string;

  @Column
  locationId: string;

  @Column
  webhookSecret: string;

  /** Flujos anotados a mano, en JSON. */
  @Column(DataType.TEXT)
  workflows: string;

  @Default(false)
  @Column
  isActive: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default GhlConfig;
