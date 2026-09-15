import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement
} from "sequelize-typescript";

/**
 * Agente IA activo o pausado en una conversacion. Independiente de la
 * asignacion del ticket. Ver la migracion 20260916120300 y EstadoIaTicket.
 */
@Table({ tableName: "AiAgentTicketStates" })
class AiAgentTicketState extends Model<AiAgentTicketState> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  companyId: number;

  @Column
  ticketId: number;

  /** Atencion en la que se fijo el estado; en otra atencion ya no vale. */
  @Column
  ticketTrakingId: number;

  @Column
  enabled: boolean;

  /** transfer | human_message | manual */
  @Column
  reason: string;

  @Column
  changedByUserId: number;

  @Column
  version: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentTicketState;
