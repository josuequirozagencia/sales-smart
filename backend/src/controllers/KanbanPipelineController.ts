import { Request, Response } from "express";
import {
  listarPipelines,
  crearPipeline,
  actualizarPipeline,
  borrarPipeline
} from "../services/KanbanPipelineServices/KanbanPipelineService";

// Embudos del Kanban de la empresa del token.

export const index = async (req: Request, res: Response): Promise<Response> => {
  const pipelines = await listarPipelines(req.user.companyId);
  return res.status(200).json(pipelines);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const pipeline = await crearPipeline(req.user.companyId, req.body?.name);
  return res.status(200).json(pipeline);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const pipeline = await actualizarPipeline(
    req.params.id,
    req.user.companyId,
    { name: req.body?.name, order: req.body?.order }
  );
  return res.status(200).json(pipeline);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await borrarPipeline(req.params.id, req.user.companyId);
  return res.status(200).json({ ok: true });
};
