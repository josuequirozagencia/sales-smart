import express from "express";
import isAuth from "../middleware/isAuth";

import * as ConfigSnapshotController from "../controllers/ConfigSnapshotController";

// Instantaneas de configuracion. Los permisos (superadministrador o admin
// de la propia empresa) los comprueba el controlador.
const configSnapshotRoutes = express.Router();

configSnapshotRoutes.get("/config-snapshots", isAuth, ConfigSnapshotController.index);
configSnapshotRoutes.post("/config-snapshots", isAuth, ConfigSnapshotController.store);
configSnapshotRoutes.get("/config-snapshots/:id/applied", isAuth, ConfigSnapshotController.applied);
configSnapshotRoutes.post("/config-snapshots/:id/apply", isAuth, ConfigSnapshotController.apply);
configSnapshotRoutes.delete("/config-snapshots/:id", isAuth, ConfigSnapshotController.remove);

export default configSnapshotRoutes;
