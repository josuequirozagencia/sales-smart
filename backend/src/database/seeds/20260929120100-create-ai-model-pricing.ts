import { QueryInterface } from "sequelize";

/**
 * Precios de referencia de los modelos de OpenAI.
 *
 * ATENCION: estos numeros son una referencia de partida, no una verdad.
 * OpenAI cambia sus precios, y cuando lo haga esta tabla se queda vieja sin
 * avisar: hay que revisarla desde el panel. Se precargan para que el sistema
 * no arranque con la tabla vacia —con precio cero no se cobraria nada— pero
 * el numero bueno es el que confirme quien administra.
 *
 * La unidad es CENTAVOS POR TOKEN, no por millon. La conversion desde la
 * tabla publica de OpenAI, que va en dolares por millon de tokens:
 *
 *     centavos por token = (dolares por millon) / 10.000
 *
 * Asi, gpt-4o a 2,50 dolares el millon de tokens de entrada sale a 0,00025
 * centavos por token. De ahi los ocho decimales de la columna: redondeado a
 * centavo entero seria cero.
 *
 * El audio va por minuto: whisper-1 a 0,006 dolares el minuto son 0,6
 * centavos por minuto.
 *
 * Aqui va el costo REAL del proveedor, sin margen. El margen se aplica al
 * cobrar, y se configura aparte.
 */

interface Precio {
  model: string;
  entrada: number;
  salida: number;
}

// Dolares por millon de tokens, tal y como los publica OpenAI.
const PRECIOS_POR_MILLON: Precio[] = [
  { model: "gpt-4o", entrada: 2.5, salida: 10.0 },
  { model: "gpt-4o-mini", entrada: 0.15, salida: 0.6 },
  { model: "gpt-4.1", entrada: 2.0, salida: 8.0 },
  { model: "gpt-4.1-mini", entrada: 0.4, salida: 1.6 },
  { model: "gpt-4.1-nano", entrada: 0.1, salida: 0.4 },
  { model: "o3-mini", entrada: 1.1, salida: 4.4 }
];

const aCentavosPorToken = (dolaresPorMillon: number): string =>
  (dolaresPorMillon / 10000).toFixed(8);

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const [existentes]: any = await queryInterface.sequelize.query(
      `select count(*)::int as n from "AiModelPricing"`
    );
    // Si ya hay precios, alguien los reviso: no se pisan.
    if (existentes?.[0]?.n > 0) return;

    const ahora = new Date();
    const filas: any[] = [];

    for (const p of PRECIOS_POR_MILLON) {
      filas.push({
        provider: "openai",
        model: p.model,
        unit: "tokens_input",
        pricePerUnitCents: aCentavosPorToken(p.entrada),
        marginPercentOverride: null,
        createdAt: ahora,
        updatedAt: ahora
      });
      filas.push({
        provider: "openai",
        model: p.model,
        unit: "tokens_output",
        pricePerUnitCents: aCentavosPorToken(p.salida),
        marginPercentOverride: null,
        createdAt: ahora,
        updatedAt: ahora
      });
    }

    // Whisper: 0,006 dolares por minuto = 0,6 centavos por minuto.
    //
    // Se da de alta con el nombre de cada modelo de texto, no con
    // "whisper-1", porque el cobro se busca por el modelo del agente: el
    // audio lo transcribe Whisper pero la respuesta la da el modelo del
    // agente, y las dos cosas se cobran juntas en el mismo movimiento.
    for (const p of PRECIOS_POR_MILLON) {
      filas.push({
        provider: "openai",
        model: p.model,
        unit: "audio_minute",
        pricePerUnitCents: "0.60000000",
        marginPercentOverride: null,
        createdAt: ahora,
        updatedAt: ahora
      });
    }

    await queryInterface.bulkInsert("AiModelPricing", filas);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.bulkDelete("AiModelPricing", { provider: "openai" }, {});
  }
};
