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
  HasMany,
  Default
} from "sequelize-typescript";
import Company from "./Company";
import Tag from "./Tag";

/**
 * Embudo del tablero Kanban.
 *
 * Hasta ahora una empresa tenia un solo tablero: todas sus etiquetas con
 * kanban = 1 eran columnas del mismo. El embudo agrupa esas etiquetas, asi que
 * una empresa puede tener varios tableros (ventas, soporte, cobranza...) sin
 * cambiar como funcionan las etiquetas ni el arrastre de tarjetas.
 */
@Table({ tableName: "KanbanPipelines" })
class KanbanPipeline extends Model<KanbanPipeline> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Default(0)
  @Column
  order: number;

  // El embudo al que van a parar las etapas de un embudo borrado.
  @Default(false)
  @Column
  isDefault: boolean;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => Tag)
  tags: Tag[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default KanbanPipeline;
