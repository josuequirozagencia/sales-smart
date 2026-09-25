import {
  Table,
  Column,
  CreatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";

import Company from "./Company";
import User from "./User";

/**
 * Una linea del registro de auditoria del acceso. Ver la migracion
 * 20260906120000 para el porque de la tabla.
 *
 * Sin updatedAt: una linea de auditoria no se modifica nunca. Dejar la
 * columna invitaria a editarla, que es lo contrario de lo que se busca.
 */
@Table({ tableName: "AuthAuditLogs", updatedAt: false })
class AuthAuditLog extends Model<AuthAuditLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  event: string;

  @ForeignKey(() => Company)
  @AllowNull
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => User)
  @AllowNull
  @Column
  userId: number;

  @BelongsTo(() => User, "userId")
  user: User;

  /** Quien tomo la decision, cuando no es el propio afectado. */
  @ForeignKey(() => User)
  @AllowNull
  @Column
  actorUserId: number;

  @BelongsTo(() => User, "actorUserId")
  actor: User;

  @AllowNull
  @Column
  email: string;

  @AllowNull
  @Column(DataType.TEXT)
  detail: string;

  @AllowNull
  @Column
  ip: string;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;
}

export default AuthAuditLog;
