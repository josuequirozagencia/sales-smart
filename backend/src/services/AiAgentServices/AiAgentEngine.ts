import { ProveedorIa } from "../../models/AiAgent";
import logger from "../../utils/logger";
import { Capacidades, verificarCapacidades } from "./Capacidades";
import { Adjunto, llamarProveedor, TurnoHistorial } from "./Proveedores";
import {
  dividirEnBloques,
  extraerMarcadorTransferencia,
  MARCADOR_TRANSFERENCIA,
  recortarCaracteres
} from "./PostProceso";

/**
 * Motor de respuesta de un agente. Es el mismo para produccion y para el
 * sandbox: recibe la configuracion, el historial y lo que ha mandado el
 * cliente, y devuelve los bloques a enviar y si hay que transferir. No sabe
 * nada de tickets, contactos ni canales; eso lo hace quien lo llama.
 */

export interface ConfigMotor {
  provider: ProveedorIa;
  model: string;
  apiKey: string;
  systemPrompt: string;
  knowledgeText?: string | null;
  temperature: number;
  maxTokens: number;
  maxCharacters?: number | null;
  dividirRespuestas: boolean;
  cantidadBloques: number;
  escuchaAudio: boolean;
  leeImagenes: boolean;
}

export interface EntradaMotor {
  historial: TurnoHistorial[];
  texto?: string;
  imagen?: Adjunto;
  audio?: Adjunto;
  nombreCliente?: string;
  /**
   * Instruccion para este mensaje concreto sin que el cliente haya escrito,
   * p. ej. un seguimiento. Va al prompt de sistema, no en boca del cliente.
   */
  instruccion?: string;
}

export interface ResultadoMotor {
  texto: string;
  bloques: string[];
  transferir: boolean;
  transcripcion?: string;
  /**
   * Codigos de lo que no se ha podido usar (AUDIO_DISABLED, IMAGE_UNSUPPORTED,
   * MEDIA_REJECTED...). Nunca se descarta nada sin dejarlo aqui y en el log.
   */
  avisos: string[];
}

export interface OpcionesMotor {
  baseURL?: string;
  capacidades?: Capacidades;
}

/** Aviso al cliente cuando manda algo que el agente no puede leer ni escuchar. */
export const MENSAJE_SOLO_TEXTO =
  "Por ahora solo puedo leer mensajes de texto. ¿Me lo puedes escribir, por favor?";

export const construirPromptSistema = (
  config: Pick<ConfigMotor, "systemPrompt" | "knowledgeText">,
  {
    nombreCliente,
    conHerramientas,
    instruccion
  }: { nombreCliente?: string; conHerramientas: boolean; instruccion?: string }
): string => {
  const reglas = [
    nombreCliente ? `El cliente se llama ${nombreCliente}.` : "",
    "Responde en el mismo idioma que use el cliente.",
    conHerramientas
      ? "Si el cliente pide hablar con una persona, o no puedes resolver lo que necesita, dile que lo pasas con el equipo y llama a la herramienta transferir_a_humano."
      : `Si el cliente pide hablar con una persona, o no puedes resolver lo que necesita, empieza tu respuesta con "${MARCADOR_TRANSFERENCIA}" y despues dile que lo pasas con el equipo.`
  ].filter(Boolean);

  return [
    (config.systemPrompt || "").trim(),
    config.knowledgeText
      ? `## Informacion de referencia\nUsa esta informacion para responder. Si algo no esta aqui, no lo inventes.\n\n${config.knowledgeText}`
      : "",
    `## Reglas de la conversacion\n${reglas.map(r => `- ${r}`).join("\n")}`,
    instruccion ? `## Instruccion para este mensaje\n${instruccion.trim()}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
};

export const generarRespuesta = async (
  config: ConfigMotor,
  entrada: EntradaMotor,
  opciones: OpcionesMotor = {}
): Promise<ResultadoMotor> => {
  const avisos: string[] = [];
  let { imagen, audio } = entrada;
  let texto = (entrada.texto || "").trim();

  if (audio && !config.escuchaAudio) {
    audio = undefined;
    avisos.push("AUDIO_DISABLED");
  }
  if (imagen && !config.leeImagenes) {
    imagen = undefined;
    avisos.push("IMAGE_DISABLED");
  }

  let usarHerramientas = true;
  if (config.provider === "openrouter") {
    const capacidades =
      opciones.capacidades || (await verificarCapacidades(config.provider, config.model, config.apiKey, opciones));
    usarHerramientas = capacidades.herramientas !== false;
    if (imagen && capacidades.imagen === false) {
      imagen = undefined;
      avisos.push("IMAGE_UNSUPPORTED");
    }
    if (audio && capacidades.audio === false) {
      audio = undefined;
      avisos.push("AUDIO_UNSUPPORTED");
    }
  }

  const descartado = avisos.some(a => /^(AUDIO|IMAGE)_/.test(a));
  if (!texto && !imagen && !audio && entrada.instruccion) {
    texto = "(El cliente no ha escrito nada nuevo. Sigue la instruccion para este mensaje.)";
  }
  if (!texto && !imagen && !audio) {
    if (descartado) {
      logger.info(`[AI AGENT] Mensaje sin contenido utilizable (${avisos.join(", ")})`);
      return { texto: MENSAJE_SOLO_TEXTO, bloques: [MENSAJE_SOLO_TEXTO], transferir: false, avisos };
    }
    return { texto: "", bloques: [], transferir: false, avisos };
  }
  if (descartado && !texto) texto = "";

  const peticionBase = {
    provider: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    historial: entrada.historial,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    usarHerramientas,
    baseURL: opciones.baseURL
  };

  let respuesta;
  try {
    respuesta = await llamarProveedor({
      ...peticionBase,
      promptSistema: construirPromptSistema(config, {
        nombreCliente: entrada.nombreCliente,
        conHerramientas: usarHerramientas,
        instruccion: entrada.instruccion
      }),
      texto,
      imagen,
      audio
    });
  } catch (err) {
    if (!imagen && !audio) throw err;
    // El proveedor rechazo el adjunto: se contesta igual, sin el, y se deja
    // constancia. El modelo sabe que no pudo verlo y puede pedirlo por escrito.
    logger.warn(`[AI AGENT] El proveedor rechazo el adjunto: ${(err as Error).message}`);
    avisos.push("MEDIA_REJECTED");
    const nota = `(El cliente envio ${audio ? "un audio" : "una imagen"} que no se pudo procesar. Pidele que lo escriba.)`;
    respuesta = await llamarProveedor({
      ...peticionBase,
      promptSistema: construirPromptSistema(config, {
        nombreCliente: entrada.nombreCliente,
        conHerramientas: usarHerramientas,
        instruccion: entrada.instruccion
      }),
      texto: [texto, nota].filter(Boolean).join("\n")
    });
  }

  const marcador = extraerMarcadorTransferencia(respuesta.texto);
  const final = recortarCaracteres(marcador.texto, config.maxCharacters);
  const bloques = !final ? [] : config.dividirRespuestas ? dividirEnBloques(final, config.cantidadBloques) : [final];

  return {
    texto: final,
    bloques,
    transferir: respuesta.transferir || marcador.transferir,
    transcripcion: respuesta.transcripcion,
    avisos
  };
};
