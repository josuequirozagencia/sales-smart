import express from "express";
import isAuth from "../middleware/isAuth";

import * as GoogleCalendarController from "../controllers/GoogleCalendarController";

const googleCalendarRoutes = express.Router();

googleCalendarRoutes.get(
  "/google/status",
  isAuth,
  GoogleCalendarController.status
);

googleCalendarRoutes.get(
  "/google/auth-url",
  isAuth,
  GoogleCalendarController.authUrl
);

// Sin isAuth a proposito: aqui llega el navegador redirigido por Google,
// que no manda la cabecera de sesion del CRM. La empresa se identifica por
// el parametro `state` que se envio al iniciar la autorizacion.
googleCalendarRoutes.get(
  "/google/callback",
  GoogleCalendarController.callback
);

googleCalendarRoutes.delete(
  "/google/disconnect",
  isAuth,
  GoogleCalendarController.remove
);

export default googleCalendarRoutes;
