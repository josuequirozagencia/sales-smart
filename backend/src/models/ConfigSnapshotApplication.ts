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
 * Lo que se ha cargado de una instantanea en una empresa.
 *
 * Una fila por par (snapshotId, companyId), unica. Acumula los modulos
 * cargados y los mapas de ids de todas las cargas: ver
 * ApplyConfigSnapshotService.
 */
@Table({ tableName: "ConfigSnapshotApplications" })
class ConfigSnapshotApplication extends Model<ConfigSnapshotApplication> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  snapshotId: number;

  @Column
  companyId: number;

  @Column
  userId: number;

  @Column(DataType.JSONB)
  modules: string[];

  @Column(DataType.JSONB)
  idMaps: Record<string, Record<string, number>>;

  /** Resumen de la ultima carga, en JSON. */
  @Column(DataType.TEXT)
  summary: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ConfigSnapshotApplication;
