import AuthUserService from "../../services/UserServices/AuthUserService";
import User from "../../models/User";
import { closeConnection, getSeededCompany, uniqueSuffix } from "../helpers/db";

jest.mock("../../libs/socket", () => ({ getIO: () => ({ of: () => ({ emit: () => undefined }) }) }));

// Horario de atencion en el login.
//
// La comprobacion corre ANTES de validar la contrasena, asi que un horario mal
// puesto deja fuera a la cuenta sin que nadie pueda arreglarlo desde dentro.
// Por eso el superadministrador no pasa por ella: es la cuenta con la que se
// desbloquea todo lo demas.

const COMPANY_ID = 1;
const CLAVE = "clave-de-prueba-123";
const creados: number[] = [];

/** Ventana de dos horas que empieza dentro de una hora: seguro fuera de ahora. */
const fueraDeHorario = (): { startWork: string; endWork: string } => {
  const hhmm = (fecha: Date) =>
    `${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;
  const ahora = new Date();
  // Cerca de medianoche, una ventana futura daria la vuelta al dia y volveria
  // a incluir la hora actual; en ese caso se mira hacia atras.
  if (ahora.getHours() >= 21) {
    return { startWork: "00:00", endWork: hhmm(new Date(ahora.getTime() - 2 * 60 * 60 * 1000)) };
  }
  return {
    startWork: hhmm(new Date(ahora.getTime() + 60 * 60 * 1000)),
    endWork: hhmm(new Date(ahora.getTime() + 3 * 60 * 60 * 1000))
  };
};

const crearUsuario = async (esSuper: boolean): Promise<User> => {
  const horario = fueraDeHorario();
  const user = await User.create({
    name: `login-${esSuper ? "super" : "normal"}`,
    email: `login-${uniqueSuffix()}@horario.local`,
    password: CLAVE,
    companyId: COMPANY_ID,
    profile: "admin",
    super: esSuper,
    ...horario
  } as any);
  creados.push(user.id);
  return user;
};

beforeAll(async () => {
  await getSeededCompany();
});

afterAll(async () => {
  await User.destroy({ where: { id: creados } });
  await closeConnection();
});

describe("Login fuera del horario de atencion", () => {
  it("al superadministrador no se le aplica el horario", async () => {
    const user = await crearUsuario(true);
    const { serializedUser, token } = await AuthUserService({ email: user.email, password: CLAVE });
    expect(serializedUser.id).toBe(user.id);
    expect(token).toBeTruthy();
  });

  it("a un usuario normal si: fuera de su horario no entra", async () => {
    const user = await crearUsuario(false);
    await expect(AuthUserService({ email: user.email, password: CLAVE })).rejects.toMatchObject({
      message: "ERR_OUT_OF_HOURS"
    });
  });

  it("el superadministrador sigue necesitando su contrasena", async () => {
    const user = await crearUsuario(true);
    await expect(AuthUserService({ email: user.email, password: "otra-clave" })).rejects.toMatchObject({
      message: "ERR_INVALID_CREDENTIALS"
    });
  });
});
