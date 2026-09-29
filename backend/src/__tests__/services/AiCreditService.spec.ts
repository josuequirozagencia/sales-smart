import Company from "../../models/Company";
import AiAgent from "../../models/AiAgent";
import AiCreditAccount from "../../models/AiCreditAccount";
import AiCreditLedger from "../../models/AiCreditLedger";
import AiModelPricing from "../../models/AiModelPricing";
import AiCreditSettings from "../../models/AiCreditSettings";
import { encrypt } from "../../helpers/SecretBox";
import { closeConnection, uniqueSuffix } from "../helpers/db";

jest.mock("../../libs/socket", () => ({ getIO: jest.fn(), emitBirthdayEvents: jest.fn() }));

// eslint-disable-next-line import/first
import {
  calcularCostoMicroCents,
  cuentaDe,
  descontarCredito,
  hayCreditoDisponible,
  otorgarCredito,
  preciosDe,
  resolverClaveDeAgente,
  saldoDe
} from "../../services/AiCreditServices/AiCreditService";

// El credito prepago de los Agentes IA.
//
// Lo que de verdad importa aqui es que no se pierda dinero por ningun lado:
// que lo barato no salga gratis por redondeo, que dos respuestas a la vez no
// se pisen el descuento, que un reintento no cobre dos veces, y que un
// agente con su propia clave no toque nunca el saldo de nadie.

const sufijo = uniqueSuffix();

let empresa: Company;

const nuevaEmpresa = async (nombre: string) =>
  Company.create({ name: `${nombre}-${sufijo}`, planId: 1, status: true } as any);

beforeAll(async () => {
  empresa = await nuevaEmpresa("credito");
});

afterAll(async () => {
  await AiCreditLedger.destroy({ where: {}, truncate: false, force: true });
  await AiCreditAccount.destroy({ where: {}, force: true });
  await AiAgent.destroy({ where: { companyId: empresa.id } });
  await Company.destroy({ where: { name: { [require("sequelize").Op.like]: `%-${sufijo}` } } });
  await closeConnection();
});

describe("calcularCostoMicroCents", () => {
  // gpt-4o-mini: 0,15 dolares el millon de tokens de entrada = 0,000015
  // centavos por token. Mil tokens salen a 0,015 centavos.
  const precios = {
    porUnidad: {
      tokens_input: { precio: 0.000015, margen: null },
      tokens_output: { precio: 0.00006, margen: null }
    }
  };

  it("cobra lo que costo, mas el margen global", () => {
    // 1000 entrada = 0,015 centavos; 500 salida = 0,03. Total 0,045, y con
    // un 20% de margen, 0,054 centavos = 54.000 millonesimas.
    const micro = calcularCostoMicroCents(
      { tokensEntrada: 1000, tokensSalida: 500 },
      precios,
      20
    );

    expect(micro).toBe(54000);
  });

  it("el override del modelo manda sobre el margen global", () => {
    const conOverride = {
      porUnidad: {
        tokens_input: { precio: 0.000015, margen: 100 },
        tokens_output: { precio: 0.00006, margen: null }
      }
    };

    // La entrada dobla por su override del 100%; la salida sigue con el 20%
    // global. 0,015x2 + 0,03x1,2 = 0,066 centavos.
    const micro = calcularCostoMicroCents(
      { tokensEntrada: 1000, tokensSalida: 500 },
      conOverride,
      20
    );

    expect(micro).toBe(66000);
  });

  it("un override de cero margen es cero, no 'sin override'", () => {
    const sinMargen = {
      porUnidad: { tokens_input: { precio: 0.000015, margen: 0 } }
    };

    expect(
      calcularCostoMicroCents({ tokensEntrada: 1000, tokensSalida: 0 }, sinMargen, 50)
    ).toBe(15000);
  });

  it("cobra el audio por minuto, recibiendo segundos", () => {
    const conAudio = {
      porUnidad: { audio_minute: { precio: 0.6, margen: null } }
    };

    // 30 segundos = medio minuto = 0,3 centavos, sin margen.
    expect(
      calcularCostoMicroCents(
        { tokensEntrada: 0, tokensSalida: 0, audioSegundos: 30 },
        conAudio,
        0
      )
    ).toBe(300000);
  });

  it("no cobra por una unidad sin precio configurado", () => {
    expect(
      calcularCostoMicroCents({ tokensEntrada: 5000, tokensSalida: 5000 }, { porUnidad: {} }, 20)
    ).toBe(0);
  });
});

