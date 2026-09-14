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
 * Instantanea de configuracion: una captura congelada de la configuracion de
 * una empresa, para cargarla despues en otras.
 *
 * Ver la migracion 20260914120000 y docs/INSTANTANEAS.md. Sin asociaciones:
 * la empresa de origen puede no existir ya, y su nombre se guarda aparte.
 */
@Table({ tableName: "ConfigSnapshots" })
class ConfigSnapshot extends Model<ConfigSnapshot> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column(DataType.TEXT)
  description: string;

  @Column
  sourceCompanyId: number;

  @Column
  sourceCompanyName: string;

  /** Modulos que lleva, ya con sus dependencias. */
  @Column(DataType.JSONB)
  modules: string[];

  /** Paquete del motor de ConfigPackageService. Pesado: no se lista. */
  @Column(DataType.JSONB)
  payload: any;

  @Column(DataType.JSONB)
  counts: Record<string, number>;

  @Column(DataType.JSONB)
  missingFiles: string[];

  @Column
  createdByUserId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ConfigSnapshot;
