import { Op } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import AiAgent, {
  HorarioAgente,
  PasoSeguimiento,
  ProveedorIa
} from "../../models/AiAgent";
import AiAgentChannel from "../../models/AiAgentChannel";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import { decrypt, encrypt } from "../../helpers/SecretBox";

/**
 * Agentes IA de una empresa. Ver docs/AGENTES_IA.md.
 *
 * Mismo criterio que MetaConfigService: la empresa sale siempre del token,
 * las claves (API del proveedor y voz de Azure) se guardan cifradas y lo que
 * vuelve al frontend es si hay clave y sus 4 ultimos caracteres, nunca la
 * clave. Descifrar solo lo hace credencialesDe(), al usar el agente.
 */

export const PROVEEDORES: ProveedorIa[] = ["openai", "gemini", "openrouter"];

/** Canales en los que un agente puede responder en esta fase. GHL queda fuera. */
export const CANALES_AGENTE = ["whatsapp", "whatsapp_oficial", "facebook", "instagram"];

export const MAX_PASOS_SEGUIMIENTO = 5;
export const MAX_KNOWLEDGE_CHARS = 100000;

export interface DatosAgente {
  name?: string;
  provider?: string;
  model?: string;
  /** Solo si se quiere poner o cambiar. Vacia o ausente conserva la guardada. */
  apiKey?: string;
  systemPrompt?: string;
  temperature?: number | string;
  maxTokens?: number | string;
  maxCharacters?: number | string | null;
  maxMessages?: number | string;
  voice?: string;
  voiceKey?: string;
  voiceRegion?: string;
  escuchaAudio?: boolean;
  leeImagenes?: boolean;
  dividirRespuestas?: boolean;
  cantidadBloques?: number | string;
  knowledgeText?: string | null;
  knowledgeFileName?: string | null;
  schedule?: HorarioAgente;
  followUps?: PasoSeguimiento[];
  transferQueueId?: number | string | null;
  disponibleEnFlujos?: boolean;
  isActive?: boolean;
}

export interface AgenteSerializado {
  id: number | null;
  name: string;
  provider: ProveedorIa;
  model: string;
  hasApiKey: boolean;
  keyLast4: string | null;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  maxCharacters: number | null;
  maxMessages: number;
  voice: string;
  hasVoiceKey: boolean;
  voiceKeyLast4: string | null;
  voiceRegion: string;
  escuchaAudio: boolean;
  leeImagenes: boolean;
  dividirRespuestas: boolean;
  cantidadBloques: number;
  knowledgeText: string;
  knowledgeFileName: string | null;
  schedule: HorarioAgente;
  followUps: PasoSeguimiento[];
  transferQueueId: number | null;
  disponibleEnFlujos: boolean;
  isActive: boolean;
  channels: { whatsappId: number; name: string; channel: string }[];
}

const ultimos4 = (clave: string): string => clave.slice(-4);

const numero = (valor: unknown, campo: string, min: number, max: number, entero = true): number => {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < min || n > max || (entero && !Number.isInteger(n))) {
    throw new AppError(`ERR_AI_AGENT_INVALID_${campo}`, 400);
  }
  return n;
};

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const validarHorario = (horario: unknown): HorarioAgente => {
  if (horario === undefined || horario === null) return { mode: "24/7" };
  const h = horario as HorarioAgente;
  if (h.mode === "24/7") return { mode: "24/7" };
  if (h.mode !== "custom" || !Array.isArray(h.days)) {
    throw new AppError("ERR_AI_AGENT_INVALID_SCHEDULE", 400);
  }
  const vistos = new Set<number>();
  const days = h.days.map(d => {
    const day = Number(d?.day);
    if (!Number.isInteger(day) || day < 0 || day > 6 || vistos.has(day)) {
      throw new AppError("ERR_AI_AGENT_INVALID_SCHEDULE", 400);
    }
    vistos.add(day);
    const enabled = Boolean(d.enabled);
    const start = String(d.start || "");
    const end = String(d.end || "");
    if (enabled && (!HORA.test(start) || !HORA.test(end) || start >= end)) {
      throw new AppError("ERR_AI_AGENT_INVALID_SCHEDULE", 400);
    }
    return { day, enabled, start: HORA.test(start) ? start : "09:00", end: HORA.test(end) ? end : "18:00" };
  });
  return { mode: "custom", days: days.sort((a, b) => a.day - b.day) };
};

