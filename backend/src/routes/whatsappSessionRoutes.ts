import { Router } from "express";
import isAuth from "../middleware/isAuth";
import canManageConnections from "../middleware/canManageConnections";

import WhatsAppSessionController from "../controllers/WhatsAppSessionController";

const whatsappSessionRoutes = Router();

// Iniciar sesion, pedir QR y desconectar: pedir un QR nuevo permite emparejar
// otro telefono con la conexion de la empresa. Solo quien gestiona conexiones.
whatsappSessionRoutes.post(
  "/whatsappsession/:whatsappId",
  isAuth,
  canManageConnections,
  WhatsAppSessionController.store
);

whatsappSessionRoutes.put(
  "/whatsappsession/:whatsappId",
  isAuth,
  canManageConnections,
  WhatsAppSessionController.update
);

whatsappSessionRoutes.delete(
  "/whatsappsession/:whatsappId",
  isAuth,
  canManageConnections,
  WhatsAppSessionController.remove
);

export default whatsappSessionRoutes;
