// Importar los servicios arrastra el socket y, con el, Baileys, que en el
// entorno de pruebas revienta por falta de globalThis.crypto.subtle. Nada de
// eso interviene en las reglas que se prueban aqui.
jest.mock("../../libs/socket", () => ({
  getIO: () => ({ of: () => ({ emit: () => undefined }) })
}));
jest.mock("../../helpers/UpdateDeletedUserOpenTicketsStatus", () => ({
  __esModule: true,
  default: jest.fn()
}));

import Company from "../../models/Company";
import User from "../../models/User";
import DeleteUserService from "../../services/UserServices/DeleteUserService";
import DeleteCompanyService from "../../services/CompanyService/DeleteCompanyService";
import UpdateUserService from "../../services/UserServices/UpdateUserService";
import { closeConnection, uniqueSuffix } from "../helpers/db";

// Las guardas que faltaban el 22 sep 2026, cuando en produccion se borro la
// unica cuenta super y su empresa. No quedo ninguna via de vuelta: el panel
// dejo de existir, el correo de recuperacion no esta configurado y los seeds
// solo corren con la base vacia. Hubo que entrar a la base por SSH.
//
// Lo que se prueba aqui es, sobre todo, lo que el sistema tiene que NEGARSE
// a hacer.
//
// Las negativas se comprueban con toMatchObject y no con toThrow: AppError
// es una clase suelta que NO extiende Error, asi que toThrow no la reconoce
// y da el falso "no lanzo nada".

let empresa: Company;
let otraEmpresa: Company;
let supersPrevios: number;

const crearEmpresa = async (etiqueta: string) =>
  Company.create({
    name: `${etiqueta}-${uniqueSuffix()}`,
    planId: 1,
    status: true
  } as any);

const crearUsuario = async (
  companyId: number,
  esSuper: boolean,
  profile = "admin"
) =>
  User.create({
    name: `u-${uniqueSuffix()}`,
    email: `u-${uniqueSuffix()}@prueba.local`,
    passwordHash: "x",
    profile,
    companyId,
    super: esSuper
  } as any);

beforeAll(async () => {
  empresa = await crearEmpresa("guardas");
  otraEmpresa = await crearEmpresa("guardas-otra");
  // La base de pruebas trae su propio super sembrado; las reglas cuentan
  // sobre el total, asi que hay que saber de cuantos se parte.
  supersPrevios = await User.count({ where: { super: true } });
});

afterAll(async () => {
  await User.destroy({ where: { companyId: [empresa.id, otraEmpresa.id] } });
  await Company.destroy({ where: { id: [empresa.id, otraEmpresa.id] } });
  await closeConnection();
});

describe("borrar usuarios", () => {
  it("borra un super mientras quede otro", async () => {
    // Se crean los dos aqui en vez de contar con el super sembrado: si otra
    // prueba lo deja tocado, esta no tiene por que enterarse.
    const relevo = await crearUsuario(empresa.id, true);
    const unSuper = await crearUsuario(empresa.id, true);

    await DeleteUserService(unSuper.id, empresa.id);

    expect(await User.findByPk(unSuper.id)).toBeNull();
    expect(await User.findByPk(relevo.id)).not.toBeNull();
  });

  it("se niega a borrar el ultimo super de la instalacion", async () => {
    // Se dejan fuera de juego los supers que ya existian, para que el que
    // creamos sea de verdad el ultimo.
    const previos = await User.findAll({ where: { super: true } });
    await User.update({ super: false } as any, {
      where: { id: previos.map(p => p.id) }
    });

    const ultimo = await crearUsuario(empresa.id, true);

    // Pase lo que pase con la comprobacion, los supers ajenos vuelven a su
    // sitio: si una prueba deja la base sin ninguno, las demas empiezan a
    // fallar por un motivo que no es el suyo.
    const restaurar = async () => {
      await User.update({ super: true } as any, {
        where: { id: previos.map(p => p.id) }
      });
      await ultimo.destroy();
    };

    try {

      await expect(
        DeleteUserService(ultimo.id, empresa.id)
      ).rejects.toMatchObject({ message: "ERR_LAST_SUPER_USER" });
      expect(await User.findByPk(ultimo.id)).not.toBeNull();
    } finally {
      await restaurar();
    }
  });

  it("no estorba al borrar a un usuario normal", async () => {
    const normal = await crearUsuario(empresa.id, false, "user");

    await DeleteUserService(normal.id, empresa.id);

    expect(await User.findByPk(normal.id)).toBeNull();
  });
});