describe("descontarCredito", () => {
  it("no pierde lo barato por redondeo: lo acumula hasta el centavo", async () => {
    // Esta es la razon de que exista el acumulador. Cada descuento vale 0,4
    // centavos: redondeado por mensaje seria cero y todo saldria gratis.
    const suya = await nuevaEmpresa("acumula");
    await otorgarCredito({ companyId: suya.id, amountCents: 100 });

    for (let i = 0; i < 2; i++) {
      await descontarCredito({
        companyId: suya.id,
        microCents: 400000,
        description: "prueba"
      });
    }

    // 0,4 + 0,4 = 0,8 centavos: todavia no llega a uno.
    expect(await saldoDe(suya.id)).toBe(100);

    await descontarCredito({
      companyId: suya.id,
      microCents: 400000,
      description: "prueba"
    });

    // 1,2 centavos acumulados: ya se cobra uno y queda 0,2 pendiente.
    expect(await saldoDe(suya.id)).toBe(99);
  });

  it("deja el saldo en negativo si lo consumido lo supera", async () => {
    // No es un fallo: la respuesta ya se pidio y ya costo. Lo que no se hace
    // es empezar otra, y de eso se encarga hayCreditoDisponible.
    const suya = await nuevaEmpresa("negativo");
    await otorgarCredito({ companyId: suya.id, amountCents: 5 });

    await descontarCredito({
      companyId: suya.id,
      microCents: 20 * 1_000_000,
      description: "una respuesta cara"
    });

    expect(await saldoDe(suya.id)).toBe(-15);
    expect(await hayCreditoDisponible(suya.id)).toBe(false);
  });

  it("no cobra dos veces el mismo mensaje", async () => {
    const suya = await nuevaEmpresa("idempotente");
    await otorgarCredito({ companyId: suya.id, amountCents: 100 });

    const uno = await descontarCredito({
      companyId: suya.id,
      microCents: 10 * 1_000_000,
      description: "respuesta",
      messageId: 987654
    });
    const dos = await descontarCredito({
      companyId: suya.id,
      microCents: 10 * 1_000_000,
      description: "el mismo mensaje, reintentado",
      messageId: 987654
    });

    expect(uno.centavosCobrados).toBe(10);
    expect(dos.centavosCobrados).toBe(0);
    expect(await saldoDe(suya.id)).toBe(90);
  });

  it("dos descuentos a la vez no se pisan", async () => {
    const suya = await nuevaEmpresa("concurrencia");
    await otorgarCredito({ companyId: suya.id, amountCents: 1000 });

    // Sin el bloqueo de fila, los dos leerian 1000 y el segundo escribiria
    // 990 pisando al primero: se perderia un descuento.
    await Promise.all([
      descontarCredito({ companyId: suya.id, microCents: 10 * 1_000_000, description: "a" }),
      descontarCredito({ companyId: suya.id, microCents: 10 * 1_000_000, description: "b" })
    ]);

    expect(await saldoDe(suya.id)).toBe(980);
  });

  it("deja constancia de cada movimiento", async () => {
    const suya = await nuevaEmpresa("historial");
    await otorgarCredito({ companyId: suya.id, amountCents: 500, description: "prueba" });
    await descontarCredito({
      companyId: suya.id,
      microCents: 3 * 1_000_000,
      description: "una respuesta"
    });

    const movimientos = await AiCreditLedger.findAll({
      where: { companyId: suya.id },
      order: [["id", "ASC"]]
    });

    expect(movimientos).toHaveLength(2);
    expect(movimientos[0].type).toBe("grant_admin");
    expect(movimientos[0].amountCents).toBe(500);
    expect(movimientos[1].type).toBe("consumption");
    expect(movimientos[1].amountCents).toBe(-3);
    expect(movimientos[1].balanceAfterCents).toBe(497);
  });
});

