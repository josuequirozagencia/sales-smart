import axios from "axios";
import OpenAI from "openai";
import AppError from "../../errors/AppError";
import AiAgent, { ProveedorIa } from "../../models/AiAgent";
import logger from "../../utils/logger";
import { PROVEEDORES, credencialesDe } from "./AiAgentService";
import { OPENROUTER_BASE } from "./Proveedores";

/**
 * Modelos que ofrece cada proveedor, preguntandoselo a el.
 *
 * Una lista escrita a mano envejece en semanas y deja al cliente sin los
 * modelos nuevos, asi que se pide al proveedor y se cachea un rato. Si la
 * consulta falla (clave invalida, sin internet), quien llama puede seguir
 * escribiendo el modelo a mano: el campo nunca deja de aceptar texto libre.
 */

export interface ModelosProveedor {
  provider: ProveedorIa;
  models: string[];
  /** Codigos de lo que no se pudo hacer: INVALID_API_KEY, UNAVAILABLE... */
  avisos: string[];
}

const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<string, { cargado: number; modelos: string[] }>();

/** Solo para tests. */
export const olvidarModelos = (): void => cache.clear();

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Los de imagenes, voz o embeddings no sirven para conversar. */
const DESCARTADOS = /(embed|whisper|tts|dall-e|moderation|image|audio-preview|realtime|transcribe|search|rerank)/i;

const ordenar = (ids: string[]): string[] => Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));

const deOpenAi = async (apiKey: string, baseURL?: string): Promise<string[]> => {
  const cliente = new OpenAI({ apiKey, baseURL });
  const lista = await cliente.models.list();
  const ids = (lista.data || []).map(m => m.id).filter(id => /^(gpt|o\d|chatgpt)/i.test(id) && !DESCARTADOS.test(id));
  return ordenar(ids);
};

const deGemini = async (apiKey: string, baseURL?: string): Promise<string[]> => {
  const { data } = await axios.get(`${baseURL || GEMINI_BASE}/models`, {
    params: { key: apiKey },
    timeout: 15000
  });
  const ids = (data?.models || [])
    .filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m: any) => String(m.name || "").replace(/^models\//, ""))
    .filter((id: string) => id && !DESCARTADOS.test(id));
  return ordenar(ids);
};

const deOpenRouter = async (baseURL?: string): Promise<string[]> => {
  // El catalogo de OpenRouter es publico: no hace falta clave para listarlo.
  const { data } = await axios.get(`${baseURL || OPENROUTER_BASE}/models`, { timeout: 15000 });
  const ids = (Array.isArray(data?.data) ? data.data : []).map((m: any) => String(m.id)).filter(Boolean);
  return ordenar(ids);
};

const codigoDeError = (err: any): string => {
  const estado = err?.status || err?.response?.status;
  if (estado === 401 || estado === 403) return "INVALID_API_KEY";
  if (estado === 404) return "NOT_FOUND";
  return "UNAVAILABLE";
};

export interface OpcionesModelos {
  /** Solo para tests con un servidor falso. */
  baseURL?: string;
  /** Agente ya guardado del que tomar la clave si no llega una nueva. */
  agentId?: number;
}

export const listarModelos = async (
  companyId: number,
  provider: ProveedorIa,
  apiKey?: string,
  opciones: OpcionesModelos = {}
): Promise<ModelosProveedor> => {
  if (!PROVEEDORES.includes(provider)) throw new AppError("ERR_AI_AGENT_INVALID_PROVIDER", 400);

  let clave = (apiKey || "").trim();
  if (!clave && opciones.agentId) {
    // El formulario no reenvia la clave guardada: se toma de la base, sin
    // salir nunca de aqui.
    const agente = await AiAgent.findOne({ where: { id: opciones.agentId, companyId } });
    if (agente) clave = credencialesDe(agente).apiKey;
  }
  if (!clave && provider !== "openrouter") {
    return { provider, models: [], avisos: ["API_KEY_REQUIRED"] };
  }

  const llave = `${provider}:${opciones.baseURL || ""}:${clave.slice(-6)}`;
  const guardado = cache.get(llave);
  if (guardado && Date.now() - guardado.cargado < CACHE_MS) {
    return { provider, models: guardado.modelos, avisos: [] };
  }

  try {
    let modelos: string[];
    if (provider === "openai") modelos = await deOpenAi(clave, opciones.baseURL);
    else if (provider === "gemini") modelos = await deGemini(clave, opciones.baseURL);
    else modelos = await deOpenRouter(opciones.baseURL);

    cache.set(llave, { cargado: Date.now(), modelos });
    return { provider, models: modelos, avisos: modelos.length ? [] : ["EMPTY"] };
  } catch (err) {
    const aviso = codigoDeError(err);
    logger.warn(`[AI AGENT] No se pudo listar modelos de ${provider}: ${(err as Error).message}`);
    return { provider, models: [], avisos: [aviso] };
  }
};
