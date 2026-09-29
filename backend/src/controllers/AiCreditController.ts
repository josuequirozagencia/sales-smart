import { Request, Response } from "express";
import AppError from "../errors/AppError";
import User from "../models/User";
import Company from "../models/Company";
import AiAgent from "../models/AiAgent";
import AiCreditAccount from "../models/AiCreditAccount";
import AiCreditLedger from "../models/AiCreditLedger";
import AiModelPricing from "../models/AiModelPricing";
import { encrypt } from "../helpers/SecretBox";
import {
  ajustes,
  cuentaDe,
  otorgarCredito,
  saldoDe
} from "../services/AiCreditServices/AiCreditService";
import { registrarIntencionDeCompra } from "../services/AiCreditServices/ComprarCreditoService";

/**
 * Panel de credito IA.
 *
 * Todo lo de superadmin usa la comprobacion en linea que ya usa
 * CompanyController, no el middleware isSuper (que existe pero no lo usa
 * ninguna ruta real). La clave compartida NUNCA sale de aqui: la pantalla
 * solo recibe los ultimos 4 caracteres.
 */

const exigirSuper = async (req: Request): Promise<User> => {
  const usuario = await User.findByPk(req.user.id);
  if (usuario?.super !== true) throw new AppError("ERR_NO_PERMISSION", 403);
  return usuario;
};

export const verAjustes = async (req: Request, res: Response): Promise<Response> => {
  await exigirSuper(req);
  const config = await ajustes();

  return res.json({
    configurada: !!config.sharedOpenAiApiKey,
    sharedOpenAiApiKeyLast4: config.sharedOpenAiApiKeyLast4 || null,
    defaultMarginPercent: Number(config.defaultMarginPercent),
    minPurchaseCents: config.minPurchaseCents
  });
};

export const guardarAjustes = async (req: Request, res: Response): Promise<Response> => {
  await exigirSuper(req);
  const config = await ajustes();
  const { sharedOpenAiApiKey, defaultMarginPercent, minPurchaseCents } = req.body;

  const cambios: any = {};

  // Cadena vacia = "no la toques". Para quitarla hay que mandar null.
  if (typeof sharedOpenAiApiKey === "string" && sharedOpenAiApiKey.trim()) {
    const clave = sharedOpenAiApiKey.trim();
    cambios.sharedOpenAiApiKey = encrypt(clave);
    cambios.sharedOpenAiApiKeyLast4 = clave.slice(-4);
  } else if (sharedOpenAiApiKey === null) {
    cambios.sharedOpenAiApiKey = null;
    cambios.sharedOpenAiApiKeyLast4 = null;
  }

  if (defaultMarginPercent !== undefined) {
    const margen = Number(defaultMarginPercent);
    if (!Number.isFinite(margen) || margen < 0) {
      throw new AppError("ERR_AI_CREDIT_INVALID_MARGIN", 400);
    }
    cambios.defaultMarginPercent = String(margen);
  }

  if (minPurchaseCents !== undefined) {
    const minimo = Number(minPurchaseCents);
    if (!Number.isInteger(minimo) || minimo < 0) {
      throw new AppError("ERR_AI_CREDIT_INVALID_MIN", 400);
    }
    cambios.minPurchaseCents = minimo;
  }

  await config.update(cambios);

  return res.json({
    configurada: !!config.sharedOpenAiApiKey,
    sharedOpenAiApiKeyLast4: config.sharedOpenAiApiKeyLast4 || null,
    defaultMarginPercent: Number(config.defaultMarginPercent),
    minPurchaseCents: config.minPurchaseCents
  });
};

export const listarPrecios = async (req: Request, res: Response): Promise<Response> => {
  await exigirSuper(req);
  const precios = await AiModelPricing.findAll({
    order: [["provider", "ASC"], ["model", "ASC"], ["unit", "ASC"]]
  });
  return res.json(precios);
};

