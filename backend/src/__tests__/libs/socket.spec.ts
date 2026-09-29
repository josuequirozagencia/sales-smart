import { sign } from "jsonwebtoken";
import authConfig from "../../config/auth";
import { initIO } from "../../libs/socket";

// Quien puede emitir los eventos de WhatsApp Oficial por el socket.
//
// receivedMessageWhatsAppOficial crea contacto, ticket, mensaje y atribucion
// de anuncio (ctwa_clid) sin mas prueba que el token de la conexion. Antes lo
// aceptaba de cualquier socket conectado, tambien del JWT de un usuario
// normal. Solo api_oficial, con TOKEN_API_OFICIAL, debe poder mandarlo.
//
// Sin servidor ni base de datos: se sustituye socket.io para quedarse con el
// handler de "connection" y se le pasa un socket falso que anota que eventos
// registra y si lo desconectan.

let mockOnConnection: (socket: any) => void;
const mockGetMessage = jest.fn();
const mockReadMessage = jest.fn();
const mockWarn = jest.fn();

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    of: () => ({
      on: (_evento: string, handler: (socket: any) => void) => {
        mockOnConnection = handler;
      }
    })
  }))
}));
jest.mock("@socket.io/admin-ui", () => ({ instrument: jest.fn() }));
jest.mock("../../models/User", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(), findAll: jest.fn(), update: jest.fn() }
}));
jest.mock("../../services/BirthdayService/BirthdayService", () => ({
  __esModule: true,
  default: { getTodayBirthdaysForCompany: jest.fn() }
}));
jest.mock("../../services/WhatsAppOficial/ReceivedWhatsApp", () => ({
  ReceibedWhatsAppService: jest.fn().mockImplementation(() => ({
    getMessage: mockGetMessage,
    readMessage: mockReadMessage
  }))
}));
jest.mock("../../utils/logger", () => ({
  __esModule: true,
  // socket.ts importa el logger al cargarse, antes de que mockWarn exista.
  default: { info: jest.fn(), error: jest.fn(), warn: (...args: any[]) => mockWarn(...args) }
}));

const TOKEN_API = "token-compartido-con-api-oficial";
const PAYLOAD = { token: "token-de-la-conexion", fromNumber: "5930000000", companyId: 1 };

const jwtDeUsuario = (companyId: number, opciones: object = { expiresIn: "15m" }) =>
  sign({ id: 2, profile: "user", companyId }, authConfig.secret, opciones);

const conectar = (tokenQuery: string, namespace = "/1") => {
  const handlers: Record<string, (...args: any[]) => void> = {};
  const socket = {
    handshake: { query: { token: tokenQuery } },
    nsp: { name: namespace },
    on: jest.fn((evento: string, handler: any) => {
      handlers[evento] = handler;
    }),
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
    broadcast: { to: jest.fn(() => ({ emit: jest.fn() })) },
    disconnect: jest.fn()
  };
  mockOnConnection(socket);
  // Lo que pasaria si el cliente emite el evento: se ejecuta el handler
  // registrado, si lo hay.
  const emitir = (evento: string, data: any) => handlers[evento]?.(data);
  return { socket, emitir };
};

beforeAll(() => {
  initIO({} as any);
});

beforeEach(() => {
  process.env.TOKEN_API_OFICIAL = TOKEN_API;
});

afterAll(() => {
  delete process.env.TOKEN_API_OFICIAL;
});

describe("eventos de WhatsApp Oficial", () => {
  it("un usuario con JWT valido no puede crear mensajes ni lecturas", () => {
    const { socket, emitir } = conectar(`Bearer ${jwtDeUsuario(1)}`);

    expect(socket.disconnect).not.toHaveBeenCalled();
    emitir("receivedMessageWhatsAppOficial", PAYLOAD);
    emitir("readMessageWhatsAppOficial", { ...PAYLOAD, messageId: "wamid.1" });

    expect(mockGetMessage).not.toHaveBeenCalled();
    expect(mockReadMessage).not.toHaveBeenCalled();
    // Queda anotado: un cliente legitimo nunca emite estos eventos.
    expect(mockWarn).toHaveBeenCalledTimes(2);
  });

  it("api_oficial con TOKEN_API_OFICIAL si los entrega al servicio", () => {
    const { socket, emitir } = conectar(`Bearer ${TOKEN_API}`);

    expect(socket.disconnect).not.toHaveBeenCalled();
    emitir("receivedMessageWhatsAppOficial", PAYLOAD);
    emitir("readMessageWhatsAppOficial", { ...PAYLOAD, messageId: "wamid.1" });

    expect(mockGetMessage).toHaveBeenCalledWith(PAYLOAD);
    expect(mockReadMessage).toHaveBeenCalledWith({ ...PAYLOAD, messageId: "wamid.1" });
  });

  it("registra los handlers sin esperar a nada: api_oficial emite nada mas conectar", () => {
    const { socket } = conectar(`Bearer ${TOKEN_API}`);

    const eventos = socket.on.mock.calls.map(([evento]: [string]) => evento);
    expect(eventos).toContain("receivedMessageWhatsAppOficial");
    expect(eventos).toContain("readMessageWhatsAppOficial");
  });

  it("con TOKEN_API_OFICIAL vacio nadie pasa por api_oficial", () => {
    process.env.TOKEN_API_OFICIAL = "";

    const { socket, emitir } = conectar("Bearer cualquier-cosa");
    emitir("receivedMessageWhatsAppOficial", PAYLOAD);

    expect(socket.disconnect).toHaveBeenCalled();
    expect(mockGetMessage).not.toHaveBeenCalled();
  });

  it("otro token que no es el de api_oficial ni un JWT se desconecta", () => {
    const { socket, emitir } = conectar(`Bearer ${TOKEN_API}x`);
    emitir("receivedMessageWhatsAppOficial", PAYLOAD);

    expect(socket.disconnect).toHaveBeenCalled();
    expect(mockGetMessage).not.toHaveBeenCalled();
  });
});

describe("autenticacion del socket de usuario", () => {
  it("desconecta un JWT de otra empresa", () => {
    const { socket } = conectar(`Bearer ${jwtDeUsuario(1)}`, "/2");
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it("desconecta un JWT caducado de otra empresa", () => {
    const caducado = jwtDeUsuario(1, { expiresIn: -60 });
    const { socket } = conectar(`Bearer ${caducado}`, "/2");
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it("mantiene un JWT caducado de su empresa: el frontend reconecta con el token viejo", () => {
    const caducado = jwtDeUsuario(1, { expiresIn: -60 });
    const { socket } = conectar(`Bearer ${caducado}`, "/1");
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it("desconecta un JWT firmado con otro secreto aunque diga ser de la empresa", () => {
    const falso = sign({ id: 2, companyId: 1 }, `${authConfig.secret}-otro`);
    const { socket } = conectar(`Bearer ${falso}`, "/1");
    expect(socket.disconnect).toHaveBeenCalled();
  });
});