export const validarSeguimientos = (pasos: unknown): PasoSeguimiento[] => {
  if (pasos === undefined || pasos === null) return [];
  if (!Array.isArray(pasos) || pasos.length > MAX_PASOS_SEGUIMIENTO) {
    throw new AppError("ERR_AI_AGENT_INVALID_FOLLOW_UPS", 400);
  }
  return pasos.map(p => {
    const amount = Number(p?.when?.amount);
    const unit = p?.when?.unit;
    const content = String(p?.content ?? "").trim();
    if (
      !Number.isInteger(amount) ||
      amount < 1 ||
      !["minutes", "hours", "days"].includes(unit) ||
      !["ia", "manual"].includes(p?.mode) ||
      !content ||
      content.length > 2000
    ) {
      throw new AppError("ERR_AI_AGENT_INVALID_FOLLOW_UPS", 400);
    }
    return { when: { amount, unit }, mode: p.mode, content };
  });
};

/**
 * Valida y normaliza lo que llega del formulario. Devuelve los campos listos
 * para guardar, con las claves ya cifradas si se enviaron. `base` es el agente
 * guardado cuando se edita: lo que no se envia se conserva.
 */
export const normalizarDatos = (datos: DatosAgente, base?: Partial<AiAgent>): Partial<AiAgent> => {
  const valor = <K extends keyof DatosAgente>(k: K, porDefecto: unknown) =>
    datos[k] !== undefined ? datos[k] : base && (base as any)[k] !== undefined ? (base as any)[k] : porDefecto;

  const name = String(valor("name", "") ?? "").trim();
  if (!name || name.length > 100) throw new AppError("ERR_AI_AGENT_INVALID_NAME", 400);

  const provider = String(valor("provider", "")) as ProveedorIa;
  if (!PROVEEDORES.includes(provider)) throw new AppError("ERR_AI_AGENT_INVALID_PROVIDER", 400);

  const model = String(valor("model", "") ?? "").trim();
  if (!model || model.length > 200) throw new AppError("ERR_AI_AGENT_INVALID_MODEL", 400);

  const maxCharactersBruto = valor("maxCharacters", null);
  const maxCharacters =
    maxCharactersBruto === null || maxCharactersBruto === "" ? null : numero(maxCharactersBruto, "MAX_CHARACTERS", 20, 10000);

  const knowledgeText = valor("knowledgeText", null);
  if (knowledgeText !== null && String(knowledgeText).length > MAX_KNOWLEDGE_CHARS) {
    throw new AppError("ERR_AI_AGENT_KNOWLEDGE_TOO_LONG", 400);
  }

  const transferBruto = valor("transferQueueId", null);
  const transferQueueId = transferBruto === null || transferBruto === "" ? null : numero(transferBruto, "QUEUE", 1, 2147483647);

  const campos: Partial<AiAgent> = {
    name,
    provider,
    model,
    systemPrompt: String(valor("systemPrompt", "") ?? ""),
    temperature: numero(valor("temperature", 0.7), "TEMPERATURE", 0, 2, false),
    maxTokens: numero(valor("maxTokens", 1000), "MAX_TOKENS", 1, 32000),
    maxCharacters,
    maxMessages: numero(valor("maxMessages", 10), "MAX_MESSAGES", 0, 50),
    voice: String(valor("voice", "texto") || "texto"),
    voiceRegion: String(valor("voiceRegion", "") ?? ""),
    escuchaAudio: Boolean(valor("escuchaAudio", false)),
    leeImagenes: Boolean(valor("leeImagenes", false)),
    dividirRespuestas: Boolean(valor("dividirRespuestas", false)),
    cantidadBloques: numero(valor("cantidadBloques", 2), "BLOCKS", 1, 3),
    knowledgeText: knowledgeText === null ? null : String(knowledgeText),
    knowledgeFileName: valor("knowledgeFileName", null) === null ? null : String(valor("knowledgeFileName", "")),
    schedule: validarHorario(valor("schedule", { mode: "24/7" })),
    followUps: validarSeguimientos(valor("followUps", [])),
    transferQueueId,
    disponibleEnFlujos: Boolean(valor("disponibleEnFlujos", false)),
    isActive: Boolean(valor("isActive", true))
  } as Partial<AiAgent>;

  const apiKeyNueva = typeof datos.apiKey === "string" ? datos.apiKey.trim() : "";
  if (apiKeyNueva) {
    campos.apiKey = encrypt(apiKeyNueva);
    campos.apiKeyLast4 = ultimos4(apiKeyNueva);
  } else if (!base?.apiKey) {
    throw new AppError("ERR_AI_AGENT_API_KEY_REQUIRED", 400);
  }

  const voiceKeyNueva = typeof datos.voiceKey === "string" ? datos.voiceKey.trim() : "";
  if (voiceKeyNueva) {
    campos.voiceKey = encrypt(voiceKeyNueva);
    campos.voiceKeyLast4 = ultimos4(voiceKeyNueva);
  }

  return campos;
};