export const guardarPrecio = async (req: Request, res: Response): Promise<Response> => {
  await exigirSuper(req);
  const fila = await AiModelPricing.findByPk(req.params.id);
  if (!fila) throw new AppError("ERR_AI_PRICING_NOT_FOUND", 404);

  const { pricePerUnitCents, marginPercentOverride } = req.body;
  const cambios: any = {};

  if (pricePerUnitCents !== undefined) {
    const precio = Number(pricePerUnitCents);
    if (!Number.isFinite(precio) || precio < 0) {
      throw new AppError("ERR_AI_PRICING_INVALID", 400);
    }
    cambios.pricePerUnitCents = String(precio);
  }

  if (marginPercentOverride !== undefined) {
    if (marginPercentOverride === null || marginPercentOverride === "") {
      cambios.marginPercentOverride = null;
    } else {
      const margen = Number(marginPercentOverride);
      if (!Number.isFinite(margen) || margen < 0) {
        throw new AppError("ERR_AI_CREDIT_INVALID_MARGIN", 400);
      }
      cambios.marginPercentOverride = String(margen);
    }
  }

  await fila.update(cambios);
  return res.json(fila);
};

export const listarEmpresas = async (req: Request, res: Response): Promise<Response> => {
  await exigirSuper(req);

  const empresas = await Company.findAll({
    attributes: ["id", "name"],
    order: [["name", "ASC"]]
  });

  const cuentas = await AiCreditAccount.findAll();
  const porEmpresa = new Map(cuentas.map(c => [c.companyId, c.balanceCents]));

  return res.json(
    empresas.map(e => ({
      id: e.id,
      name: e.name,
      balanceCents: porEmpresa.get(e.id) ?? 0
    }))
  );
};

export const otorgar = async (req: Request, res: Response): Promise<Response> => {
  const usuario = await exigirSuper(req);
  const companyId = Number(req.params.companyId);
  const { amountCents, description } = req.body;

  const monto = Number(amountCents);
  if (!Number.isInteger(monto) || monto === 0) {
    throw new AppError("ERR_AI_CREDIT_INVALID_AMOUNT", 400);
  }

  const empresa = await Company.findByPk(companyId);
  if (!empresa) throw new AppError("ERR_NO_COMPANY_FOUND", 404);

  const saldo = await otorgarCredito({
    companyId,
    amountCents: monto,
    description: description || null,
    createdByUserId: usuario.id
  });

  return res.json({ companyId, balanceCents: saldo });
};

export const verHistorial = async (req: Request, res: Response): Promise<Response> => {
  await exigirSuper(req);
  const companyId = Number(req.params.companyId);
  const pagina = Math.max(1, Number(req.query.pageNumber) || 1);
  const porPagina = 50;

  const { count, rows } = await AiCreditLedger.findAndCountAll({
    where: { companyId },
    order: [["id", "DESC"]],
    limit: porPagina,
    offset: porPagina * (pagina - 1)
  });

  return res.json({
    movimientos: rows,
    count,
    hasMore: count > porPagina * pagina
  });
};

/**
 * El saldo de la propia empresa. Sin superadmin: cualquiera de la empresa
 * puede verlo, es su dinero.
 */
export const miSaldo = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const [saldo, config, conClavePropia] = await Promise.all([
    saldoDe(Number(companyId)),
    ajustes(),
    AiAgent.count({ where: { companyId } })
  ]);

  // Si TODOS sus agentes traen clave propia, el saldo no le afecta y no hay
  // por que avisarle de nada.
  const agentesSinClave = await AiAgent.count({
    where: { companyId, apiKey: null as any }
  });

  return res.json({
    balanceCents: saldo,
    dependeDeClaveCompartida: agentesSinClave > 0 && !!config.sharedOpenAiApiKey,
    totalAgentes: conClavePropia,
    minPurchaseCents: config.minPurchaseCents
  });
};

/**
 * Intencion de compra. No cobra: la pasarela todavia no esta decidida.
 */
export const intencionDeCompra = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const resultado = await registrarIntencionDeCompra({
    companyId: Number(companyId),
    userId: Number(userId),
    amountCents: Number(req.body?.amountCents)
  });

  return res.json(resultado);
};
