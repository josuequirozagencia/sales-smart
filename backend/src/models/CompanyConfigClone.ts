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
 * Un clonado de configuracion de una empresa a otra.
 *
 * El par (sourceCompanyId, targetCompanyId) es unico: ver la migracion
 * 20260911130000 y CloneCompanyConfigService. Las claves foraneas estan en
 * la base; aqui no se declaran asociaciones porque las dos columnas
 * apuntan a Company y no hace falta navegar desde este modelo.
 */
@Table({ tableName: "CompanyConfigClones" })
class CompanyConfigClone extends Model<CompanyConfigClone> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  sourceCompanyId: number;

  @Column
  targetCompanyId: number;

  @Column
  userId: number;

  /** Resumen devuelto al terminar, en JSON. */
  @Column(DataType.TEXT)
  summary: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CompanyConfigClone;
