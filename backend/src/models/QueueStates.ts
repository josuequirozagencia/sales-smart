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
  DataType
} from "sequelize-typescript";
import Queue from "./Queue";

@Table
class QueueState extends Model<QueueState> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @Column
  lastUserIndex: number;

  // Créditos acumulados do round-robin ponderado, indexados por id de usuário.
  // Convive com lastUserIndex, que segue servindo a rotação simples.
  @Column(DataType.JSONB)
  weightState: Record<string, number>;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => Queue)
  queue: Queue;
}

export default QueueState;