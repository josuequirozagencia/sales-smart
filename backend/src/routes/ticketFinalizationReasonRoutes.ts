import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as TicketFinalizationReasonController from "../controllers/TicketFinalizationReasonController";

const ticketFinalizationReasonRoutes = Router();

/**
 * `isAuth` va en cada ruta, NO en el router entero.
 *
 * Antes habia un `ticketFinalizationReasonRoutes.use(isAuth)` sin ruta.
 * Un `use` sin ruta se aplica a TODA peticion que atraviese el router, y
 * este se monta en la raiz (`routes.use(ticketFinalizationReasonRoutes)`),
 * asi que autenticaba tambien las peticiones que solo pasaban de largo
 * camino de otro router registrado mas abajo.
 *
 * Dos consecuencias, las dos observadas:
 *
 *   - El servidor respondia 401 ERR_SESSION_EXPIRED a rutas que NO
 *     existen, en vez de 404. Un 401 dejaba de ser prueba de que una ruta
 *     existiera, y eso ya despisto al diagnosticar la recuperacion de
 *     contrasena.
 *   - Cualquier endpoint publico registrado despues quedaba inservible.
 *     El webhook de GoHighLevel devolvia 401 sin llegar a ejecutarse.
 *
 * Las cuatro rutas de este fichero siguen exigiendo autenticacion
 * exactamente igual que antes; lo que cambia es que deja de exigirsela a
 * peticiones que no son suyas.
 */
ticketFinalizationReasonRoutes.get(
  "/ticketFinalizationReasons",
  isAuth,
  TicketFinalizationReasonController.index
);

ticketFinalizationReasonRoutes.post(
  "/ticketFinalizationReasons",
  isAuth,
  TicketFinalizationReasonController.store
);

ticketFinalizationReasonRoutes.put(
  "/ticketFinalizationReasons/:id",
  isAuth,
  TicketFinalizationReasonController.update
);

ticketFinalizationReasonRoutes.delete(
  "/ticketFinalizationReasons/:id",
  isAuth,
  TicketFinalizationReasonController.remove
);

export default ticketFinalizationReasonRoutes;
