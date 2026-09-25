import express from "express";
import isAuth from "../middleware/isAuth";

import * as QueueProductController from "../controllers/QueueProductController";

const queueProductRoutes = express.Router();

// El catalogo cuelga de la cola, y las rutas lo reflejan.
queueProductRoutes.get(
  "/queues/:queueId/products",
  isAuth,
  QueueProductController.index
);

queueProductRoutes.post(
  "/queues/:queueId/products",
  isAuth,
  QueueProductController.store
);

// Para editar y borrar basta el id del producto: el servicio comprueba que
// sea de la empresa de quien pide.
queueProductRoutes.put(
  "/queue-products/:productId",
  isAuth,
  QueueProductController.update
);

queueProductRoutes.delete(
  "/queue-products/:productId",
  isAuth,
  QueueProductController.remove
);

export default queueProductRoutes;
