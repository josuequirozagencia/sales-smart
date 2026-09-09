import express from "express";
import isAuth from "../middleware/isAuth";

import * as GhlController from "../controllers/GhlController";
import * as GhlWebhookController from "../controllers/GhlWebhookController";

const ghlRoutes = express.Router();

/**
 * Entrada de GoHighLevel. PUBLICA a proposito: GHL no puede presentar el
 * JWT de la aplicacion. La barrera es el secreto del ultimo tramo de la
 * URL, que se genera al configurar el canal. Va ANTES de las rutas con
 * isAuth para que quede claro que es la unica sin autenticar.
 */
ghlRoutes.post("/ghl/webhook/:companyId/:secret", GhlWebhookController.receive);

// --- Configuracion del canal ---
ghlRoutes.get("/ghl/config", isAuth, GhlController.show);
ghlRoutes.put("/ghl/config", isAuth, GhlController.update);

// --- Flujos ---
ghlRoutes.get("/ghl/workflows", isAuth, GhlController.workflows);
ghlRoutes.post("/ghl/enroll", isAuth, GhlController.enroll);

// --- Plantillas anotadas a mano ---
ghlRoutes.get("/ghl/templates", isAuth, GhlController.listTemplates);
ghlRoutes.post("/ghl/templates", isAuth, GhlController.storeTemplate);
ghlRoutes.put("/ghl/templates/:templateId", isAuth, GhlController.updateTemplate);
ghlRoutes.delete("/ghl/templates/:templateId", isAuth, GhlController.removeTemplate);

export default ghlRoutes;
