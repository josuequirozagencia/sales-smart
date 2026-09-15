import fs from "fs";
import os from "os";
import path from "path";
import OpenAI, { toFile } from "openai";
import { GoogleGenerativeAI, Content, Part, SchemaType } from "@google/generative-ai";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { ProveedorIa } from "../../models/AiAgent";

ffmpeg.setFfmpegPath(ffmpegStatic as string);

/**
 * Llamadas a cada proveedor con la misma forma de entrada y salida. Aqui no
 * hay tickets, contactos ni envios: eso es de quien use el motor, y es lo que
 * permite que el sandbox corra exactamente esta misma logica sin tocar nada.
 */

export interface TurnoHistorial {
  role: "user" | "assistant";
  text: string;
}

export interface Adjunto {
  buffer: Buffer;
  mimetype: string;
  fileName?: string;
}

export interface PeticionProveedor {
  provider: ProveedorIa;
  model: string;
  apiKey: string;
  promptSistema: string;
  historial: TurnoHistorial[];
  texto?: string;
  imagen?: Adjunto;
  audio?: Adjunto;
  temperature: number;
  maxTokens: number;
  usarHerramientas: boolean;
  /** Solo para tests con un servidor falso. */
  baseURL?: string;
}

export interface RespuestaProveedor {
  texto: string;
  transferir: boolean;
  /** Texto del audio del cliente, si se transcribio antes de responder. */
  transcripcion?: string;
}

export const HERRAMIENTA_TRANSFERIR = "transferir_a_humano";
const DESCRIPCION_TRANSFERIR =
  "Pasa la conversacion a una persona del equipo. Usala cuando el cliente pida hablar con alguien o no puedas resolver lo que necesita.";

export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

/** Parametros que algunos modelos (serie o, gpt-5) rechazan: se reintenta sin ellos. */
const reintentarSinParametro = (err: any, parametros: Record<string, unknown>): boolean => {
  const texto = String(err?.message || err?.error?.message || "");
  if (err?.status !== 400) return false;
  if (/max_tokens/.test(texto) && "max_tokens" in parametros) {
    parametros.max_completion_tokens = parametros.max_tokens;
    delete parametros.max_tokens;
    return true;
  }
  if (/temperature/.test(texto) && "temperature" in parametros) {
    delete parametros.temperature;
    return true;
  }
  if (/tool/i.test(texto) && "tools" in parametros) {
    delete parametros.tools;
    return true;
  }
  return false;
};

