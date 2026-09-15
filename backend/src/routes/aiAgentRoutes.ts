import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";

import * as AiAgentController from "../controllers/AiAgentController";

// Agentes IA. Ver docs/AGENTES_IA.md.
const aiAgentRoutes = express.Router();

// El documento de conocimiento solo se lee para extraer su texto: va en
// memoria, no a disco, y con tope de 10 MB.
const subidaDocumento = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

aiAgentRoutes.get("/ai-agents", isAuth, AiAgentController.index);
aiAgentRoutes.get("/ai-agents/channels", isAuth, AiAgentController.channels);
aiAgentRoutes.get("/ai-agents/flow-options", isAuth, AiAgentController.flowOptions);
aiAgentRoutes.post(
  "/ai-agents/knowledge/extract",
  isAuth,
  subidaDocumento.single("file"),
  AiAgentController.extractKnowledge
);
aiAgentRoutes.get("/ai-agents/:id", isAuth, AiAgentController.show);
aiAgentRoutes.post("/ai-agents", isAuth, AiAgentController.store);
aiAgentRoutes.put("/ai-agents/:id", isAuth, AiAgentController.update);
aiAgentRoutes.put("/ai-agents/:id/channels", isAuth, AiAgentController.updateChannels);
aiAgentRoutes.delete("/ai-agents/:id", isAuth, AiAgentController.remove);

export default aiAgentRoutes;
