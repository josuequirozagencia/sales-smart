import express from "express";
import isAuth from "../middleware/isAuth";

import * as SessionSettingsController from "../controllers/SessionSettingsController";

// Cierre de sesion por inactividad (minutos), por empresa.
const sessionSettingsRoutes = express.Router();

sessionSettingsRoutes.get("/session-settings", isAuth, SessionSettingsController.show);
sessionSettingsRoutes.put("/session-settings", isAuth, SessionSettingsController.update);

export default sessionSettingsRoutes;
