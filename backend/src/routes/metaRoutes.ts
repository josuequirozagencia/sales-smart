import express from "express";
import isAuth from "../middleware/isAuth";

import * as MetaConfigController from "../controllers/MetaConfigController";

// Meta Conversions API: credenciales de la propia empresa. Ver
// docs/META_CONVERSIONS_API.md.
const metaRoutes = express.Router();

metaRoutes.get("/meta/config", isAuth, MetaConfigController.show);
metaRoutes.put("/meta/config", isAuth, MetaConfigController.update);

export default metaRoutes;
