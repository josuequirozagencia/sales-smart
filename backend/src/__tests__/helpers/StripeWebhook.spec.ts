import Stripe from "stripe";
import Setting from "../../models/Setting";
import {
  eventoStripeVerificado,
  secretoWebhookStripe
} from "../../helpers/StripeWebhook";
import { closeConnection } from "./db";

// Firma de los webhooks de Stripe.
//
// Esta ruta no lleva autenticacion y mueve dinero: da una factura por pagada
// y suma 30 dias de suscripcion. Lo unico que distingue a Stripe de
// cualquiera que sepa la URL es la firma, asi que lo que se prueba aqui es
// sobre todo lo que TIENE que rechazar.

const SECRETO = "whsec_de_prueba_para_los_tests";

const cuerpoDe = (sessionId: string): string =>
  JSON.stringify({
    id: "evt_1",
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: sessionId, object: "checkout.session" } }
  });

const firmar = (cuerpo: string, opciones: { secreto?: string; timestamp?: number } = {}): string =>
  Stripe.webhooks.generateTestHeaderString({
    payload: cuerpo,
    secret: opciones.secreto || SECRETO,
    timestamp: opciones.timestamp
  });

describe("eventoStripeVerificado", () => {
  it("acepta un cuerpo firmado con el secreto y devuelve el evento", () => {
    const cuerpo = cuerpoDe("cs_test_123");

    const evento = eventoStripeVerificado(cuerpo, firmar(cuerpo), SECRETO);

    expect(evento.type).toBe("checkout.session.completed");
    expect((evento.data.object as any).id).toBe("cs_test_123");
  });

  it("rechaza un cuerpo cambiado despues de firmarlo", () => {
    // El ataque directo: coger un evento real y apuntarlo a otra sesion.
    const original = cuerpoDe("cs_test_123");
    const firma = firmar(original);
    const manipulado = cuerpoDe("cs_test_de_otro");

    expect(() => eventoStripeVerificado(manipulado, firma, SECRETO)).toThrow();
  });

  it("rechaza una firma hecha con otro secreto", () => {
    const cuerpo = cuerpoDe("cs_test_123");
    const firma = firmar(cuerpo, { secreto: "whsec_el_secreto_de_otro" });

    expect(() => eventoStripeVerificado(cuerpo, firma, SECRETO)).toThrow();
  });

  it("rechaza un evento repetido mucho despues", () => {
    // Stripe tolera cinco minutos: mas alla, alguien esta reenviando un
    // evento viejo que ya se cobro.
    const cuerpo = cuerpoDe("cs_test_123");
    const haceUnaHora = Math.floor(Date.now() / 1000) - 3600;

    expect(() =>
      eventoStripeVerificado(cuerpo, firmar(cuerpo, { timestamp: haceUnaHora }), SECRETO)
    ).toThrow();
  });

  it("rechaza si no viene la cabecera de firma", () => {
    const cuerpo = cuerpoDe("cs_test_123");

    expect(() => eventoStripeVerificado(cuerpo, undefined, SECRETO)).toThrow(
      /stripe-signature/
    );
  });

  it("rechaza si el secreto no esta configurado", () => {
    // Preferible a dejar pasar: sin secreto no hay forma de saber quien
    // escribe, que es exactamente el agujero que esto cierra.
    const cuerpo = cuerpoDe("cs_test_123");

    expect(() => eventoStripeVerificado(cuerpo, firmar(cuerpo), "")).toThrow(
      /STRIPE_WEBHOOK_SECRET/
    );
  });

  it("rechaza si no llega el cuerpo sin procesar", () => {
    // Si algun dia se pierde el rawBody de app.ts, mejor un 400 ruidoso que
    // una verificacion que pasa por encima.
    const cuerpo = cuerpoDe("cs_test_123");

    expect(() => eventoStripeVerificado(undefined, firmar(cuerpo), SECRETO)).toThrow();
  });
});

describe("secretoWebhookStripe", () => {
  const entornoOriginal = process.env.STRIPE_WEBHOOK_SECRET;

  afterEach(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = entornoOriginal;
    await Setting.destroy({ where: { companyId: 1, key: "stripewebhooksecret" } });
  });

  afterAll(async () => {
    await closeConnection();
  });

  it("prefiere la variable de entorno", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_del_entorno";
    await Setting.create({
      companyId: 1,
      key: "stripewebhooksecret",
      value: "whsec_del_ajuste"
    } as any);

    await expect(secretoWebhookStripe()).resolves.toBe("whsec_del_entorno");
  });

  it("cae al ajuste de la empresa 1 si no hay variable", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await Setting.create({
      companyId: 1,
      key: "stripewebhooksecret",
      value: "whsec_del_ajuste"
    } as any);

    await expect(secretoWebhookStripe()).resolves.toBe("whsec_del_ajuste");
  });

  it("devuelve vacio si no hay ninguno, para que el webhook rechace", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    await expect(secretoWebhookStripe()).resolves.toBe("");
  });
});
