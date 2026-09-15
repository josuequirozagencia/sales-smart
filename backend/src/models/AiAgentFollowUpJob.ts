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
 * Paso de seguimiento automatico programado para un ticket. Ver la migracion
 * 20260916120200 y AiAgentFollowUpService.
 */
@Table({ tableName: "AiAgentFollowUpJobs" })
class AiAgentFollowUpJob extends Model<AiAgentFollowUpJob> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  companyId: number;

  @Column
  agentId: number;

  @Column
  ticketId: number;

  /** 1..5, posicion en AiAgent.followUps */
  @Column
  step: number;

  @Column
  dueAt: Date;

  /** pending | sent | cancelled | failed */
  @Column
  status: string;

  @Column
  reason: string;

  @Column(DataType.TEXT)
  lastError: string;

  @Column
  sentAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentFollowUpJob;
