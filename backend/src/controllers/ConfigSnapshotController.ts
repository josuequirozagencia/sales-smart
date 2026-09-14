import { Request, Response } from "express";
import AppError from "../errors/AppError";
import User from "../models/User";
import CreateConfigSnapshotService from "../services/ConfigSnapshotService/CreateConfigSnapshotService";
import ListConfigSnapshotsService, {
  ListAppliedModulesService
} from "../services/ConfigSnapshotService/ListConfigSnapshotsService";
import ApplyConfigSnapshotService from "../services/ConfigSnapshotService/ApplyConfigSnapshotService";
import DeleteConfigSnapshotService from "../services/ConfigSnapshotService/DeleteConfigSnapshotService";

/**
 * Instantaneas de configuracion. Ver docs/INSTANTANEAS.md.
 *
 * Permisos:
 *   - Superadministrador: crea, lista, carga en cualquier empresa y borra.
 *   - Admin de una empresa: lista y carga, solo en su propia empresa.
 *   - Resto de usuarios: nada.
 *
 * Se leen de la base (super, profile, companyId) y no del token, igual que
 * el guard de CompanyController.
 */

const usuarioDe = async (req: Request): Promise<User> => {
  const usuario = await User.findByPk(req.user.id);
  if (!usuario) throw new AppError("ERR_NO_PERMISSION", 403);
  return usuario;
};

const esSuper = (usuario: User) => usuario.super === true;

const soloSuper = (usuario: User) => {
  if (!esSuper(usuario)) throw new AppError("ERR_NO_PERMISSION", 403);
};

const puedeCargar = (usuario: User) => {
  if (!esSuper(usuario) && usuario.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

/**
 * Empresa sobre la que actua la peticion. El superadministrador elige
 * cualquiera; el admin solo puede la suya, y pedir otra es un 403, no un
 * cambio silencioso.
 */
const empresaObjetivo = (usuario: User, pedida: unknown): number => {
  const vacia = pedida === undefined || pedida === null || pedida === "";

  if (esSuper(usuario)) {
    return vacia ? usuario.companyId : Number(pedida);
  }

  if (!vacia && Number(pedida) !== usuario.companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  return usuario.companyId;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const usuario = await usuarioDe(req);
  puedeCargar(usuario);

  const instantaneas = await ListConfigSnapshotsService();
  return res.status(200).json(instantaneas);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const usuario = await usuarioDe(req);
  soloSuper(usuario);

  const { sourceCompanyId, name, description, modules } = req.body;

  const instantanea = await CreateConfigSnapshotService({
    sourceCompanyId,
    name,
    description,
    modules,
    userId: usuario.id
  });

  return res.status(201).json(instantanea);
};

export const applied = async (req: Request, res: Response): Promise<Response> => {
  const usuario = await usuarioDe(req);
  puedeCargar(usuario);

  const companyId = empresaObjetivo(usuario, req.query.companyId);
  const modules = await ListAppliedModulesService(Number(req.params.id), companyId);

  return res.status(200).json({ companyId, modules });
};

export const apply = async (req: Request, res: Response): Promise<Response> => {
  const usuario = await usuarioDe(req);
  puedeCargar(usuario);

  const companyId = empresaObjetivo(usuario, req.body.companyId);

  const resultado = await ApplyConfigSnapshotService({
    snapshotId: Number(req.params.id),
    companyId,
    modules: req.body.modules,
    userId: usuario.id
  });

  return res.status(200).json(resultado);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const usuario = await usuarioDe(req);
  soloSuper(usuario);

  await DeleteConfigSnapshotService(Number(req.params.id));
  return res.status(200).json({ ok: true });
};
