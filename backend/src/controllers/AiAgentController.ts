import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  listarAgentes,
  verAgente,
  crearAgente,
  actualizarAgente,
  eliminarAgente,
  canalesDisponibles,
  asignarCanales,
  agentesParaFlujos
} from "../services/AiAgentServices/AiAgentService";
import { extraerTextoDocumento } from "../services/AiAgentServices/ExtraerTextoDocumento";

/**
 * Agentes IA de la empresa. De administrador, como Prompts y Meta. La empresa
 * sale SIEMPRE del token (req.user.companyId): un companyId en el cuerpo se
 * ignora. Ninguna respuesta incluye claves, solo sus 4 ultimos caracteres.
 */

const soloAdmin = (req: Request) => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

const idDe = (req: Request): number => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError("ERR_AI_AGENT_NOT_FOUND", 404);
  return id;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  return res.status(200).json(await listarAgentes(req.user.companyId));
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  return res.status(200).json(await verAgente(req.user.companyId, idDe(req)));
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  return res.status(201).json(await crearAgente(req.user.companyId, req.body));
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  return res.status(200).json(await actualizarAgente(req.user.companyId, idDe(req), req.body));
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  await eliminarAgente(req.user.companyId, idDe(req));
  return res.status(204).send();
};

export const channels = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  return res.status(200).json(await canalesDisponibles(req.user.companyId));
};

export const updateChannels = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  const { whatsappIds } = req.body;
  if (!Array.isArray(whatsappIds)) throw new AppError("ERR_AI_AGENT_INVALID_CHANNEL", 400);
  return res.status(200).json(await asignarCanales(req.user.companyId, idDe(req), whatsappIds));
};

/**
 * Lista minima para el selector "Elegir agente existente" de los nodos del
 * Flow Builder: quien edita flujos no tiene por que ser administrador, y aqui
 * solo sale id, nombre, proveedor y modelo.
 */
export const flowOptions = async (req: Request, res: Response): Promise<Response> => {
  return res.status(200).json(await agentesParaFlujos(req.user.companyId));
};

export const extractKnowledge = async (req: Request, res: Response): Promise<Response> => {
  soloAdmin(req);
  const archivo = req.file as Express.Multer.File | undefined;
  if (!archivo) throw new AppError("ERR_AI_AGENT_KNOWLEDGE_EMPTY", 400);
  return res
    .status(200)
    .json(await extraerTextoDocumento(archivo.buffer, archivo.originalname, archivo.mimetype));
};
