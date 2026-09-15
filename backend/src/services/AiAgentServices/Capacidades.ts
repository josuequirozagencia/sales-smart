import axios from "axios";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ProveedorIa } from "../../models/AiAgent";
import logger from "../../utils/logger";

/**
 * Que puede hacer un modelo concreto: leer imagenes, escuchar audio y usar
 * herramientas (tool calling). Nunca se da por supuesto en silencio:
 *
 * - OpenRouter publica las modalidades y parametros de cada modelo en
 *   /api/v1/models: la respuesta es definitiva.
 * - OpenAI y Gemini no publican esa ficha. Para imagenes se prueba con una
 *   imagen de 1x1 px (una llamada minima). El audio en OpenAI va por Whisper
 *   con la misma clave; en Gemini lo aceptan los modelos multimodales.
 *
 * `null` significa "no se ha podido comprobar": el formulario lo muestra como
 * aviso y el agente responde pidiendo texto si falla en produccion.
 */

export interface Capacidades {
  imagen: boolean | null;
  audio: boolean | null;
  herramientas: boolean | null;
  avisos: string[];
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

type FichaOpenRouter = { id: string; architecture?: { input_modalities?: string[] }; supported_parameters?: string[] };

let catalogoOpenRouter: { cargado: number; modelos: Map<string, FichaOpenRouter> } | null = null;

export const fichaOpenRouter = async (
  modelo: string,
  baseURL: string = OPENROUTER_BASE
): Promise<FichaOpenRouter | null> => {
  const vigente = catalogoOpenRouter && Date.now() - catalogoOpenRouter.cargado < 60 * 60 * 1000;
  if (!vigente) {
    const { data } = await axios.get(`${baseURL}/models`, { timeout: 15000 });
    const lista: FichaOpenRouter[] = Array.isArray(data?.data) ? data.data : [];
    catalogoOpenRouter = { cargado: Date.now(), modelos: new Map(lista.map(m => [m.id, m])) };
  }
  return catalogoOpenRouter!.modelos.get(modelo) || null;
};

/** Solo para tests: olvida el catalogo cacheado de OpenRouter. */
export const olvidarCatalogoOpenRouter = (): void => {
  catalogoOpenRouter = null;
};

export interface OpcionesCapacidades {
  baseURL?: string;
}

export const verificarCapacidades = async (
  provider: ProveedorIa,
  model: string,
  apiKey: string,
  opciones: OpcionesCapacidades = {}
): Promise<Capacidades> => {
  const avisos: string[] = [];

  if (provider === "openrouter") {
    try {
      const ficha = await fichaOpenRouter(model, opciones.baseURL || OPENROUTER_BASE);
      if (!ficha) {
        return { imagen: false, audio: false, herramientas: false, avisos: ["MODEL_NOT_FOUND_IN_OPENROUTER"] };
      }
      const entradas = ficha.architecture?.input_modalities || [];
      const parametros = ficha.supported_parameters || [];
      return {
        imagen: entradas.includes("image"),
        audio: entradas.includes("audio"),
        herramientas: parametros.includes("tools"),
        avisos
      };
    } catch (err) {
      logger.warn(`[AI AGENT] No se pudo leer el catalogo de OpenRouter: ${(err as Error).message}`);
      return { imagen: null, audio: null, herramientas: null, avisos: ["OPENROUTER_CATALOG_UNAVAILABLE"] };
    }
  }

  if (provider === "openai") {
    let imagen: boolean | null = null;
    try {
      const cliente = new OpenAI({ apiKey, baseURL: opciones.baseURL });
      await cliente.chat.completions.create({
        model,
        max_completion_tokens: 16,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "ok" },
              { type: "image_url", image_url: { url: `data:image/png;base64,${PNG_1PX}` } }
            ]
          }
        ]
      } as any);
      imagen = true;
    } catch (err: any) {
      const texto = String(err?.message || "").toLowerCase();
      if (err?.status === 401) avisos.push("INVALID_API_KEY");
      else if (err?.status === 404) avisos.push("MODEL_NOT_FOUND");
      else if (/image|vision|content type|multimodal/.test(texto)) imagen = false;
      else avisos.push("IMAGE_CHECK_FAILED");
    }
    return { imagen, audio: true, herramientas: true, avisos };
  }

  // gemini
  let imagen: boolean | null = null;
  try {
    const cliente = new GoogleGenerativeAI(apiKey);
    const modelo = cliente.getGenerativeModel(
      { model, generationConfig: { maxOutputTokens: 16 } },
      opciones.baseURL ? { baseUrl: opciones.baseURL } : undefined
    );
    await modelo.generateContent([{ text: "ok" }, { inlineData: { mimeType: "image/png", data: PNG_1PX } }]);
    imagen = true;
  } catch (err: any) {
    const texto = String(err?.message || "").toLowerCase();
    if (/api key|permission|401|403/.test(texto)) avisos.push("INVALID_API_KEY");
    else if (/not found|404/.test(texto)) avisos.push("MODEL_NOT_FOUND");
    else if (/image|modality|inline/.test(texto)) imagen = false;
    else avisos.push("IMAGE_CHECK_FAILED");
  }
  return { imagen, audio: imagen === null ? null : imagen, herramientas: true, avisos };
};
