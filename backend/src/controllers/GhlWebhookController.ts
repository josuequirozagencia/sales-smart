import { Request, Response } from "express";
import crypto from "crypto";
import ReceiveGhlMessageService from "../services/GhlServices/ReceiveGhlMessageService";
import { buscarIntegracion } from "../services/GhlServices/GhlConfigService";
import logger from "../utils/logger";

/**
 * Entrada de eventos de GoHighLevel.
 *
 * Es un endpoint PUBLICO —GHL no puede autenticarse con el JWT de la
 * aplicacion— asi que la unica barrera es el secreto de la URL. Sin el,
 * cualquiera que supiera el identificador de una empresa podria meter
 * mensajes falsos en la bandeja de sus asesores.
 *
 * La URL se arma en la pantalla de configuracion y se pega a mano en GHL:
 * Settings > Integrations > Webhooks, o una accion "Webhook" dentro de un
 * Workflow. GHL no tiene API para crear esa suscripcion, asi que ese paso
 * no se automatiza.
 */

/**
 * Compara sin filtrar por tiempo.
 *
 * Una comparacion normal sale en cuanto encuentra el primer caracter
 * distinto, y ese tiempo distinto permite adivinar el secreto poco a poco.
 */
const iguales = (a: string, b: string): boolean => {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
};

export const receive = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, secret } = req.params;

  const empresa = Number(companyId);
  if (!Number.isInteger(empresa) || empresa <= 0) {
    return res.status(404).json({ error: "not found" });
  }

  const fila = await buscarIntegracion(empresa);

  // Misma respuesta para "no existe" y "secreto incorrecto": distinguirlas
  // diria a quien pruebe al azar que empresas tienen el canal activo.
  if (!fila || !fila.isActive) {
    return res.status(404).json({ error: "not found" });
  }

  const guardado = fila.webhookSecret || "";

  if (!guardado || !secret || !iguales(guardado, secret)) {
    logger.warn(`[GHL] webhook rechazado para la empresa ${empresa}`);
    return res.status(404).json({ error: "not found" });
  }

  // A GHL se le responde 200 cuanto antes y pase lo que pase: si se le
  // devuelve un error reintenta, y un evento que no sabemos tratar se
  // reintentaria para siempre. El procesamiento va aparte.
  ReceiveGhlMessageService(empresa, req.body || {})
    .then(resultado => {
      if (!resultado.atendido) {
        logger.info(`[GHL] evento no procesado: ${resultado.motivo}`);
      }
    })
    .catch(err => {
      logger.error(`[GHL] fallo al procesar el evento: ${err.message}`);
    });

  return res.status(200).json({ received: true });
};

export default { receive };
