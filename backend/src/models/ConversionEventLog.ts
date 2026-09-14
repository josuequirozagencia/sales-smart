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
 * Un evento de conversion: su deduplicacion y su diagnostico.
 *
 * Ver la migracion 20260915120200, que documenta cada estado.
 */
@Table({ tableName: "ConversionEventLogs" })
class ConversionEventLog extends Model<ConversionEventLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  companyId: number;

  @Column
  eventId: string;

  /** Lead | Schedule | Purchase */
  @Column
  eventType: string;

  @Column
  contactId: number;

  /** contact | appointment | sale */
  @Column
  sourceType: string;

  @Column
  sourceId: number;

  @Column
  occurredAt: Date;

  /** pending | sent | skipped | blocked | failed | expired */
  @Column
  status: string;

  @Column
  route: string;

  @Column
  sentEventName: string;

  @Column
  attempts: number;

  @Column(DataType.TEXT)
  lastError: string;

  @Column
  fbtraceId: string;

  @Column
  sentAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ConversionEventLog;
