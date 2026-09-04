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
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";

/**
 * Permiso de acceso al Google Calendar de la empresa.
 *
 * No guarda ninguna contraseña de Google: OAuth existe para que una
 * aplicacion de terceros nunca la vea. Lo que hay aqui es un permiso
 * revocable y limitado al calendario.
 */
@Table
class GoogleCalendarIntegration extends Model<GoogleCalendarIntegration> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  /** Cuenta conectada, solo para mostrarla en pantalla. */
  @Column
  email: string;

  @Column(DataType.TEXT)
  accessToken: string;

  /** Google solo lo entrega la primera vez que se autoriza. */
  @Column(DataType.TEXT)
  refreshToken: string;

  @Column
  expiresAt: Date;

  @Default("primary")
  @Column
  calendarId: string;

  /** Marca para pedir a Google solo lo que cambio desde la ultima pasada. */
  @Column(DataType.TEXT)
  syncToken: string;

  @Column
  lastSyncAt: Date;

  @Default(true)
  @Column
  active: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default GoogleCalendarIntegration;
