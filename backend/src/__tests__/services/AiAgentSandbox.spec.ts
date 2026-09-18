// El entorno node de esta version de Jest no expone fetch: openai necesita su shim.
import "openai/shims/node";
import http from "http";
import { AddressInfo } from "net";
import Company from "../../models/Company";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import AiAgent from "../../models/AiAgent";
import AiAgentFollowUpJob from "../../models/AiAgentFollowUpJob";
import { crearAgente } from "../../services/AiAgentServices/AiAgentService";
import { leerHistorial, probarMensaje, reiniciarSandbox } from "../../services/AiAgentServices/Sandbox";
import { closeConnection, getSeededCompany, uniqueSuffix } from "../helpers/db";

// Redis en memoria: el sandbox guarda ahi su historial con caducidad.
const memoria = new Map<string, string>();
jest.mock("../../libs/cache", () => ({
  __esModule: true,
  default: {
    get: async (k: string) => memoria.get(k) ?? null,
    set: async (k: string, v: string) => {
      memoria.set(k, v);
      return "OK";
    },
    del: async (k: string) => (memoria.delete(k) ? 1 : 0)
  }
}));

// Chat de prueba del formulario (docs/AGENTES_IA.md). Lo que se protege:
//  - responde con la configuracion que hay en pantalla, sin guardarla;
//  - recuerda la conversacion de esa sesion y se puede reiniciar;
//  - no crea contactos, tickets, mensajes ni seguimientos;
//  - la clave guardada solo la usa el agente de la propia empresa.

const COMPANY_A = 1;
const CLAVE_GUARDADA = "sk-guardada-no-real-WXYZ";

let servidor: http.Server;
let base = "";
let peticiones: { auth: string; cuerpo: any }[] = [];
let respuesta = "Hola, soy el asistente.";
let empresaB: Company;

const configFormulario = (extra: Record<string, unknown> = {}) => ({
  provider: "openai",
  model: "gpt-prueba",
  apiKey: "sk-escrita-en-pantalla-ABCD",
  systemPrompt: "Vendes cursos de ingles.",
  temperature: 0.5,
  maxTokens: 200,
  dividirRespuestas: false,
  ...extra
});

beforeAll(async () => {
  servidor = http.createServer((req, res) => {
    let datos = "";
    req.on("data", c => (datos += c));
    req.on("end", () => {
      peticiones.push({ auth: String(req.headers.authorization || ""), cuerpo: datos ? JSON.parse(datos) : {} });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: respuesta } }] }));
    });
  });
  await new Promise<void>(ok => servidor.listen(0, "127.0.0.1", () => ok()));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  await getSeededCompany();
  empresaB = await Company.create({ name: `sandbox-b-${uniqueSuffix()}`, planId: 1, status: true } as any);
});

beforeEach(() => {
  peticiones = [];
  memoria.clear();
  respuesta = "Hola, soy el asistente.";
});

afterAll(async () => {
  await AiAgent.destroy({ where: { companyId: empresaB.id } });
  await empresaB.destroy();
  await new Promise<void>(ok => servidor.close(() => ok()));
  await closeConnection();
});

describe("Chat de prueba del agente", () => {
  it("responde con la configuracion sin guardar y recuerda la conversacion de la sesion", async () => {
    const primera = await probarMensaje(
      { companyId: COMPANY_A, userId: 1, sessionId: "s1", config: configFormulario(), texto: "Hola" },
      { baseURL: base }
    );
    expect(primera.bloques).toEqual(["Hola, soy el asistente."]);
    expect(peticiones[0].auth).toBe("Bearer sk-escrita-en-pantalla-ABCD");
    expect(peticiones[0].cuerpo.messages[0].content).toContain("Vendes cursos de ingles.");

    respuesta = "El curso cuesta 100 USD.";
    const segunda = await probarMensaje(
      { companyId: COMPANY_A, userId: 1, sessionId: "s1", config: configFormulario(), texto: "Precio?" },
      { baseURL: base }
    );
    expect(segunda.texto).toBe("El curso cuesta 100 USD.");
    const turnos = peticiones[1].cuerpo.messages.map((m: any) => `${m.role}:${m.content}`);
    expect(turnos).toEqual(
      expect.arrayContaining(["user:Hola", "assistant:Hola, soy el asistente.", "user:Precio?"])
    );
    expect(segunda.historial).toHaveLength(4);
  });

  it("no escribe nada en la base: ni contactos, ni tickets, ni mensajes, ni seguimientos", async () => {
    const antes = await Promise.all([Contact.count(), Ticket.count(), Message.count(), AiAgentFollowUpJob.count()]);
    await probarMensaje(
      { companyId: COMPANY_A, userId: 1, sessionId: "s2", config: configFormulario({ followUps: [] }), texto: "Hola" },
      { baseURL: base }
    );
    const despues = await Promise.all([Contact.count(), Ticket.count(), Message.count(), AiAgentFollowUpJob.count()]);
    expect(despues).toEqual(antes);
  });

  it("cada usuario y sesion tiene su propio historial, y reiniciar lo borra", async () => {
    await probarMensaje({ companyId: COMPANY_A, userId: 1, sessionId: "s3", config: configFormulario(), texto: "Hola" }, { baseURL: base });
    expect(await leerHistorial(COMPANY_A, 1, "s3")).toHaveLength(2);
    expect(await leerHistorial(COMPANY_A, 2, "s3")).toHaveLength(0);
    await reiniciarSandbox(COMPANY_A, 1, "s3");
    expect(await leerHistorial(COMPANY_A, 1, "s3")).toHaveLength(0);
  });

  it("sin clave escrita usa la del agente guardado, solo si es de la misma empresa", async () => {
    const agente = await crearAgente(COMPANY_A, {
      name: `Sandbox ${uniqueSuffix()}`,
      provider: "openai",
      model: "gpt-prueba",
      apiKey: CLAVE_GUARDADA
    } as any);
    try {
      await probarMensaje(
        { companyId: COMPANY_A, userId: 1, sessionId: "s4", config: configFormulario({ apiKey: "" }), agentId: agente.id, texto: "Hola" },
        { baseURL: base }
      );
      expect(peticiones[0].auth).toBe(`Bearer ${CLAVE_GUARDADA}`);

      await expect(
        probarMensaje(
          { companyId: empresaB.id, userId: 1, sessionId: "s4", config: configFormulario({ apiKey: "" }), agentId: agente.id, texto: "Hola" },
          { baseURL: base }
        )
      ).rejects.toMatchObject({ message: "ERR_AI_AGENT_NOT_FOUND" });
    } finally {
      await AiAgent.destroy({ where: { id: agente.id } });
    }
  });

  it("sin clave y sin agente pide la clave; se puede probar antes de ponerle nombre", async () => {
    await expect(
      probarMensaje({ companyId: COMPANY_A, userId: 1, sessionId: "s5", config: configFormulario({ apiKey: "" }), texto: "Hola" }, { baseURL: base })
    ).rejects.toMatchObject({ message: "ERR_AI_AGENT_API_KEY_REQUIRED" });

    const sinNombre = await probarMensaje(
      { companyId: COMPANY_A, userId: 1, sessionId: "s5", config: configFormulario({ name: "" }), texto: "Hola" },
      { baseURL: base }
    );
    expect(sinNombre.bloques).toHaveLength(1);
  });
});
