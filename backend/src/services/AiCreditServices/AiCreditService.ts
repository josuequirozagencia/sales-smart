import { Transaction } from "sequelize";
import sequelize from "../../database";
import AiCreditAccount from "../../models/AiCreditAccount";
import AiCreditLedger, { TipoMovimiento } from "../../models/AiCreditLedger";
import AiCreditSettings from "../../models/AiCreditSettings";
import AiModelPricing, { UnidadPrecio } from "../../models/AiModelPricing";
import AiAgent from "../../models/AiAgent";
import { decrypt } from "../../helpers/SecretBox";
import logger from "../../utils/logger";
import CreateAuthAuditService, {
  EVENTOS
} from "../AuthAuditServices/CreateAuthAuditService";
import { UsoProveedor } from "../AiAgentServices/Proveedores";

/**
 * El credito prepago de los Agentes IA.
 *
 * Un agente con su propia apiKey corre contra la cuenta del cliente y no
 * pasa por aqui en ningun momento: ni se consulta el saldo, ni se descuenta,
 * ni se le puede parar por falta de credito. Todo lo de este fichero es
 * para los que usan la clave compartida de la agencia.
 */

/** Millonesimas de centavo por centavo. Todo lo fraccionario vive en esta escala. */
const MICRO = 1_000_000;

export interface PreciosModelo {
  porUnidad: Partial<Record<UnidadPrecio, { precio: number; margen: number | null }>>;
}

/**
 * Lo que cuesta una llamada, en millonesimas de centavo.
 *
 * Se devuelve en micro y no en centavos a proposito. Una respuesta de gpt-4o
 * ronda las 0,3 centesimas de centavo: redondeada a centavo entero seria
 * cero, y todos los modelos de texto saldrian gratis. Quien llama acumula
 * estos micros y cobra el centavo cuando se junta.
 *
 * El margen se aplica aqui, sobre el costo real del proveedor. El override
 * del modelo manda sobre el global; si no hay ninguno, no se aplica margen.
 */
export const calcularCostoMicroCents = (
  uso: UsoProveedor,
  precios: PreciosModelo,
  margenGlobalPorcentaje: number
): number => {
  const cantidades: Array<[UnidadPrecio, number]> = [
    ["tokens_input", uso.tokensEntrada || 0],
    ["tokens_output", uso.tokensSalida || 0],
    // Whisper se cobra por minuto, y el proveedor devuelve segundos.
    ["audio_minute", (uso.audioSegundos || 0) / 60]
  ];

  let micro = 0;

  for (const [unidad, cantidad] of cantidades) {
    if (!cantidad) continue;

    const fila = precios.porUnidad[unidad];
    if (!fila) continue;

    const margen = fila.margen === null ? margenGlobalPorcentaje : fila.margen;
    const costoCentavos = cantidad * fila.precio * (1 + margen / 100);

    micro += costoCentavos * MICRO;
  }

  return Math.round(micro);
};

/** Los precios de un modelo, listos para calcularCostoMicroCents. */
export const preciosDe = async (
  provider: string,
  model: string
): Promise<PreciosModelo> => {
  const filas = await AiModelPricing.findAll({ where: { provider, model } });

  const porUnidad: PreciosModelo["porUnidad"] = {};

  for (const fila of filas) {
    porUnidad[fila.unit] = {
      precio: Number(fila.pricePerUnitCents),
      margen:
        fila.marginPercentOverride === null ||
        fila.marginPercentOverride === undefined
          ? null
          : Number(fila.marginPercentOverride)
    };
  }

  return { porUnidad };
};

/** Los ajustes generales. Si no hay fila todavia, se crea con los valores por defecto. */
export const ajustes = async (): Promise<AiCreditSettings> => {
  const fila = await AiCreditSettings.findOne();
  if (fila) return fila;

  return AiCreditSettings.create({
    defaultMarginPercent: "20",
    minPurchaseCents: 1000
  } as any);
};

/** La cuenta de una empresa. Se crea vacia la primera vez que se pregunta. */
export const cuentaDe = async (
  companyId: number,
  transaction?: Transaction
): Promise<AiCreditAccount> => {
  const existente = await AiCreditAccount.findOne({
    where: { companyId },
    transaction,
    lock: transaction ? Transaction.LOCK.UPDATE : undefined
  });

  if (existente) return existente;

  return AiCreditAccount.create(
    { companyId, balanceCents: 0, pendingMicroCents: "0" } as any,
    { transaction }
  );
};

export const saldoDe = async (companyId: number): Promise<number> =>
  (await cuentaDe(companyId)).balanceCents;

export const hayCreditoDisponible = async (
  companyId: number
): Promise<boolean> => (await saldoDe(companyId)) > 0;

interface DatosDescuento {
  companyId: number;
  microCents: number;
  description: string;
  aiAgentId?: number | null;
  messageId?: number | null;
}

/**
 * Cobra lo consumido.
 *
 * Atomico: la fila de la cuenta se bloquea dentro de la transaccion, asi que
 * dos respuestas que terminen a la vez no se pisan el saldo.
 *
 * Idempotente por mensaje: si el mismo messageId ya tiene un cobro, no se
 * cobra otra vez. Un reintento del proveedor de WhatsApp, o de la propia
 * llamada tras un fallo de red, no puede cobrar dos veces la misma respuesta.
 *
 * El saldo puede quedar negativo. Es lo que se quiere: la respuesta ya se
 * pidio y ya costo dinero, asi que se paga. Lo que no se hace es empezar la
 * siguiente, y de eso se encarga hayCreditoDisponible.
 */