export const serializar = (agente: AiAgent, canales: AiAgentChannel[] = []): AgenteSerializado => ({
  id: agente.id,
  name: agente.name,
  provider: agente.provider,
  model: agente.model,
  hasApiKey: Boolean(agente.apiKey),
  keyLast4: agente.apiKey ? agente.apiKeyLast4 || null : null,
  systemPrompt: agente.systemPrompt || "",
  temperature: Number(agente.temperature),
  maxTokens: agente.maxTokens,
  maxCharacters: agente.maxCharacters ?? null,
  maxMessages: agente.maxMessages,
  voice: agente.voice || "texto",
  hasVoiceKey: Boolean(agente.voiceKey),
  voiceKeyLast4: agente.voiceKey ? agente.voiceKeyLast4 || null : null,
  voiceRegion: agente.voiceRegion || "",
  escuchaAudio: agente.escuchaAudio,
  leeImagenes: agente.leeImagenes,
  dividirRespuestas: agente.dividirRespuestas,
  cantidadBloques: agente.cantidadBloques,
  knowledgeText: agente.knowledgeText || "",
  knowledgeFileName: agente.knowledgeFileName || null,
  schedule: agente.schedule || { mode: "24/7" },
  followUps: agente.followUps || [],
  transferQueueId: agente.transferQueueId ?? null,
  disponibleEnFlujos: agente.disponibleEnFlujos,
  isActive: agente.isActive,
  channels: canales.map(c => ({
    whatsappId: c.whatsappId,
    name: c.whatsapp?.name || "",
    channel: c.whatsapp?.channel || ""
  }))
});

const incluirCanales = {
  model: AiAgentChannel,
  as: "channels",
  include: [{ model: Whatsapp, attributes: ["id", "name", "channel"] }]
};

const buscarDeEmpresa = async (companyId: number, id: number): Promise<AiAgent> => {
  const agente = await AiAgent.findOne({ where: { id, companyId }, include: [incluirCanales] });
  if (!agente) throw new AppError("ERR_AI_AGENT_NOT_FOUND", 404);
  return agente;
};

const comprobarFila = async (companyId: number, queueId: number | null): Promise<void> => {
  if (!queueId) return;
  const fila = await Queue.findOne({ where: { id: queueId, companyId }, attributes: ["id"] });
  if (!fila) throw new AppError("ERR_AI_AGENT_INVALID_QUEUE", 400);
};

export const listarAgentes = async (companyId: number): Promise<AgenteSerializado[]> => {
  const agentes = await AiAgent.findAll({
    where: { companyId },
    include: [incluirCanales],
    order: [["name", "ASC"]]
  });
  return agentes.map(a => serializar(a, a.channels));
};

export const verAgente = async (companyId: number, id: number): Promise<AgenteSerializado> => {
  const agente = await buscarDeEmpresa(companyId, id);
  return serializar(agente, agente.channels);
};

export const crearAgente = async (companyId: number, datos: DatosAgente): Promise<AgenteSerializado> => {
  const campos = normalizarDatos(datos);
  await comprobarFila(companyId, campos.transferQueueId ?? null);
  const agente = await AiAgent.create({ ...campos, companyId } as AiAgent);
  return verAgente(companyId, agente.id);
};

export const actualizarAgente = async (
  companyId: number,
  id: number,
  datos: DatosAgente
): Promise<AgenteSerializado> => {
  const agente = await buscarDeEmpresa(companyId, id);
  const campos = normalizarDatos(datos, agente);
  await comprobarFila(companyId, campos.transferQueueId ?? null);
  await agente.update(campos);
  return verAgente(companyId, id);
};

