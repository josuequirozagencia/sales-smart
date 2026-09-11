import { Request, Response } from "express";
import crypto from "crypto";
import ReceiveGhlMessageService from "../services/GhlServices/ReceiveGhlMessageService";
import ReceiveGhlTagEventService, {
  esEventoDeEtiquetas
} from "../services/GhlServices/ReceiveGhlTagEventService";
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
 * La URL se arma en la pantalla de configuracion y se pega a mano en GHL,
 * en la accion "Webhook" de un Workflow: "Customer Replied" para los
 * mensajes y "Contact Tag" para las etiquetas. Con un Private Integration
 * Token no hay otra via —la suscripcion a eventos es de las apps del
 * Marketplace— y GHL no tiene API para crearla, asi que ese paso no se
 * automatiza.
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
  //
  // La misma URL recibe mensajes y cambios de etiquetas: GHL solo deja
  // pegar una direccion por Workflow y asi no hay que manejar dos. Un
  // evento de etiquetas se reconoce por la marca que pone el Workflow
  // (ghl_event = tag_update) o por el tipo ContactTagUpdate; todo lo demas
  // sigue yendo a la entrada de mensajes, como hasta ahora.
  const evento = req.body || {};
  const tratar = esEventoDeEtiquetas(evento)
    ? ReceiveGhlTagEventService(empresa, evento)
    : ReceiveGhlMessageService(empresa, evento);

  tratar
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
