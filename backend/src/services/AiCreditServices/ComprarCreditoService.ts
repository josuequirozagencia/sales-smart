import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
import { ajustes } from "./AiCreditService";

/**
 * La compra de credito. TODAVIA NO COBRA NADA.
 *
 * La pasarela de pago no esta decidida, asi que aqui solo se registra que
 * alguien quiso recargar y cuanto. Esta aislado en su propio fichero a
 * proposito: el dia que se elija pasarela, lo que cambia es esto y nada mas.
 * La pantalla que lo llama no se entera.
 *
 * Cuando llegue ese dia, lo que hay que anadir aqui es la creacion de la
 * sesion de pago y, en el webhook de confirmacion, una llamada a
 * otorgarCredito con type "purchase". El saldo se suma 1 a 1 con lo pagado:
 * el margen de la agencia ya va en el precio por token, no se cobra aqui
 * otra vez.
 */

export interface IntencionDeCompra {
  companyId: number;
  userId: number;
  amountCents: number;
}

export interface ResultadoIntencion {
  registrada: boolean;
  amountCents: number;
  /** Clave de traduccion para que la pantalla lo diga en el idioma del usuario. */
  mensaje: string;
}

export const registrarIntencionDeCompra = async (
  datos: IntencionDeCompra
): Promise<ResultadoIntencion> => {
  const config = await ajustes();

  if (!Number.isInteger(datos.amountCents) || datos.amountCents <= 0) {
    throw new AppError("ERR_AI_CREDIT_INVALID_AMOUNT", 400);
  }

  // El minimo es configurable y no una constante en el codigo: existe para
  // que la comision fija de la pasarela no se coma una recarga pequena, y esa
  // comision depende de la pasarela que se acabe eligiendo.
  if (datos.amountCents < config.minPurchaseCents) {
    throw new AppError("ERR_AI_CREDIT_BELOW_MINIMUM", 400);
  }

  logger.info(
    `[AI CREDIT] Intencion de compra: empresa ${datos.companyId}, usuario ${datos.userId}, ${datos.amountCents} centavos`
  );

  return {
    registrada: true,
    amountCents: datos.amountCents,
    mensaje: "AI_CREDIT_PURCHASE_NOT_AVAILABLE"
  };
};

export default { registrarIntencionDeCompra };
