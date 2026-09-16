// El entorno node de esta version de Jest no expone fetch: openai necesita su shim.
import "openai/shims/node";
// Y el SDK de Gemini usa fetch global (Node 20 lo trae; el entorno de Jest 27, no).
import nodeFetch, { Headers as NodeHeaders, Request as NodeRequest, Response as NodeResponse } from "node-fetch";
if (!(global as any).fetch) {
  Object.assign(global, { fetch: nodeFetch, Headers: NodeHeaders, Request: NodeRequest, Response: NodeResponse });
}
import http from "http";
import { AddressInfo } from "net";
import AiAgent from "../../models/AiAgent";
import AiAgentChannel from "../../models/AiAgentChannel";
import Company from "../../models/Company";
import Whatsapp from "../../models/Whatsapp";
import { decrypt } from "../../helpers/SecretBox";
import {
  actualizarAgente,
  asignarCanales,
  canalesDisponibles,
  crearAgente,
  credencialesDe,
  listarAgentes,
  normalizarDatos,
  serializar,
  validarHorario,
  validarSeguimientos,
  verAgente
} from "../../services/AiAgentServices/AiAgentService";
import {
  dividirEnBloques,
  extraerMarcadorTransferencia,
  pausaParaBloque,
  recortarCaracteres
} from "../../services/AiAgentServices/PostProceso";
import {
  construirPromptSistema,
  generarRespuesta,
  MENSAJE_SOLO_TEXTO
} from "../../services/AiAgentServices/AiAgentEngine";
import { olvidarCatalogoOpenRouter } from "../../services/AiAgentServices/Capacidades";
import { listarModelos, olvidarModelos } from "../../services/AiAgentServices/ModelosDisponibles";
import { closeConnection, getSeededCompany, uniqueSuffix } from "../helpers/db";

// Agentes IA (docs/AGENTES_IA.md).
//
// Lo que no se negocia y aqui se prueba: la clave del proveedor no sale nunca
// por la API (solo sus 4 ultimos caracteres), ninguna empresa ve ni toca los
// agentes o conexiones de otra, un canal no puede tener dos agentes, y el motor
// hace lo mismo con cualquier proveedor. Ningun test llama a OpenAI, Gemini ni
// OpenRouter: un servidor local habla sus protocolos y anota lo que recibe.

const COMPANY_A = 1;
const CLAVE = "sk-clave-de-prueba-no-real-ABCD";

// ---------------------------------------------------------------------------
// Servidor falso con los protocolos de OpenAI/OpenRouter y Gemini
// ---------------------------------------------------------------------------

type Peticion = { metodo: string; ruta: string; cuerpo: any; crudo: string };
let servidor: http.Server;
let base = "";
let peticiones: Peticion[] = [];
let responder: (p: Peticion) => { status?: number; json: any } = () => ({ json: {} });

const respuestaChat = (content: string | null, toolCalls?: any[]) => ({
  id: "x",
  object: "chat.completion",
  created: 0,
  model: "m",
  choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content, tool_calls: toolCalls } }]
});

const respuestaGemini = (parts: any[]) => ({
  candidates: [{ index: 0, finishReason: "STOP", content: { role: "model", parts } }]
});

beforeAll(async () => {
  servidor = http.createServer((req, res) => {
    const trozos: Buffer[] = [];
    req.on("data", c => trozos.push(c));
    req.on("end", () => {
      const crudo = Buffer.concat(trozos).toString("utf8");
      let cuerpo: any = null;
      try {
        cuerpo = JSON.parse(crudo);
      } catch (e) {
        cuerpo = null;
      }
      const peticion = { metodo: req.method || "", ruta: req.url || "", cuerpo, crudo };
      peticiones.push(peticion);
      const { status = 200, json } = responder(peticion);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    });
  });
  await new Promise<void>(ok => servidor.listen(0, "127.0.0.1", () => ok()));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  await getSeededCompany();
});

afterAll(async () => {
  await new Promise<void>(ok => servidor.close(() => ok()));
  await closeConnection();
});

