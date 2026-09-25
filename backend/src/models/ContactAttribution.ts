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
 * Anuncio Click-to-WhatsApp por el que llego un contacto.
 *
 * Ver la migracion 20260915120100 y ContactAttributionService.
 */
@Table({ tableName: "ContactAttributions" })
class ContactAttribution extends Model<ContactAttribution> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  companyId: number;

  @Column
  contactId: number;

  @Column
  whatsappId: number;

  @Column
  wabaId: string;

  @Column(DataType.TEXT)
  ctwaClid: string;

  @Column
  sourceId: string;

  @Column
  sourceType: string;

  @Column(DataType.TEXT)
  sourceUrl: string;

  @Column(DataType.TEXT)
  headline: string;

  @Column
  mediaType: string;

  @Column
  firstCapturedAt: Date;

  /** Momento del clic vigente: de el cuentan los 7 dias de atribucion. */
  @Column
  capturedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ContactAttribution;
