import invoiceRoutes from "../../routes/invoicesRoutes";
import isAuth from "../../middleware/isAuth";

// GET /invoices/list no llevaba isAuth.
//
// El controlador saca la empresa de req.user, asi que sin sesion llegaba
// undefined, y el servicio trataba esa ausencia como "sin filtro": la ruta
// devolvia las facturas de TODAS las empresas. Comprobado contra produccion
// antes de arreglarlo: HTTP 200 sin token, con facturas de dos empresas
// distintas y sus importes, vencimientos, planes y limites contratados.
//
// Sin servidor ni base: se inspecciona el router con los controladores
// sustituidos.

// isAuth arrastra libs/socket, y con el Baileys, que al importarse fuera de
// un navegador revienta con globalThis.crypto.subtle.
jest.mock("../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock(
  "../../controllers/InvoicesController",
  () =>
    new Proxy(
      {},
      { get: (_objetivo, clave) => (clave === "__esModule" ? true : jest.fn()) }
    )
);
jest.mock(
  "../../controllers/QueueOptionController",
  () =>
    new Proxy(
      {},
      { get: (_objetivo, clave) => (clave === "__esModule" ? true : jest.fn()) }
    )
);

const middlewaresDe = (router: any, metodo: string, ruta: string): any[] => {
  const capa = router.stack.find(
    (l: any) => l.route && l.route.path === ruta && l.route.methods[metodo]
  );
  if (!capa) throw new Error(`No existe ${metodo.toUpperCase()} ${ruta}`);
  return capa.route.stack.map((l: any) => l.handle);
};

describe("rutas de facturas", () => {
  it.each([
    ["get", "/invoices"],
    ["get", "/invoices/list"],
    ["get", "/invoices/all"],
    ["get", "/invoices/:Invoiceid"],
    ["put", "/invoices/:id"]
  ])("%s %s exige sesion", (metodo, ruta) => {
    expect(middlewaresDe(invoiceRoutes, metodo, ruta)).toContain(isAuth);
  });

  it("ninguna ruta de facturas se queda sin isAuth", () => {
    // Esta es la que de verdad vigila: si manana se anade una ruta y se
    // olvida el middleware, aparece aqui en vez de en produccion.
    const sinSesion = (invoiceRoutes as any).stack
      .filter((capa: any) => capa.route)
      .filter(
        (capa: any) =>
          !capa.route.stack.some((paso: any) => paso.handle === isAuth)
      )
      .map(
        (capa: any) =>
          `${Object.keys(capa.route.methods)[0].toUpperCase()} ${capa.route.path}`
      );

    expect(sinSesion).toEqual([]);
  });
});
