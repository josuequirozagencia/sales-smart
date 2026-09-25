import Stripe from "stripe";
import Setting from "../models/Setting";

/**
 * Comprobacion de firma de los webhooks de Stripe.
 *
 * Sin esto, /subscription/stripewebhook se creia cualquier cuerpo que le
 * llegara: la ruta no lleva autenticacion, asi que quien supiera la URL podia
 * dar una factura por pagada y regalarse 30 dias de suscripcion. Stripe firma
 * el cuerpo EXACTO de cada evento con un secreto compartido (whsec_...); aqui
 * se recompone esa firma y se compara.
 */

/**
 * El secreto del endpoint. Primero la variable de entorno —no se puede leer
 * por ninguna API de la aplicacion— y si no, el ajuste de la empresa 1, donde
 * ya vive la clave privada de Stripe.
 */
export const secretoWebhookStripe = async (): Promise<string> => {
  const delEntorno = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (delEntorno) return delEntorno;

  const ajuste = await Setting.findOne({
    where: { companyId: 1, key: "stripewebhooksecret" }
  });
  return (ajuste?.value || "").trim();
};

/**
 * Devuelve el evento solo si la firma cuadra; si no, lanza. Quien llama
 * responde 400 y Stripe reintenta durante tres dias, asi que un rechazo por
 * secreto mal puesto no pierde el cobro: se recupera al corregirlo.
 *
 * El cuerpo tiene que ser el original sin interpretar (app.ts lo guarda en
 * req.rawBody solo para esta ruta): el JSON ya parseado y vuelto a serializar
 * no da la misma firma.
 */
export const eventoStripeVerificado = (
  cuerpo: Buffer | string | undefined,
  firma: string | string[] | undefined,
  secreto: string
): Stripe.Event => {
  if (!secreto) {
    throw new Error("STRIPE_WEBHOOK_SECRET sin configurar");
  }
  if (!cuerpo || !cuerpo.length) {
    throw new Error("Cuerpo sin procesar no disponible");
  }
  if (!firma || typeof firma !== "string") {
    throw new Error("Falta la cabecera stripe-signature");
  }

  // constructEvent solo hace criptografia con el secreto: no llama a la API
  // de Stripe, por eso no hace falta la clave privada de la cuenta.
  return Stripe.webhooks.constructEvent(cuerpo, firma, secreto);
};
