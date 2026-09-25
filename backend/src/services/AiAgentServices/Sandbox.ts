import AiAgent from "../../models/AiAgent";
import AppError from "../../errors/AppError";
import cacheLayer from "../../libs/cache";
import logger from "../../utils/logger";
import { credencialesDe, normalizarDatos, PROVEEDORES } from "./AiAgentService";
import { ConfigMotor, EntradaMotor, generarRespuesta, OpcionesMotor, ResultadoMotor } from "./AiAgentEngine";
import { Adjunto, TurnoHistorial } from "./Proveedores";
import { Capacidades, verificarCapacidades } from "./Capacidades";

/**
 * Chat de prueba del formulario. Responde con la MISMA logica que en
 * produccion (AiAgentEngine), pero sin tocar nada: no crea contactos, ni
 * tickets, ni mensajes, ni programa seguimientos.
 *
 * La configuracion llega del formulario tal como esta en pantalla, aunque no
 * se haya guardado, para poder probar un cambio antes de aplicarlo. La clave
 * solo se envia si se acaba de escribir; si no, se usa la del agente guardado
 * y nunca sale de aqui.
 *
 * El historial vive en Redis con caducidad, por empresa, usuario y sesion: ni
 * se mezcla con el de otra persona ni ensucia la base.
 */

const TTL_SEGUNDOS = 2 * 60 * 60;
const MAX_TURNOS = 40;

export interface EntradaSandbox {
  companyId: number;
  userId: number;
  sessionId: string;
  /** Configuracion del formulario; puede no estar guardada todavia. */
  config: Record<string, any>;
  agentId?: number;
  texto?: string;
  imagen?: Adjunto;
  audio?: Adjunto;
}

export interface RespuestaSandbox {
  bloques: string[];
  texto: string;
  transferir: boolean;
  transcripcion?: string;
  avisos: string[];
  capacidades?: Capacidades;
  historial: TurnoHistorial[];
}

const clave = (companyId: number, userId: number, sessionId: string): string => {
  const limpio = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
  if (!limpio) throw new AppError("ERR_AI_AGENT_INVALID_SESSION", 400);
  return `ai-agent-sandbox:${companyId}:${userId}:${limpio}`;
};

export const leerHistorial = async (companyId: number, userId: number, sessionId: string): Promise<TurnoHistorial[]> => {
  try {
    const guardado = await cacheLayer.get(clave(companyId, userId, sessionId));
    const turnos = guardado ? JSON.parse(guardado) : [];
    return Array.isArray(turnos) ? turnos : [];
  } catch (err) {
    logger.warn(`[AI AGENT] Sandbox sin historial (${(err as Error).message})`);
    return [];
  }
};

const guardarHistorial = async (
  companyId: number,
  userId: number,
  sessionId: string,
  turnos: TurnoHistorial[]
): Promise<void> => {
  try {
    await cacheLayer.set(
      clave(companyId, userId, sessionId),
      JSON.stringify(turnos.slice(-MAX_TURNOS)),
      "EX",
      TTL_SEGUNDOS
    );
  } catch (err) {
    // Sin Redis la prueba sigue funcionando, solo que sin memoria entre turnos.
    logger.warn(`[AI AGENT] Sandbox no pudo guardar el historial: ${(err as Error).message}`);
  }
};

export const reiniciarSandbox = async (companyId: number, userId: number, sessionId: string): Promise<void> => {
  try {
    await cacheLayer.del(clave(companyId, userId, sessionId));
  } catch (err) {
    logger.warn(`[AI AGENT] Sandbox no pudo borrar el historial: ${(err as Error).message}`);
  }
};

/**
 * Configuracion efectiva: lo que hay en el formulario, con la clave del agente
 * guardado cuando no se ha escrito una nueva. Reutiliza la validacion de
 * siempre para que el sandbox no acepte lo que la API rechazaria.
 */
export const configDelFormulario = async (
  companyId: number,
  config: Record<string, any>,
  agentId?: number
): Promise<ConfigMotor> => {
  const guardado = agentId ? await AiAgent.findOne({ where: { id: agentId, companyId } }) : null;
  if (agentId && !guardado) throw new AppError("ERR_AI_AGENT_NOT_FOUND", 404);

  const provider = String(config?.provider || guardado?.provider || "");
  if (!PROVEEDORES.includes(provider as any)) throw new AppError("ERR_AI_AGENT_INVALID_PROVIDER", 400);

  const escrita = typeof config?.apiKey === "string" ? config.apiKey.trim() : "";
  const apiKey = escrita || (guardado ? credencialesDe(guardado).apiKey : "");
  if (!apiKey) throw new AppError("ERR_AI_AGENT_API_KEY_REQUIRED", 400);

  // Valida rangos y tipos igual que al guardar. Se puede probar antes de
  // ponerle nombre al agente: sin nombre, la validacion usa uno provisional.
  const campos = normalizarDatos(
    { ...config, name: String(config?.name || "").trim() || guardado?.name || "Prueba", apiKey },
    guardado || undefined
  );

  return {
    provider: campos.provider!,
    model: campos.model!,
    apiKey,
    systemPrompt: campos.systemPrompt || "",
    knowledgeText: campos.knowledgeText,
    temperature: campos.temperature!,
    maxTokens: campos.maxTokens!,
    maxCharacters: campos.maxCharacters,
    dividirRespuestas: !!campos.dividirRespuestas,
    cantidadBloques: campos.cantidadBloques!,
    escuchaAudio: !!campos.escuchaAudio,
    leeImagenes: !!campos.leeImagenes
  };
};

export const probarMensaje = async (
  entrada: EntradaSandbox,
  opciones: OpcionesMotor = {}
): Promise<RespuestaSandbox> => {
  const config = await configDelFormulario(entrada.companyId, entrada.config, entrada.agentId);
  const historial = await leerHistorial(entrada.companyId, entrada.userId, entrada.sessionId);

  const motor: EntradaMotor = {
    historial,
    texto: entrada.texto,
    imagen: entrada.imagen,
    audio: entrada.audio,
    nombreCliente: String(entrada.config?.testClientName || "").trim() || undefined
  };

  const resultado: ResultadoMotor = await generarRespuesta(config, motor, opciones);

  const dicho = [entrada.texto, resultado.transcripcion].filter(Boolean).join(" ").trim();
  const etiquetas = [entrada.imagen ? "[una imagen]" : "", entrada.audio ? "[un audio]" : ""].filter(Boolean).join(" ");
  const turnoCliente = [etiquetas, dicho].filter(Boolean).join(" ");

  const nuevos: TurnoHistorial[] = [...historial];
  if (turnoCliente) nuevos.push({ role: "user", text: turnoCliente });
  if (resultado.texto) nuevos.push({ role: "assistant", text: resultado.texto });
  await guardarHistorial(entrada.companyId, entrada.userId, entrada.sessionId, nuevos);

  return {
    bloques: resultado.bloques,
    texto: resultado.texto,
    transferir: resultado.transferir,
    transcripcion: resultado.transcripcion,
    avisos: resultado.avisos,
    historial: nuevos
  };
};

/** Que puede hacer el modelo elegido: imagenes, audio y herramientas. */
export const capacidadesDelFormulario = async (
  companyId: number,
  config: Record<string, any>,
  agentId?: number,
  opciones: OpcionesMotor = {}
): Promise<Capacidades> => {
  const efectiva = await configDelFormulario(companyId, config, agentId);
  return verificarCapacidades(efectiva.provider, efectiva.model, efectiva.apiKey, opciones);
};