beforeEach(() => {
  peticiones = [];
  olvidarCatalogoOpenRouter();
  olvidarModelos();
});

const configBase = (extra: Record<string, unknown> = {}) => ({
  provider: "openai" as const,
  model: "gpt-prueba",
  apiKey: CLAVE,
  systemPrompt: "Eres el asistente de una academia.",
  knowledgeText: "El curso cuesta 100 USD.",
  temperature: 0.5,
  maxTokens: 300,
  maxCharacters: null,
  dividirRespuestas: false,
  cantidadBloques: 2,
  escuchaAudio: false,
  leeImagenes: false,
  ...extra
});

// ---------------------------------------------------------------------------
describe("Validacion y serializacion", () => {
  it("cifra la clave, guarda sus 4 ultimos caracteres y exige clave al crear", () => {
    const campos = normalizarDatos({ name: "Ventas", provider: "openai", model: "gpt-4o", apiKey: CLAVE });
    expect(campos.apiKey).not.toContain(CLAVE);
    expect(decrypt(campos.apiKey as string)).toBe(CLAVE);
    expect(campos.apiKeyLast4).toBe("ABCD");
    expect(() => normalizarDatos({ name: "Ventas", provider: "openai", model: "gpt-4o" })).toThrow(
      "ERR_AI_AGENT_API_KEY_REQUIRED"
    );
  });

  it("al editar sin clave conserva la guardada y lo que no se envia", () => {
    const base = normalizarDatos({ name: "Ventas", provider: "gemini", model: "gemini-2.0-flash", apiKey: CLAVE, temperature: 1.2 });
    const editado = normalizarDatos({ name: "Ventas 2" }, base as any);
    expect(editado.apiKey).toBeUndefined();
    expect(editado.name).toBe("Ventas 2");
    expect(editado.provider).toBe("gemini");
    expect(editado.temperature).toBe(1.2);
  });

  it("rechaza proveedor, bloques, caracteres y seguimientos fuera de rango", () => {
    const ok = { name: "A", provider: "openai", model: "m", apiKey: CLAVE };
    expect(() => normalizarDatos({ ...ok, provider: "anthropic" })).toThrow("ERR_AI_AGENT_INVALID_PROVIDER");
    expect(() => normalizarDatos({ ...ok, cantidadBloques: 4 })).toThrow("ERR_AI_AGENT_INVALID_BLOCKS");
    expect(() => normalizarDatos({ ...ok, maxCharacters: 5 })).toThrow("ERR_AI_AGENT_INVALID_MAX_CHARACTERS");
    const seis = Array.from({ length: 6 }, () => ({ when: { amount: 1, unit: "hours" }, mode: "manual", content: "hola" }));
    expect(() => validarSeguimientos(seis)).toThrow("ERR_AI_AGENT_INVALID_FOLLOW_UPS");
    expect(() => validarSeguimientos([{ when: { amount: 0, unit: "hours" }, mode: "ia", content: "x" }])).toThrow();
    expect(validarSeguimientos([{ when: { amount: 2, unit: "days" }, mode: "ia", content: " seguimiento " }])).toEqual([
      { when: { amount: 2, unit: "days" }, mode: "ia", content: "seguimiento" }
    ]);
  });

  it("valida el horario: 24/7, dias sin repetir y tramos con inicio antes del fin", () => {
    expect(validarHorario(undefined)).toEqual({ mode: "24/7" });
    expect(() => validarHorario({ mode: "custom", days: [{ day: 1, enabled: true, start: "18:00", end: "09:00" }] })).toThrow();
    expect(() =>
      validarHorario({ mode: "custom", days: [{ day: 1, enabled: true, start: "09:00", end: "18:00" }, { day: 1, enabled: false, start: "", end: "" }] })
    ).toThrow();
    const h = validarHorario({ mode: "custom", days: [{ day: 5, enabled: true, start: "09:00", end: "13:00" }, { day: 1, enabled: true, start: "08:30", end: "17:00" }] });
    expect(h.days!.map(d => d.day)).toEqual([1, 5]);
  });

  it("la serializacion nunca incluye claves: solo si hay y sus 4 ultimos caracteres", () => {
    const agente = { id: 1, name: "A", provider: "openai", model: "m", apiKey: "cifrada", apiKeyLast4: "ABCD", voiceKey: "cifrada2", voiceKeyLast4: "WXYZ", schedule: { mode: "24/7" }, followUps: [] } as any;
    const json = JSON.stringify(serializar(agente));
    expect(json).not.toContain("cifrada");
    const s = serializar(agente);
    expect(s.hasApiKey).toBe(true);
    expect(s.keyLast4).toBe("ABCD");
    expect(s.voiceKeyLast4).toBe("WXYZ");
    expect(Object.keys(s)).not.toContain("apiKey");
    expect(Object.keys(s)).not.toContain("voiceKey");
  });
});

