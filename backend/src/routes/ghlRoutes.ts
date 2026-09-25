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

// Las plantillas de WhatsApp ya no se anotan a mano: se leen de Meta en
// GET /whatsapp/:whatsappId/templates (ver ListTemplatesService).
// Para enviarlas en un ticket, cada una se asocia a un Workflow de GHL.
ghlRoutes.get("/ghl/custom-fields", isAuth, GhlController.customFields);
ghlRoutes.get("/ghl/template-workflows", isAuth, GhlController.templateWorkflows);
ghlRoutes.put("/ghl/template-workflows", isAuth, GhlController.updateTemplateWorkflows);
ghlRoutes.get("/ghl/sendable-templates", isAuth, GhlController.sendableTemplates);
ghlRoutes.post("/ghl/tickets/:ticketId/template", isAuth, GhlController.sendTemplate);

export default ghlRoutes;
