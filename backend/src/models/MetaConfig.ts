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
 * Credenciales de Meta Conversions API de una empresa.
 *
 * Ver la migracion 20260915120000 y MetaConfigService. accessToken va
 * cifrado y nunca sale por la API: se lee solo al enviar un evento.
 */
@Table({ tableName: "MetaConfigs" })
class MetaConfig extends Model<MetaConfig> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  companyId: number;

  @Column
  datasetId: string;

  /** Cifrado con SecretBox. */
  @Column(DataType.TEXT)
  accessToken: string;

  @Column
  tokenLast4: string;

  @Column
  testEventCode: string;

  @Column
  isActive: boolean;

  /** unverified | ok | error */
  @Column
  status: string;

  @Column(DataType.TEXT)
  lastError: string;

  @Column
  lastErrorAt: Date;

  @Column
  lastSuccessAt: Date;

  @Column
  verifiedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MetaConfig;