// ---------------------------------------------------------------------------
describe("Post-proceso de la respuesta", () => {
  it("detecta el marcador literal de transferencia y lo quita del texto", () => {
    expect(extraerMarcadorTransferencia("Ação: Transferir para o setor de atendimento Te paso con el equipo.")).toEqual({
      texto: "Te paso con el equipo.",
      transferir: true
    });
    expect(extraerMarcadorTransferencia("Hola, ¿en qué te ayudo?").transferir).toBe(false);
  });

  it("maxCharacters corta en fin de oracion o sin partir palabras", () => {
    const texto = "Primera frase completa. Segunda frase que es bastante mas larga que la primera.";
    expect(recortarCaracteres(texto, 40)).toBe("Primera frase completa.");
    expect(recortarCaracteres("palabra ".repeat(20).trim(), 30)).toMatch(/^palabra( palabra)*…$/);
    expect(recortarCaracteres(texto, null)).toBe(texto);
  });

  it("divide en hasta N bloques sin inventar bloques ni reordenar", () => {
    const tres = "Hola Ana. Tenemos cursos de marketing y ventas. El proximo empieza el lunes. ¿Quieres que te reserve plaza?";
    const bloques = dividirEnBloques(tres, 3);
    expect(bloques).toHaveLength(3);
    expect(bloques.join(" ")).toBe(tres);
    expect(dividirEnBloques("Una sola frase.", 3)).toEqual(["Una sola frase."]);
    expect(dividirEnBloques("Parrafo uno.\n\nParrafo dos.\n\nParrafo tres.", 2)).toHaveLength(2);
    expect(pausaParaBloque("x")).toBe(1000);
    expect(pausaParaBloque("x".repeat(500))).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
describe("Motor contra proveedores (servidor falso)", () => {
  it("OpenAI: prompt con conocimiento, herramienta de transferencia y bloques", async () => {
    responder = () => ({
      json: respuestaChat("Te paso con una persona del equipo. Enseguida te atienden.", [
        { id: "t1", type: "function", function: { name: "transferir_a_humano", arguments: "{}" } }
      ])
    });
    const r = await generarRespuesta(
      configBase({ dividirRespuestas: true, cantidadBloques: 2 }),
      { historial: [{ role: "user", text: "hola" }, { role: "assistant", text: "¡Hola!" }], texto: "quiero hablar con alguien", nombreCliente: "Ana" },
      { baseURL: base }
    );
    expect(r.transferir).toBe(true);
    expect(r.bloques).toEqual(["Te paso con una persona del equipo.", "Enseguida te atienden."]);
    const cuerpo = peticiones.find(p => p.ruta.endsWith("/chat/completions"))!.cuerpo;
    expect(cuerpo.tools[0].function.name).toBe("transferir_a_humano");
    expect(cuerpo.messages[0].content).toContain("El curso cuesta 100 USD.");
    expect(cuerpo.messages[0].content).toContain("Ana");
    expect(cuerpo.messages.slice(1).map((m: any) => m.role)).toEqual(["user", "assistant", "user"]);
  });

  it("OpenAI: si el modelo rechaza max_tokens reintenta con max_completion_tokens", async () => {
    responder = p =>
      p.cuerpo?.max_tokens !== undefined
        ? { status: 400, json: { error: { message: "Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead." } } }
        : { json: respuestaChat("Listo.") };
    const r = await generarRespuesta(configBase(), { historial: [], texto: "hola" }, { baseURL: base });
    expect(r.texto).toBe("Listo.");
    const ultimo = peticiones[peticiones.length - 1].cuerpo;
    expect(ultimo.max_completion_tokens).toBe(300);
    expect(ultimo.max_tokens).toBeUndefined();
  });

  it("OpenAI: con leeImagenes manda la imagen; sin el, no la manda y lo avisa", async () => {
    responder = () => ({ json: respuestaChat("Veo un recibo.") });
    const imagen = { buffer: Buffer.from("png"), mimetype: "image/png" };
    await generarRespuesta(configBase({ leeImagenes: true }), { historial: [], texto: "mira", imagen }, { baseURL: base });
    const partes = peticiones[0].cuerpo.messages[1].content;
    expect(partes.find((x: any) => x.type === "image_url").image_url.url).toMatch(/^data:image\/png;base64,/);

    peticiones = [];
    const r = await generarRespuesta(configBase({ leeImagenes: false }), { historial: [], imagen }, { baseURL: base });
    expect(peticiones).toHaveLength(0);
    expect(r.avisos).toContain("IMAGE_DISABLED");
    expect(r.bloques).toEqual([MENSAJE_SOLO_TEXTO]);
  });

  it("OpenAI: el audio se transcribe con Whisper y la respuesta usa la transcripcion", async () => {
    responder = p =>
      p.ruta.endsWith("/audio/transcriptions") ? { json: { text: "cuanto cuesta el curso" } } : { json: respuestaChat("Cuesta 100 USD.") };
    const r = await generarRespuesta(
      configBase({ escuchaAudio: true }),
      { historial: [], audio: { buffer: Buffer.from("ogg"), mimetype: "audio/ogg", fileName: "nota.ogg" } },
      { baseURL: base }
    );
    expect(r.transcripcion).toBe("cuanto cuesta el curso");
    expect(r.texto).toBe("Cuesta 100 USD.");
    expect(peticiones.find(p => p.ruta.endsWith("/audio/transcriptions"))!.crudo).toContain("whisper-1");
    expect(peticiones.find(p => p.ruta.endsWith("/chat/completions"))!.cuerpo.messages[1].content).toContain("cuanto cuesta el curso");
  });

  it("OpenRouter: sin tools en el modelo usa el marcador literal; imagen no soportada se avisa", async () => {
    responder = p => {
      if (p.ruta.endsWith("/models")) {
        return { json: { data: [{ id: "vendor/solo-texto", architecture: { input_modalities: ["text"] }, supported_parameters: ["temperature"] }] } };
      }
      return { json: respuestaChat("Ação: Transferir para o setor de atendimento Un compañero te escribe ahora.") };
    };
    const r = await generarRespuesta(
      configBase({ provider: "openrouter", model: "vendor/solo-texto", leeImagenes: true }),
      { historial: [], texto: "necesito ayuda", imagen: { buffer: Buffer.from("png"), mimetype: "image/png" } },
      { baseURL: base }
    );
    const chat = peticiones.find(p => p.ruta.endsWith("/chat/completions"))!.cuerpo;
    expect(chat.tools).toBeUndefined();
    expect(chat.messages[0].content).toContain("Ação: Transferir para o setor de atendimento");
    expect(JSON.stringify(chat.messages)).not.toContain("image_url");
    expect(r.avisos).toContain("IMAGE_UNSUPPORTED");
    expect(r.transferir).toBe(true);
    expect(r.texto).toBe("Un compañero te escribe ahora.");
  });

  it("Gemini: llamada a funcion de transferencia y texto de la respuesta", async () => {
    responder = () => ({
      json: respuestaGemini([{ text: "Te comunico con el equipo." }, { functionCall: { name: "transferir_a_humano", args: {} } }])
    });
    const r = await generarRespuesta(
      configBase({ provider: "gemini", model: "gemini-prueba" }),
      { historial: [{ role: "assistant", text: "Hola" }], texto: "quiero un humano" },
      { baseURL: base }
    );
    expect(r.transferir).toBe(true);
    expect(r.texto).toBe("Te comunico con el equipo.");
    const p = peticiones[0];
    expect(p.ruta).toContain("gemini-prueba:generateContent");
    expect(p.cuerpo.systemInstruction.parts[0].text).toContain("El curso cuesta 100 USD.");
    expect(p.cuerpo.tools[0].functionDeclarations[0].name).toBe("transferir_a_humano");
    // El historial empezaba por el agente: Gemini lo rechaza, asi que va como nota de contexto.
    expect(p.cuerpo.contents[0].role).toBe("user");
    expect(p.cuerpo.contents[0].parts[0].text).toContain("Hola");
    expect(p.cuerpo.contents[p.cuerpo.contents.length - 1].parts[0].text).toBe("quiero un humano");
  });

  it("el prompt de sistema cambia la regla de transferencia segun haya herramientas", () => {
    expect(construirPromptSistema({ systemPrompt: "x" }, { conHerramientas: true })).toContain("transferir_a_humano");
    expect(construirPromptSistema({ systemPrompt: "x" }, { conHerramientas: false })).toContain("Ação: Transferir");
  });
});

// ---------------------------------------------------------------------------
describe("Modelos que ofrece cada proveedor", () => {
  it("OpenAI: solo los de conversacion, ordenados y sin repetir", async () => {
    responder = () => ({
      json: {
        data: [
          { id: "gpt-4o-mini" },
          { id: "gpt-4o" },
          { id: "text-embedding-3-small" },
          { id: "whisper-1" },
          { id: "dall-e-3" },
          { id: "o3-mini" }
        ]
      }
    });
    const r = await listarModelos(COMPANY_A, "openai", CLAVE, { baseURL: base });
    expect(r.models).toEqual(["gpt-4o", "gpt-4o-mini", "o3-mini"]);
    expect(r.avisos).toEqual([]);
  });

  it("Gemini: solo los que generan contenido", async () => {
    responder = () => ({
      json: {
        models: [
          { name: "models/gemini-2.0-flash", supportedGenerationMethods: ["generateContent"] },
          { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] }
        ]
      }
    });
    const r = await listarModelos(COMPANY_A, "gemini", CLAVE, { baseURL: base });
    expect(r.models).toEqual(["gemini-2.0-flash"]);
  });

  it("OpenRouter no necesita clave; una clave invalida se avisa sin romper", async () => {
    responder = () => ({ json: { data: [{ id: "anthropic/claude-3.5-sonnet" }, { id: "openai/gpt-4o" }] } });
    const sinClave = await listarModelos(COMPANY_A, "openrouter", "", { baseURL: base });
    expect(sinClave.models).toEqual(["anthropic/claude-3.5-sonnet", "openai/gpt-4o"]);

    olvidarModelos();
    responder = () => ({ status: 401, json: { error: { message: "Incorrect API key" } } });
    const r = await listarModelos(COMPANY_A, "openai", CLAVE, { baseURL: base });
    expect(r.models).toEqual([]);
    expect(r.avisos).toEqual(["INVALID_API_KEY"]);
  });

  it("sin clave y sin agente, OpenAI y Gemini lo piden en vez de fallar", async () => {
    const r = await listarModelos(COMPANY_A, "openai", "", { baseURL: base });
    expect(r).toEqual({ provider: "openai", models: [], avisos: ["API_KEY_REQUIRED"] });
  });
});

// ---------------------------------------------------------------------------
describe("Agentes en base de datos", () => {
  let empresaB: Company;
  const conexiones: Whatsapp[] = [];

  beforeAll(async () => {
    empresaB = await Company.create({ name: `agentes-b-${uniqueSuffix()}`, planId: 1, status: true } as any);
    for (const [companyId, channel] of [[COMPANY_A, "whatsapp"], [COMPANY_A, "whatsapp_oficial"], [COMPANY_A, "ghl"], [empresaB.id, "facebook"]] as [number, string][]) {
      conexiones.push(
        await Whatsapp.create({ name: `conexion-${channel}-${uniqueSuffix()}`, channel, companyId, status: "CONNECTED", isDefault: false } as any)
      );
    }
  });

  afterAll(async () => {
    await AiAgent.destroy({ where: { companyId: [COMPANY_A, empresaB.id] } });
    await Whatsapp.destroy({ where: { id: conexiones.map(c => c.id) } });
    await empresaB.destroy();
  });

  it("crea, lista y edita sin exponer la clave; otra empresa no lo ve", async () => {
    const creado = await crearAgente(COMPANY_A, { name: `Agente ${uniqueSuffix()}`, provider: "openai", model: "gpt-4o", apiKey: CLAVE, maxCharacters: 400 });
    expect(JSON.stringify(creado)).not.toContain(CLAVE);
    expect(creado.keyLast4).toBe("ABCD");

    const fila = await AiAgent.findByPk(creado.id!);
    expect(fila!.apiKey).not.toContain(CLAVE);
    expect(credencialesDe(fila!).apiKey).toBe(CLAVE);

    const editado = await actualizarAgente(COMPANY_A, creado.id!, { systemPrompt: "nuevo" });
    expect(editado.systemPrompt).toBe("nuevo");
    expect(editado.keyLast4).toBe("ABCD");

    expect((await listarAgentes(empresaB.id)).map(a => a.id)).not.toContain(creado.id);
    await expect(verAgente(empresaB.id, creado.id!)).rejects.toMatchObject({ message: "ERR_AI_AGENT_NOT_FOUND" });
    await expect(actualizarAgente(empresaB.id, creado.id!, { name: "robado" })).rejects.toMatchObject({
      message: "ERR_AI_AGENT_NOT_FOUND"
    });
  });

  it("asigna canales: rechaza GHL, conexiones de otra empresa y canales ya ocupados", async () => {
    const [baileys, oficial, ghl, deOtra] = conexiones;
    const uno = await crearAgente(COMPANY_A, { name: `Uno ${uniqueSuffix()}`, provider: "openai", model: "m", apiKey: CLAVE });
    const dos = await crearAgente(COMPANY_A, { name: `Dos ${uniqueSuffix()}`, provider: "gemini", model: "m", apiKey: CLAVE });

    const conCanales = await asignarCanales(COMPANY_A, uno.id!, [baileys.id, oficial.id]);
    expect(conCanales.channels.map(c => c.whatsappId).sort()).toEqual([baileys.id, oficial.id].sort());

    await expect(asignarCanales(COMPANY_A, uno.id!, [ghl.id])).rejects.toMatchObject({ message: "ERR_AI_AGENT_INVALID_CHANNEL" });
    await expect(asignarCanales(COMPANY_A, uno.id!, [deOtra.id])).rejects.toMatchObject({ message: "ERR_AI_AGENT_INVALID_CHANNEL" });
    await expect(asignarCanales(COMPANY_A, dos.id!, [oficial.id])).rejects.toMatchObject({
      message: "ERR_AI_AGENT_CHANNEL_TAKEN",
      statusCode: 409
    });

    const soloOficial = await asignarCanales(COMPANY_A, uno.id!, [oficial.id]);
    expect(soloOficial.channels.map(c => c.whatsappId)).toEqual([oficial.id]);
    const ahoraDos = await asignarCanales(COMPANY_A, dos.id!, [baileys.id]);
    expect(ahoraDos.channels.map(c => c.whatsappId)).toEqual([baileys.id]);

    const disponibles = await canalesDisponibles(COMPANY_A);
    expect(disponibles.find(c => c.whatsappId === ghl.id)).toBeUndefined();
    expect(disponibles.find(c => c.whatsappId === baileys.id)!.agentId).toBe(dos.id);
    expect(disponibles.find(c => c.whatsappId === deOtra.id)).toBeUndefined();
    expect(await AiAgentChannel.count({ where: { whatsappId: deOtra.id } })).toBe(0);
  });
});
