import express from "express";
import isAuth from "../middleware/isAuth";

import * as KanbanPipelineController from "../controllers/KanbanPipelineController";

// Embudos del Kanban. Mismo acceso que las etapas (las etiquetas): cualquier
// usuario de la empresa con sesion, que es quien trabaja el tablero.
const kanbanPipelineRoutes = express.Router();

kanbanPipelineRoutes.get("/kanban/pipelines", isAuth, KanbanPipelineController.index);
kanbanPipelineRoutes.post("/kanban/pipelines", isAuth, KanbanPipelineController.store);
kanbanPipelineRoutes.put("/kanban/pipelines/:id", isAuth, KanbanPipelineController.update);
kanbanPipelineRoutes.delete("/kanban/pipelines/:id", isAuth, KanbanPipelineController.remove);

export default kanbanPipelineRoutes;
