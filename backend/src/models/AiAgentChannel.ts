import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import AiAgent from "./AiAgent";
import Whatsapp from "./Whatsapp";

/**
 * Conexion atendida por un agente. whatsappId es unico: un canal, un agente.
 * Ver la migracion 20260916120100.
 */
@Table({ tableName: "AiAgentChannels" })
class AiAgentChannel extends Model<AiAgentChannel> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  companyId: number;

  @ForeignKey(() => AiAgent)
  @Column
  agentId: number;

  @BelongsTo(() => AiAgent)
  agent: AiAgent;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentChannel;