describe("borrar empresas", () => {
  it("se niega a borrar la empresa de quien lo pide", async () => {
    await expect(
      DeleteCompanyService(String(empresa.id), empresa.id)
    ).rejects.toMatchObject({ message: "ERR_CANNOT_DELETE_OWN_COMPANY" });

    expect(await Company.findByPk(empresa.id)).not.toBeNull();
  });

  it("se niega a borrar una empresa que tiene un super dentro", async () => {
    // Borrarla dejaria a ese super sin empresa, y un usuario huerfano no
    // puede iniciar sesion: el login busca su empresa y no la encuentra.
    const dentro = await crearUsuario(otraEmpresa.id, true);

    await expect(
      DeleteCompanyService(String(otraEmpresa.id), empresa.id)
    ).rejects.toMatchObject({ message: "ERR_COMPANY_HAS_SUPER_USER" });

    await dentro.destroy();
  });

  it("borra una empresa ajena y sin supers", async () => {
    const desechable = await crearEmpresa("guardas-desechable");
    await crearUsuario(desechable.id, false, "user");

    await DeleteCompanyService(String(desechable.id), empresa.id);

    expect(await Company.findByPk(desechable.id)).toBeNull();
  });
});

describe("otorgar y quitar el super", () => {
  it("un super puede nombrar a otro", async () => {
    const jefe = await crearUsuario(empresa.id, true);
    const candidato = await crearUsuario(empresa.id, false);

    await UpdateUserService({
      userData: { super: true, companyId: empresa.id } as any,
      userId: candidato.id,
      companyId: empresa.id,
      requestUserId: jefe.id
    });

    await candidato.reload();
    expect(candidato.super).toBe(true);
  });

  it("un admin no puede ascenderse a si mismo", async () => {
    // Sin esta regla, cualquier admin de cualquier empresa se daria acceso a
    // las empresas de todos los demas clientes.
    const admin = await crearUsuario(empresa.id, false);

    await expect(
      UpdateUserService({
        userData: { super: true, companyId: empresa.id } as any,
        userId: admin.id,
        companyId: empresa.id,
        requestUserId: admin.id
      })
    ).rejects.toMatchObject({ message: "ERR_NO_PERMISSION" });

    await admin.reload();
    expect(admin.super).toBe(false);
  });

  it("nadie se quita el super a si mismo", async () => {
    const jefe = await crearUsuario(empresa.id, true);

    await expect(
      UpdateUserService({
        userData: { super: false, companyId: empresa.id } as any,
        userId: jefe.id,
        companyId: empresa.id,
        requestUserId: jefe.id
      })
    ).rejects.toMatchObject({ message: "ERR_CANNOT_REMOVE_OWN_SUPER" });

    await jefe.reload();
    expect(jefe.super).toBe(true);
  });

  it("deja el resto del usuario igual cuando no se toca el super", async () => {
    const jefe = await crearUsuario(empresa.id, true);
    const otro = await crearUsuario(empresa.id, true);

    await UpdateUserService({
      userData: { name: "Nombre nuevo", companyId: empresa.id } as any,
      userId: otro.id,
      companyId: empresa.id,
      requestUserId: jefe.id
    });

    await otro.reload();
    expect(otro.name).toBe("Nombre nuevo");
    expect(otro.super).toBe(true);
  });
});