export const descontarCredito = async (
  datos: DatosDescuento
): Promise<{ centavosCobrados: number }> =>
  sequelize.transaction(async transaction => {
    if (datos.messageId) {
      const yaCobrado = await AiCreditLedger.findOne({
        where: {
          companyId: datos.companyId,
          messageId: datos.messageId,
          type: "consumption"
        },
        transaction
      });

      if (yaCobrado) {
        logger.info(
          `[AI CREDIT] Mensaje ${datos.messageId} ya cobrado, no se repite`
        );
        return { centavosCobrados: 0 };
      }
    }

    const cuenta = await cuentaDe(datos.companyId, transaction);

    const acumulado = Number(cuenta.pendingMicroCents || 0) + datos.microCents;
    const centavos = Math.floor(acumulado / MICRO);
    const resto = acumulado - centavos * MICRO;

    const saldoNuevo = cuenta.balanceCents - centavos;

    await cuenta.update(
      { balanceCents: saldoNuevo, pendingMicroCents: String(resto) },
      { transaction }
    );

    await AiCreditLedger.create(
      {
        companyId: datos.companyId,
        type: "consumption" as TipoMovimiento,
        amountCents: -centavos,
        balanceAfterCents: saldoNuevo,
        // El micro va en el texto para poder auditar por que un mensaje
        // cobro 0: no es que fuera gratis, es que aun no llego al centavo.
        description: `${datos.description} (${datos.microCents} micro)`,
        aiAgentId: datos.aiAgentId ?? null,
        messageId: datos.messageId ?? null
      } as any,
      { transaction }
    );

    return { centavosCobrados: centavos };
  });

interface DatosOtorgamiento {
  companyId: number;
  amountCents: number;
  description?: string;
  createdByUserId?: number | null;
  type?: TipoMovimiento;
}

/** Suma saldo. Mismo mecanismo atomico, y queda anotado en la auditoria. */
export const otorgarCredito = async (
  datos: DatosOtorgamiento
): Promise<number> => {
  const saldoNuevo = await sequelize.transaction(async transaction => {
    const cuenta = await cuentaDe(datos.companyId, transaction);
    const saldo = cuenta.balanceCents + datos.amountCents;

    await cuenta.update({ balanceCents: saldo }, { transaction });

    await AiCreditLedger.create(
      {
        companyId: datos.companyId,
        type: datos.type || ("grant_admin" as TipoMovimiento),
        amountCents: datos.amountCents,
        balanceAfterCents: saldo,
        description: datos.description || null,
        createdByUserId: datos.createdByUserId ?? null
      } as any,
      { transaction }
    );

    return saldo;
  });

  await CreateAuthAuditService({
    event: EVENTOS.AI_CREDIT_GRANTED,
    companyId: datos.companyId,
    actorUserId: datos.createdByUserId ?? null,
    detail: `${datos.amountCents} centavos. Saldo: ${saldoNuevo}. ${datos.description || ""}`.trim()
  });

  return saldoNuevo;
};

export type OrigenClave =
  | { modo: "propia"; apiKey: string }
  | { modo: "compartida"; apiKey: string }
  | { modo: "sin_credito" }
  | { modo: "sin_clave" };

/**
 * Con que clave corre este agente, y si le queda saldo.
 *
 * Tres caminos:
 *  - Tiene su propia apiKey: se usa y no se toca el credito. Es el camino de
 *    siempre, sin un solo cambio.
 *  - No la tiene y su proveedor es OpenAI: se usa la compartida, previa
 *    comprobacion de saldo.
 *  - No la tiene y su proveedor es Gemini u OpenRouter: no hay clave
 *    compartida para esos, asi que sigue haciendo falta la propia. La clave
 *    compartida es de OpenAI y no sirve para otro proveedor.
 */
export const resolverClaveDeAgente = async (
  agente: Pick<AiAgent, "apiKey" | "provider" | "companyId">
): Promise<OrigenClave> => {
  const propia = (decrypt(agente.apiKey) || "").trim();
  if (propia) return { modo: "propia", apiKey: propia };

  if (agente.provider !== "openai") return { modo: "sin_clave" };

  const config = await ajustes();
  const compartida = (decrypt(config.sharedOpenAiApiKey) || "").trim();
  if (!compartida) return { modo: "sin_clave" };

  if (!(await hayCreditoDisponible(agente.companyId))) {
    return { modo: "sin_credito" };
  }

  return { modo: "compartida", apiKey: compartida };
};

/**
 * Cobra una respuesta que se hizo con la clave compartida.
 *
 * No lanza: un fallo cobrando no puede tumbar una respuesta que el cliente
 * ya recibio. Queda en el log y se revisa.
 */
export const cobrarUso = async (
  companyId: number,
  provider: string,
  model: string,
  uso: UsoProveedor | undefined,
  contexto: { aiAgentId?: number | null; messageId?: number | null; description: string }
): Promise<void> => {
  if (!uso) return;

  try {
    const [precios, config] = await Promise.all([preciosDe(provider, model), ajustes()]);
    const micro = calcularCostoMicroCents(
      uso,
      precios,
      Number(config.defaultMarginPercent)
    );

    if (!micro) return;

    await descontarCredito({
      companyId,
      microCents: micro,
      description: contexto.description,
      aiAgentId: contexto.aiAgentId,
      messageId: contexto.messageId
    });
  } catch (err) {
    logger.error(
      `[AI CREDIT] No se pudo cobrar el uso de ${provider}/${model}: ${(err as Error).message}`
    );
  }
};

export default {
  calcularCostoMicroCents,
  preciosDe,
  ajustes,
  cuentaDe,
  saldoDe,
  hayCreditoDisponible,
  descontarCredito,
  otorgarCredito,
  resolverClaveDeAgente,
  cobrarUso
};