export const eliminarAgente = async (companyId: number, id: number): Promise<void> => {
  const agente = await buscarDeEmpresa(companyId, id);
  await agente.destroy();
};

/**
 * Conexiones de la empresa que pueden tener agente, con el agente que tienen
 * ahora (si alguno). Para el selector de canales del formulario.
 */
export const canalesDisponibles = async (companyId: number) => {
  const conexiones = await Whatsapp.findAll({
    where: { companyId, channel: { [Op.in]: CANALES_AGENTE } },
    attributes: ["id", "name", "channel", "status"],
    order: [["name", "ASC"]]
  });
  const enlaces = await AiAgentChannel.findAll({
    where: { companyId },
    include: [{ model: AiAgent, attributes: ["id", "name"] }]
  });
  const porConexion = new Map(enlaces.map(e => [e.whatsappId, e.agent]));
  return conexiones.map(c => ({
    whatsappId: c.id,
    name: c.name,
    channel: c.channel,
    status: c.status,
    agentId: porConexion.get(c.id)?.id ?? null,
    agentName: porConexion.get(c.id)?.name ?? null
  }));
};

/**
 * Deja al agente exactamente con estas conexiones. Una conexion que ya use
 * otro agente no se le quita en silencio: se rechaza y se dice cual la tiene.
 */
export const asignarCanales = async (
  companyId: number,
  agentId: number,
  whatsappIds: number[]
): Promise<AgenteSerializado> => {
  await buscarDeEmpresa(companyId, agentId);
  const ids = Array.from(new Set((whatsappIds || []).map(Number).filter(n => Number.isInteger(n) && n > 0)));

  if (ids.length) {
    const conexiones = await Whatsapp.findAll({
      where: { id: { [Op.in]: ids }, companyId },
      attributes: ["id", "channel"]
    });
    if (conexiones.length !== ids.length || conexiones.some(c => !CANALES_AGENTE.includes(c.channel))) {
      throw new AppError("ERR_AI_AGENT_INVALID_CHANNEL", 400);
    }
    const ocupadas = await AiAgentChannel.findAll({
      where: { whatsappId: { [Op.in]: ids }, agentId: { [Op.ne]: agentId } },
      attributes: ["whatsappId"]
    });
    if (ocupadas.length) {
      throw new AppError("ERR_AI_AGENT_CHANNEL_TAKEN", 409);
    }
  }

  await sequelize.transaction(async transaction => {
    await AiAgentChannel.destroy({
      where: { agentId, companyId, ...(ids.length ? { whatsappId: { [Op.notIn]: ids } } : {}) },
      transaction
    });
    const actuales = await AiAgentChannel.findAll({ where: { agentId }, attributes: ["whatsappId"], transaction });
    const yaEstan = new Set(actuales.map(a => a.whatsappId));
    const nuevas = ids.filter(id => !yaEstan.has(id)).map(whatsappId => ({ companyId, agentId, whatsappId }));
    if (nuevas.length) await AiAgentChannel.bulkCreate(nuevas as AiAgentChannel[], { transaction });
  });

  return verAgente(companyId, agentId);
};

/** Agentes que el Flow Builder puede elegir: activos y disponibles en flujos. */
export const agentesParaFlujos = async (companyId: number) => {
  const agentes = await AiAgent.findAll({
    where: { companyId, isActive: true, disponibleEnFlujos: true },
    attributes: ["id", "name", "provider", "model"],
    order: [["name", "ASC"]]
  });
  return agentes.map(a => ({ id: a.id, name: a.name, provider: a.provider, model: a.model }));
};

/** Agente activo que atiende una conexion, si lo hay. */
export const agenteDeConexion = async (companyId: number, whatsappId: number): Promise<AiAgent | null> => {
  const enlace = await AiAgentChannel.findOne({
    where: { companyId, whatsappId },
    include: [{ model: AiAgent, where: { isActive: true, companyId } }]
  });
  return enlace?.agent || null;
};

/** Claves descifradas. Solo para usar el agente, nunca para responder a la API. */
export const credencialesDe = (agente: Pick<AiAgent, "apiKey" | "voiceKey">) => ({
  apiKey: decrypt(agente.apiKey) || "",
  voiceKey: decrypt(agente.voiceKey) || ""
});
