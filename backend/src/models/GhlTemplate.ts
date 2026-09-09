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
 * Plantilla de WhatsApp aprobada en Meta, anotada a mano.
 *
 * GoHighLevel no expone las plantillas por API. Esta tabla es un espejo de
 * lo que ya esta aprobado en el panel de GHL, para que el asesor pueda
 * elegirlas al responder sin salir de aqui. No valida nada contra Meta: si
 * el nombre no coincide con una plantilla real, el envio falla en GHL.
 */
@Table({ tableName: "GhlTemplates" })
class GhlTemplate extends Model<GhlTemplate> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  /** Nombre exacto con el que esta dada de alta en GHL. */
  @Column
  name: string;

  @Default("es")
  @Column
  language: string;

  @Column(DataType.TEXT)
  body: string;

  /** Lista de marcadores del cuerpo, en JSON. Ver la migracion. */
  @Column(DataType.TEXT)
  variables: string;

  @Default(true)
  @Column
  isActive: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default GhlTemplate;
