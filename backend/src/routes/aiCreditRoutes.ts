import express from "express";
import isAuth from "../middleware/isAuth";
import * as AiCreditController from "../controllers/AiCreditController";

/**
 * Credito IA. Todas piden sesion; las de administracion comprueban ademas
 * que quien pregunta sea superadministrador, dentro del propio controlador.
 */
const aiCreditRoutes = express.Router();

// Panel de superadmin.
aiCreditRoutes.get("/ai-credits/settings", isAuth, AiCreditController.verAjustes);
aiCreditRoutes.put("/ai-credits/settings", isAuth, AiCreditController.guardarAjustes);
aiCreditRoutes.get("/ai-credits/pricing", isAuth, AiCreditController.listarPrecios);
aiCreditRoutes.put("/ai-credits/pricing/:id", isAuth, AiCreditController.guardarPrecio);
aiCreditRoutes.get("/ai-credits/companies", isAuth, AiCreditController.listarEmpresas);
aiCreditRoutes.post("/ai-credits/companies/:companyId/grant", isAuth, AiCreditController.otorgar);
aiCreditRoutes.get("/ai-credits/companies/:companyId/ledger", isAuth, AiCreditController.verHistorial);

// La propia empresa: su saldo y su intencion de recargar.
aiCreditRoutes.get("/ai-credits/balance", isAuth, AiCreditController.miSaldo);
aiCreditRoutes.get("/ai-credits/my-ledger", isAuth, AiCreditController.miHistorial);
aiCreditRoutes.post("/ai-credits/purchase-intent", isAuth, AiCreditController.intencionDeCompra);

export default aiCreditRoutes;