const convertirA = (buffer: Buffer, formato: "mp3" | "wav"): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const base = path.join(os.tmpdir(), `ai-agent-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const entrada = `${base}.in`;
    const salida = `${base}.${formato}`;
    fs.writeFileSync(entrada, buffer);
    ffmpeg(entrada)
      .toFormat(formato)
      .on("end", () => {
        const resultado = fs.readFileSync(salida);
        fs.rmSync(entrada, { force: true });
        fs.rmSync(salida, { force: true });
        resolve(resultado);
      })
      .on("error", err => {
        fs.rmSync(entrada, { force: true });
        fs.rmSync(salida, { force: true });
        reject(err);
      })
      .save(salida);
  });

const generarCompatibleOpenAi = async (p: PeticionProveedor): Promise<RespuestaProveedor> => {
  const esOpenRouter = p.provider === "openrouter";
  const cliente = new OpenAI({
    apiKey: p.apiKey,
    baseURL: p.baseURL || (esOpenRouter ? OPENROUTER_BASE : undefined),
    defaultHeaders: esOpenRouter ? { "X-Title": "Sales Smart" } : undefined
  });

  let transcripcion: string | undefined;
  const contenido: any[] = [];

  if (p.audio) {
    if (esOpenRouter) {
      const mp3 = await convertirA(p.audio.buffer, "mp3");
      contenido.push({ type: "input_audio", input_audio: { data: mp3.toString("base64"), format: "mp3" } });
    } else {
      // OpenAI: Whisper con la misma clave, como ya hacia el pipeline antiguo.
      const archivo = await toFile(p.audio.buffer, p.audio.fileName || "audio.ogg", { type: p.audio.mimetype });
      const resultado = await cliente.audio.transcriptions.create({ model: "whisper-1", file: archivo });
      transcripcion = (resultado.text || "").trim();
    }
  }

  const textoUsuario = [p.texto, transcripcion].filter(Boolean).join("\n");
  if (textoUsuario) contenido.unshift({ type: "text", text: textoUsuario });
  if (p.imagen) {
    contenido.push({
      type: "image_url",
      image_url: { url: `data:${p.imagen.mimetype};base64,${p.imagen.buffer.toString("base64")}` }
    });
  }

  const mensajes: any[] = [
    { role: "system", content: p.promptSistema },
    ...p.historial.map(t => ({ role: t.role, content: t.text })),
    { role: "user", content: contenido.length === 1 && contenido[0].type === "text" ? contenido[0].text : contenido }
  ];

  const parametros: Record<string, unknown> = {
    model: p.model,
    messages: mensajes,
    max_tokens: p.maxTokens,
    temperature: p.temperature
  };
  if (p.usarHerramientas) {
    parametros.tools = [
      {
        type: "function",
        function: {
          name: HERRAMIENTA_TRANSFERIR,
          description: DESCRIPCION_TRANSFERIR,
          parameters: { type: "object", properties: { motivo: { type: "string" } } }
        }
      }
    ];
  }

  for (let intento = 0; intento < 4; intento++) {
    try {
      const respuesta: any = await cliente.chat.completions.create(parametros as any);
      const mensaje = respuesta.choices?.[0]?.message || {};
      const transferir = (mensaje.tool_calls || []).some((t: any) => t?.function?.name === HERRAMIENTA_TRANSFERIR);
      return { texto: String(mensaje.content || ""), transferir, transcripcion };
    } catch (err) {
      if (!reintentarSinParametro(err, parametros)) throw err;
    }
  }
  throw new Error("AI_PROVIDER_RETRIES_EXHAUSTED");
};

/**
 * Gemini exige que el historial empiece por el usuario. Con una ventana de
 * los ultimos N mensajes (o tras un seguimiento) puede empezar por el agente:
 * esos primeros mensajes se pasan como nota de contexto en un turno de
 * usuario, sin atribuirle al cliente algo que no dijo. Los turnos seguidos
 * del mismo rol se unen en uno.
 */
export const historialGemini = (turnos: TurnoHistorial[]): Content[] => {
  const contenido: Content[] = [];
  let i = 0;
  const iniciales: string[] = [];
  while (i < turnos.length && turnos[i].role === "assistant") iniciales.push(turnos[i++].text);
  if (iniciales.length) {
    contenido.push({
      role: "user",
      parts: [{ text: `(Contexto: antes de esto el asistente habia escrito: ${iniciales.join("\n")})` }]
    });
  }
  for (; i < turnos.length; i++) {
    const rol = turnos[i].role === "assistant" ? "model" : "user";
    const ultimo = contenido[contenido.length - 1];
    if (ultimo && ultimo.role === rol) ultimo.parts.push({ text: turnos[i].text });
    else contenido.push({ role: rol, parts: [{ text: turnos[i].text }] });
  }
  return contenido;
};

const generarGemini = async (p: PeticionProveedor): Promise<RespuestaProveedor> => {
  const cliente = new GoogleGenerativeAI(p.apiKey);
  const modelo = cliente.getGenerativeModel(
    {
      model: p.model,
      systemInstruction: p.promptSistema,
      generationConfig: { temperature: p.temperature, maxOutputTokens: p.maxTokens },
      tools: p.usarHerramientas
        ? [
            {
              functionDeclarations: [
                {
                  name: HERRAMIENTA_TRANSFERIR,
                  description: DESCRIPCION_TRANSFERIR,
                  parameters: { type: SchemaType.OBJECT, properties: { motivo: { type: SchemaType.STRING } } }
                }
              ]
            }
          ]
        : undefined
    },
    p.baseURL ? { baseUrl: p.baseURL } : undefined
  );

  const historial = historialGemini(p.historial);

  const partes: Part[] = [];
  if (p.texto) partes.push({ text: p.texto });
  if (p.audio) partes.push({ inlineData: { mimeType: p.audio.mimetype.split(";")[0], data: p.audio.buffer.toString("base64") } });
  if (p.imagen) partes.push({ inlineData: { mimeType: p.imagen.mimetype, data: p.imagen.buffer.toString("base64") } });
  if (!partes.length) partes.push({ text: "" });

  const chat = modelo.startChat({ history: historial });
  const resultado = await chat.sendMessage(partes);
  const respuesta = resultado.response;
  const llamadas = respuesta.functionCalls?.() || [];
  const transferir = llamadas.some(l => l.name === HERRAMIENTA_TRANSFERIR);
  const texto = (respuesta.candidates?.[0]?.content?.parts || [])
    .map(parte => (parte as any).text || "")
    .join("")
    .trim();
  return { texto, transferir };
};

export const llamarProveedor = (p: PeticionProveedor): Promise<RespuestaProveedor> =>
  p.provider === "gemini" ? generarGemini(p) : generarCompatibleOpenAi(p);
