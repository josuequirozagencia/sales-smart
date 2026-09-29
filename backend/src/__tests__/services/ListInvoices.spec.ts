import Company from "../../models/Company";
import Invoices from "../../models/Invoices";
import ListInvoicesServices from "../../services/InvoicesService/ListInvoicesServices";
import { closeConnection, uniqueSuffix } from "../helpers/db";

// El listado de facturas trataba la falta de companyId como "sin filtro", asi
// que quien llamara sin empresa se llevaba las facturas de todas. La ruta
// /invoices/list ni pedia token, asi que era alcanzable sin sesion.
//
// La ruta ya esta protegida, pero el arreglo tiene que estar tambien aqui:
// falta de inquilino no puede significar todos los inquilinos.

const sufijo = uniqueSuffix();

let empresaA: Company;
let empresaB: Company;
let facturaA: Invoices;
let facturaB: Invoices;

const crearFactura = async (companyId: number, detalle: string) =>
  Invoices.create({
    companyId,
    detail: detalle,
    dueDate: "2026-10-25T00:00:00-05:00",
    status: "open",
    value: 15,
    users: 2,
    connections: 3,
    queues: 5
  } as any);

beforeAll(async () => {
  empresaA = await Company.create({
    name: `facturas-a-${sufijo}`,
    planId: 1,
    status: true
  } as any);

  empresaB = await Company.create({
    name: `facturas-b-${sufijo}`,
    planId: 1,
    status: true
  } as any);

  facturaA = await crearFactura(empresaA.id, `plan-a-${sufijo}`);
  facturaB = await crearFactura(empresaB.id, `plan-b-${sufijo}`);
});

afterAll(async () => {
  await Invoices.destroy({ where: { companyId: [empresaA.id, empresaB.id] } });
  await Company.destroy({ where: { id: [empresaA.id, empresaB.id] } });
  await closeConnection();
});

describe("ListInvoicesServices", () => {
  it("sin empresa no devuelve nada: falla", async () => {
    await expect(
      ListInvoicesServices({ companyId: undefined as any })
    ).rejects.toMatchObject({ message: "ERR_NO_COMPANY_ID" });
  });

  it("tampoco con empresa 0, cadena vacia o nula", async () => {
    for (const valor of [0, "", null]) {
      await expect(
        ListInvoicesServices({ companyId: valor as any })
      ).rejects.toMatchObject({ message: "ERR_NO_COMPANY_ID" });
    }
  });

  it("devuelve las facturas de la empresa que pregunta", async () => {
    const { invoices } = await ListInvoicesServices({
      companyId: empresaA.id
    });

    expect(invoices.map(f => f.id)).toContain(facturaA.id);
  });

  it("y ninguna de otra empresa", async () => {
    const { invoices, count } = await ListInvoicesServices({
      companyId: empresaA.id
    });

    expect(invoices.map(f => f.id)).not.toContain(facturaB.id);
    expect(invoices.every(f => f.companyId === empresaA.id)).toBe(true);
    expect(count).toBe(1);
  });

  it("el buscador sigue funcionando, dentro de la empresa", async () => {
    const dentro = await ListInvoicesServices({
      companyId: empresaA.id,
      searchParam: `plan-a-${sufijo}`
    });
    const fuera = await ListInvoicesServices({
      companyId: empresaA.id,
      searchParam: `plan-b-${sufijo}`
    });

    expect(dentro.invoices.map(f => f.id)).toEqual([facturaA.id]);
    // Busca la factura de la otra empresa por su nombre exacto: no aparece.
    expect(fuera.invoices).toEqual([]);
  });
});
