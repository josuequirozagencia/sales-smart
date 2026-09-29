import { QueryInterface } from "sequelize";

/**
 * Precios de referencia de los modelos de OpenAI.
 *
 * Esto nacio como un seed y estaba mal: el predeploy de este proyecto solo
 * ejecuta seeds en una base recien creada —porque sequelize no registra
 * cuales ya corrieron y alguno duplicaria filas al repetirse—, asi que en
 * produccion no se habria ejecutado nunca y la tabla se habria quedado
 * vacia. Con la tabla vacia no se cobra nada: preciosDe no encuentra la
 * unidad y el costo sale cero.
 *
 * Como migracion si corre, y queda anotada en SequelizeMeta.
 *
 * ATENCION: estos numeros son un punto de partida, no una verdad. OpenAI
 * cambia sus precios y cuando lo haga esta tabla se queda vieja sin avisar:
 * hay que revisarla desde el panel de credito.
 *
 * La unidad es CENTAVOS POR TOKEN, no por millon. La conversion desde la
 * tabla publica de OpenAI, que va en dolares por millon:
 *
 *     centavos por token = (dolares por millon) / 10.000
 *
 * gpt-4o a 2,50 dolares el millon de tokens de entrada sale a 0,00025
 * centavos por token. De ahi los ocho decimales de la columna: redondeado a
 * centavo entero seria cero.
 *
 * Aqui va el costo REAL del proveedor, sin margen. El margen se aplica al
 * cobrar y se configura aparte.
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

// 0,006 dolares por minuto de audio = 0,6 centavos por minuto.
const WHISPER_POR_MINUTO = "0.60000000";

const aCentavosPorToken = (dolaresPorMillon: number): string =>
  (dolaresPorMillon / 10000).toFixed(8);

module.exports = {
  up: async (queryInterface: QueryInterface) => {
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
      // El audio se da de alta con el nombre de cada modelo de texto y no
      // con "whisper-1": el cobro se busca por el modelo del agente, y una
      // respuesta a un audio gasta las dos cosas —la transcripcion y la
      // respuesta— en el mismo movimiento.
      filas.push({
        provider: "openai",
        model: p.model,
        unit: "audio_minute",
        pricePerUnitCents: WHISPER_POR_MINUTO,
        marginPercentOverride: null,
        createdAt: ahora,
        updatedAt: ahora
      });
    }

    // Fila a fila, saltando las que ya existan: si alguien ya reviso un
    // precio desde el panel, esta migracion no se lo pisa.
    for (const fila of filas) {
      const [existente]: any = await queryInterface.sequelize.query(
        `select id from "AiModelPricing"
         where provider = :provider and model = :model and unit = :unit
         limit 1`,
        { replacements: { provider: fila.provider, model: fila.model, unit: fila.unit } }
      );

      if (existente && existente.length > 0) continue;

      await queryInterface.bulkInsert("AiModelPricing", [fila]);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.bulkDelete("AiModelPricing", { provider: "openai" }, {});
  }
};