describe("resolverClaveDeAgente", () => {
  it("un agente con su propia clave no toca el credito", async () => {
    const suya = await nuevaEmpresa("clave-propia");

    const agente = await AiAgent.create({
      companyId: suya.id,
      name: `propio-${sufijo}`,
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: encrypt("sk-la-del-cliente"),
      apiKeyLast4: "ente",
      isActive: true
    } as any);

    const clave = await resolverClaveDeAgente(agente);

    expect(clave).toEqual({ modo: "propia", apiKey: "sk-la-del-cliente" });

    // Y lo que de verdad importa: no se le creo cuenta de credito a nadie.
    const cuenta = await AiCreditAccount.findOne({ where: { companyId: suya.id } });
    expect(cuenta).toBeNull();
  });

  it("sin clave propia y sin saldo, se queda sin credito", async () => {
    const suya = await nuevaEmpresa("sin-saldo");
    const config = await AiCreditSettings.findOne();
    await (config || (await AiCreditSettings.create({} as any))).update({
      sharedOpenAiApiKey: encrypt("sk-la-compartida"),
      sharedOpenAiApiKeyLast4: "tida"
    });

    const agente = await AiAgent.create({
      companyId: suya.id,
      name: `sin-saldo-${sufijo}`,
      provider: "openai",
      model: "gpt-4o-mini",
      isActive: true
    } as any);

    await cuentaDe(suya.id);

    expect(await resolverClaveDeAgente(agente)).toEqual({ modo: "sin_credito" });
  });

  it("con saldo, usa la clave compartida", async () => {
    const suya = await nuevaEmpresa("con-saldo");
    await otorgarCredito({ companyId: suya.id, amountCents: 500 });

    const agente = await AiAgent.create({
      companyId: suya.id,
      name: `con-saldo-${sufijo}`,
      provider: "openai",
      model: "gpt-4o-mini",
      isActive: true
    } as any);

    expect(await resolverClaveDeAgente(agente)).toEqual({
      modo: "compartida",
      apiKey: "sk-la-compartida"
    });
  });

  it("Gemini sin clave propia sigue exigiendo la suya", async () => {
    // La clave compartida es de OpenAI: a un agente de Gemini no le sirve.
    const suya = await nuevaEmpresa("gemini");
    await otorgarCredito({ companyId: suya.id, amountCents: 500 });

    const agente = await AiAgent.create({
      companyId: suya.id,
      name: `gemini-${sufijo}`,
      provider: "gemini",
      model: "gemini-1.5-flash",
      isActive: true
    } as any);

    expect(await resolverClaveDeAgente(agente)).toEqual({ modo: "sin_clave" });
  });
});

describe("preciosDe", () => {
  it("los precios de referencia estan cargados", async () => {
    // Esto se escapo la primera vez: la precarga estaba en un seed, y el
    // predeploy de este proyecto solo ejecuta seeds en una base recien
    // creada. En produccion la tabla se quedo vacia, y con la tabla vacia no
    // se cobra nada: preciosDe no encuentra la unidad y el costo sale cero.
    const precios = await preciosDe("openai", "gpt-4o-mini");

    expect(precios.porUnidad.tokens_input).toBeDefined();
    expect(precios.porUnidad.tokens_output).toBeDefined();
    expect(precios.porUnidad.audio_minute).toBeDefined();

    // Y que el precio no sea cero, que es lo que de verdad rompe el cobro.
    expect(precios.porUnidad.tokens_input!.precio).toBeGreaterThan(0);
  });

  it("lee el precio y el override de cada unidad", async () => {
    const modelo = `modelo-prueba-${sufijo}`;

    await AiModelPricing.create({
      provider: "openai",
      model: modelo,
      unit: "tokens_input",
      pricePerUnitCents: "0.00002500",
      marginPercentOverride: "35.00"
    } as any);

    const precios = await preciosDe("openai", modelo);

    expect(precios.porUnidad.tokens_input).toEqual({ precio: 0.000025, margen: 35 });
    expect(precios.porUnidad.tokens_output).toBeUndefined();

    await AiModelPricing.destroy({ where: { model: modelo } });
  });
});
