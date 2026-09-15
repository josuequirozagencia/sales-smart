import whatsappRoutes from "../../routes/whatsappRoutes";
import whatsappSessionRoutes from "../../routes/whatsappSessionRoutes";
import isAuth from "../../middleware/isAuth";
import isSuper from "../../middleware/isSuper";
import canManageConnections from "../../middleware/canManageConnections";

// Que middleware protege cada ruta de conexiones.
//
// Antes todas llevaban solo isAuth: cualquier usuario podia crear, editar,
// borrar, reiniciar o pedir un QR, y leer las conexiones de TODAS las
// empresas en /whatsapp/all y /whatsapp-admin/:id. Esconder el token al
// leer no sirve si un usuario puede escribir uno elegido por el.
//
// Sin servidor ni base: se inspecciona el router con los controladores
// sustituidos (arrastran Baileys y Redis al importarse).

jest.mock("../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../controllers/WhatsAppController", () =>
  new Proxy({}, { get: (_objetivo, clave) => (clave === "__esModule" ? true : jest.fn()) })
);
jest.mock("../../controllers/WhatsAppSessionController", () => ({
  __esModule: true,
  default: { store: jest.fn(), update: jest.fn(), remove: jest.fn() }
}));
jest.mock("../../services/WhatsappService/uploadMediaAttachment", () => ({
  mediaUpload: jest.fn(),
  deleteMedia: jest.fn()
}));

const middlewaresDe = (router: any, metodo: string, ruta: string): any[] => {
  const capa = router.stack.find(
    (l: any) => l.route && l.route.path === ruta && l.route.methods[metodo]
  );
  if (!capa) throw new Error(`No existe ${metodo.toUpperCase()} ${ruta}`);
  return capa.route.stack.map((l: any) => l.handle);
};

describe("rutas de conexiones", () => {
  it.each([
    ["post", "/whatsapp/"],
    ["post", "/facebook/"],
    ["put", "/whatsapp/:whatsappId"],
    ["delete", "/whatsapp/:whatsappId"],
    ["post", "/closedimported/:whatsappId"],
    ["post", "/whatsapp-restart/"],
    ["post", "/whatsapp/:whatsappId/media-upload"],
    ["delete", "/whatsapp/:whatsappId/media-upload"],
    ["get", "/whatsapp/sync-templates/:whatsappId"]
  ])("%s %s exige gestionar conexiones", (metodo, ruta) => {
    const cadena = middlewaresDe(whatsappRoutes, metodo, ruta);
    expect(cadena[0]).toBe(isAuth);
    expect(cadena).toContain(canManageConnections);
  });

  it.each([
    ["get", "/whatsapp/all"],
    ["get", "/whatsapp-admin/:whatsappId"],
    ["put", "/whatsapp-admin/:whatsappId"],
    ["delete", "/whatsapp-admin/:whatsappId"]
  ])("%s %s (todas las empresas) exige super", (metodo, ruta) => {
    const cadena = middlewaresDe(whatsappRoutes, metodo, ruta);
    expect(cadena[0]).toBe(isAuth);
    expect(cadena).toContain(isSuper);
  });

  it.each([
    ["get", "/whatsapp/"],
    ["get", "/whatsapp/filter"],
    ["get", "/whatsapp/:whatsappId"]
  ])("%s %s sigue abierta a cualquier usuario autenticado", (metodo, ruta) => {
    // Nuevo ticket, filtros y botones del ticket leen estas rutas; lo que
    // devuelven ya va sin credenciales (ver WhatsappSecretos.spec.ts).
    const cadena = middlewaresDe(whatsappRoutes, metodo, ruta);
    expect(cadena[0]).toBe(isAuth);
    expect(cadena).not.toContain(canManageConnections);
  });

  it.each([["post"], ["put"], ["delete"]])(
    "%s /whatsappsession/:whatsappId (conectar, pedir QR, desconectar) exige gestionar conexiones",
    metodo => {
      const cadena = middlewaresDe(whatsappSessionRoutes, metodo, "/whatsappsession/:whatsappId");
      expect(cadena[0]).toBe(isAuth);
      expect(cadena).toContain(canManageConnections);
    }
  );
});
