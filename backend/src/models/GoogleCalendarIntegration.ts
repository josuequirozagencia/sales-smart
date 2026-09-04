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
import { encrypt, decrypt } from "../helpers/SecretBox";

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

  // Los dos tokens se guardan CIFRADOS.
  //
  // El cifrado vive en el lector y el escritor de la columna, no en quien
  // los usa: asi cualquier codigo que lea integracion.accessToken recibe
  // el valor en claro sin saber nada de esto, y no puede olvidarse de
  // descifrar. Y al asignarlo se cifra siempre, sin excepcion posible.
  @Column({
    type: DataType.TEXT,
    get(this: GoogleCalendarIntegration) {
      return decrypt(this.getDataValue("accessToken"));
    },
    set(this: GoogleCalendarIntegration, valor: string) {
      this.setDataValue("accessToken", encrypt(valor));
    }
  })
  accessToken: string;

  /**
   * Google solo lo entrega la primera vez que se autoriza, asi que es el
   * secreto de verdad: con el se piden accesos nuevos indefinidamente.
   */
  @Column({
    type: DataType.TEXT,
    get(this: GoogleCalendarIntegration) {
      return decrypt(this.getDataValue("refreshToken"));
    },
    set(this: GoogleCalendarIntegration, valor: string) {
      this.setDataValue("refreshToken", encrypt(valor));
    }
  })
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
