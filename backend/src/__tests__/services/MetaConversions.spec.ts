import axios from "axios";
import Appointment from "../../models/Appointment";
import Company from "../../models/Company";
import CompaniesSettings from "../../models/CompaniesSettings";
import Contact from "../../models/Contact";
import ContactAttribution from "../../models/ContactAttribution";
import ContactTag from "../../models/ContactTag";
import ConversionEventLog from "../../models/ConversionEventLog";
import MetaConfig from "../../models/MetaConfig";
import Sale from "../../models/Sale";
import Tag from "../../models/Tag";
import CreateSaleService from "../../services/SaleServices/CreateService";
import CreateAppointmentService from "../../services/AppointmentServices/CreateService";
import { encrypt } from "../../helpers/SecretBox";
import {
  MetaConversionsProvider,
  clasificarError,
  construirEventoMeta,
  normalizarTelefono
} from "../../services/ConversionServices/MetaConversionsProvider";
import {
  encolarConversion,
  esperarConversionesEnCurso,
  registrarLeadEntrante,
  registrarListenersDeConversion,
  setEncoladorDeConversiones
} from "../../services/ConversionServices/ConversionService";
import {
  construirEvento,
  procesarConversion,
  setProveedorDeConversiones
} from "../../services/ConversionServices/ProcessConversionJob";
import { guardarAtribucion } from "../../services/ConversionServices/ContactAttributionService";
import {
  guardarConfigMeta,
  verConfigMeta
} from "../../services/MetaConfigService/MetaConfigService";
import * as MetaConfigController from "../../controllers/MetaConfigController";
import {
  ConversionEvent,
  ConversionOutcome,
  SIETE_DIAS_MS
} from "../../services/ConversionServices/types";
import { closeConnection, getSeededCompany, uniqueSuffix } from "../helpers/db";

// Meta Conversions API (docs/META_CONVERSIONS_API.md).
//
// Lo que no se negocia y aqui se prueba: ventas, citas y contactos se crean
// igual aunque Meta no este configurado o falle; ninguna empresa lee ni
// dispara nada de otra; y el mismo hecho no se manda dos veces, porque Meta
// no deduplica los eventos de mensajeria.
//
// Ni Redis ni Meta: la cola y el proveedor se sustituyen por dobles que
// anotan lo que reciben.

const COMPANY_A = 1;
const TOKEN_A = "EAAtokenDeLaEmpresaA0000000001";
const TOKEN_B = "EAAtokenDeLaEmpresaB0000000002";
const HACE = (ms: number) => new Date(Date.now() - ms);

const encolados: Array<{ logId: number; jobId: string }> = [];
const enviados: ConversionEvent[] = [];
let respuesta: ConversionOutcome = {
  status: "sent",
  route: "standard",
  sentEventName: "Purchase"
};

const creados = {
  contactos: [] as number[],
  ventas: [] as number[],
  citas: [] as number[]
};

let companyB: Company;
let tagsAntes: number[] = [];

const nuevoContacto = async (companyId: number, extra: Record<string, any> = {}): Promise<Contact> => {
  const contacto = await Contact.create({
    name: `Meta ${uniqueSuffix()}`,
    number: `5939${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 90 + 10)}`,
    companyId,
    isGroup: false,
    channel: "whatsapp",
    ...extra
  } as any);
  creados.contactos.push(contacto.id);
  return contacto;
};

const configurar = async (companyId: number, datos: Record<string, any> = {}): Promise<MetaConfig> => {
  await MetaConfig.destroy({ where: { companyId } });
  return MetaConfig.create({
    companyId,
    datasetId: companyId === COMPANY_A ? "111111111" : "222222222",
    accessToken: encrypt(companyId === COMPANY_A ? TOKEN_A : TOKEN_B),
    tokenLast4: (companyId === COMPANY_A ? TOKEN_A : TOKEN_B).slice(-4),
    isActive: true,
    status: "ok",
    ...datos
  } as any);
};

const vender = async (companyId: number, contactId: number, total = 150): Promise<Sale> => {
  const venta = await CreateSaleService({ companyId, contactId, total });
  creados.ventas.push(venta.id);
  await esperarConversionesEnCurso();
  return venta;
};

const logDe = (companyId: number, eventId: string) =>
  ConversionEventLog.findOne({ where: { companyId, eventId } });

const respuestaHttp = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeAll(async () => {
  const empresa = await getSeededCompany();

  companyB = await Company.create({
    name: `meta-b-${uniqueSuffix()}`,
    planId: empresa.planId,
    status: true,
    currency: "USD"
  } as any);

  tagsAntes = (await Tag.findAll({ where: { companyId: COMPANY_A }, attributes: ["id"] })).map(t => t.id);

  registrarListenersDeConversion();
  setEncoladorDeConversiones(async (logId, jobId) => {
    encolados.push({ logId, jobId });
  });
  setProveedorDeConversiones({
    name: "doble",
    send: async evento => {
      enviados.push(evento);
      return respuesta;
    }
  });
});

beforeEach(async () => {
  encolados.length = 0;
  enviados.length = 0;
  respuesta = { status: "sent", route: "standard", sentEventName: "Purchase" };
  await MetaConfig.destroy({ where: { companyId: [COMPANY_A, companyB.id] } });
});

afterAll(async () => {
  setEncoladorDeConversiones();
  setProveedorDeConversiones();
  jest.restoreAllMocks();

  const empresas = [COMPANY_A, companyB.id];
  await ConversionEventLog.destroy({ where: { companyId: empresas, contactId: creados.contactos } });
  await ConversionEventLog.destroy({ where: { companyId: companyB.id } });
  await ContactAttribution.destroy({ where: { contactId: creados.contactos } });
  await MetaConfig.destroy({ where: { companyId: empresas } });
  await Appointment.destroy({ where: { id: creados.citas } });
  await Sale.destroy({ where: { id: creados.ventas } });
  await ContactTag.destroy({ where: { contactId: creados.contactos } });
  await Tag.destroy({ where: { companyId: companyB.id } });
  if (tagsAntes.length) {
    const { Op } = require("sequelize");
    await Tag.destroy({ where: { companyId: COMPANY_A, id: { [Op.notIn]: tagsAntes }, name: ["Venta", "Agenda"] } });
  }
  await Contact.destroy({ where: { id: creados.contactos } });
  await CompaniesSettings.destroy({ where: { companyId: companyB.id } });
  await companyB.destroy();
  await closeConnection();
});

// ---------------------------------------------------------------------------
// Payload (funciones puras)
// ---------------------------------------------------------------------------

describe("payload para Meta", () => {
  const evento = (extra: Partial<ConversionEvent> = {}): ConversionEvent => ({
    type: "Lead",
    companyId: COMPANY_A,
    contactId: 10,
    eventId: "lead_10",
    timestamp: new Date(),
    attribution: null,
    user: { phone: "+593 99 123 4567", email: null, externalId: "1:10" },
    data: {},
    ...extra
  });

  it("con un clic reciente y WABA va por business_messaging como LeadSubmitted, sin datos personales", () => {
    const envio = construirEventoMeta(
      evento({ attribution: { ctwaClid: "CLID1", wabaId: "4455", capturedAt: HACE(60 * 60 * 1000) } })
    );

    expect(envio.ruta).toBe("business_messaging");
    expect(envio.evento.event_name).toBe("LeadSubmitted");
    expect(envio.evento.action_source).toBe("business_messaging");
    expect(envio.evento.messaging_channel).toBe("whatsapp");
    expect(envio.evento.user_data).toEqual({ whatsapp_business_account_id: "4455", ctwa_clid: "CLID1" });
    expect(envio.evento.event_id).toBe("lead_10");
  });

  it("con el clic de hace mas de 7 dias va por la ruta estandar con el telefono cifrado", () => {
    const envio = construirEventoMeta(
      evento({ attribution: { ctwaClid: "CLID1", wabaId: "4455", capturedAt: HACE(SIETE_DIAS_MS + 60000) } })
    );

    expect(envio.ruta).toBe("standard");
    expect(envio.evento.event_name).toBe("Lead");
    expect(envio.evento.action_source).toBe("chat");
    // SHA-256 de "593991234567"
    expect(envio.evento.user_data.ph[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(envio.evento)).not.toContain("593991234567");
    expect(envio.evento.user_data.ctwa_clid).toBeUndefined();
  });

  it("sin WABA no se atribuye aunque haya clic", () => {
    const envio = construirEventoMeta(
      evento({ attribution: { ctwaClid: "CLID1", wabaId: null, capturedAt: new Date() } })
    );
    expect(envio.ruta).toBe("standard");
  });

  it("Schedule nunca va por business_messaging, que no lo admite", () => {
    const envio = construirEventoMeta(
      evento({
        type: "Schedule",
        eventId: "schedule_5",
        attribution: { ctwaClid: "CLID1", wabaId: "4455", capturedAt: new Date() },
        data: { contentName: "Clase de prueba" }
      })
    );
    expect(envio.ruta).toBe("standard");
    expect(envio.evento.event_name).toBe("Schedule");
    expect(envio.evento.custom_data).toEqual({ content_name: "Clase de prueba" });
  });

  it("Purchase lleva el total y la moneda", () => {
    const envio = construirEventoMeta(
      evento({
        type: "Purchase",
        eventId: "purchase_7",
        attribution: { ctwaClid: "CLID1", wabaId: "4455", capturedAt: new Date() },
        data: { value: 250.5, currency: "USD", contentName: "Curso" }
      })
    );
    expect(envio.evento.event_name).toBe("Purchase");
    expect(envio.evento.custom_data).toEqual({ value: 250.5, currency: "USD", content_name: "Curso" });
  });

  it("sin telefono ni email no hay a quien atribuir y no se envia", () => {
    expect(construirEventoMeta(evento({ user: { phone: null, email: null, externalId: "1:10" } }))).toBeNull();
  });

  it("un LID de WhatsApp no es un telefono", () => {
    expect(normalizarTelefono("123456789012345@lid")).toBeNull();
    expect(normalizarTelefono("+593 99-123-4567")).toBe("593991234567");
  });
});

describe("clasificacion de errores de Meta", () => {
  const errorMeta = (status: number, code?: number, subcode?: number) => ({
    response: { status, data: { error: { code, error_subcode: subcode, message: "x" } } }
  });

  it.each([
    ["sin respuesta", { code: "ECONNRESET" }, "transient"],
    ["5xx", errorMeta(503), "transient"],
    ["limite de uso aunque venga como 403", errorMeta(403, 4), "transient"],
    ["token caducado o revocado", errorMeta(400, 190), "auth"],
    ["dataset inexistente o sin acceso", errorMeta(400, 100, 33), "auth"],
    ["permisos", errorMeta(403, 200), "auth"],
    ["parametro invalido", errorMeta(400, 100), "payload"]
  ])("%s -> %s", (_nombre, error, esperado) => {
    expect(clasificarError(error).tipo).toBe(esperado);
  });
});

// ---------------------------------------------------------------------------
// Con base de datos
// ---------------------------------------------------------------------------

describe("resiliencia: ventas, citas y contactos no dependen de Meta", () => {
  it("una venta se crea aunque la empresa no tenga MetaConfig, y no se registra ningun evento", async () => {
    const contacto = await nuevoContacto(COMPANY_A);
    const venta = await vender(COMPANY_A, contacto.id);

    expect(await Sale.findByPk(venta.id)).not.toBeNull();
    expect(await logDe(COMPANY_A, `purchase_${venta.id}`)).toBeNull();
    expect(encolados).toHaveLength(0);
  });

  it("una venta se crea aunque la cola este caida", async () => {
    await configurar(COMPANY_A);
    setEncoladorDeConversiones(async () => {
      throw new Error("redis caido");
    });

    try {
      const contacto = await nuevoContacto(COMPANY_A);
      const venta = await vender(COMPANY_A, contacto.id);
      expect(await Sale.findByPk(venta.id)).not.toBeNull();
    } finally {
      setEncoladorDeConversiones(async (logId, jobId) => {
        encolados.push({ logId, jobId });
      });
    }
  });

  it("una cita se crea sin MetaConfig, y con Meta activo registra un Schedule", async () => {
    const contacto = await nuevoContacto(COMPANY_A);
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const sinMeta = await CreateAppointmentService({ companyId: COMPANY_A, contactId: contacto.id, scheduledAt: manana });
    creados.citas.push(sinMeta.id);
    await esperarConversionesEnCurso();
    expect(await Appointment.findByPk(sinMeta.id)).not.toBeNull();
    expect(await logDe(COMPANY_A, `schedule_${sinMeta.id}`)).toBeNull();

    await configurar(COMPANY_A);
    const conMeta = await CreateAppointmentService({ companyId: COMPANY_A, contactId: contacto.id, scheduledAt: manana });
    creados.citas.push(conMeta.id);
    await esperarConversionesEnCurso();

    const log = await logDe(COMPANY_A, `schedule_${conMeta.id}`);
    expect(log).not.toBeNull();
    expect(log.status).toBe("pending");
    expect(encolados.map(e => e.logId)).toContain(log.id);
  });

  it("la venta sigue intacta aunque Meta rechace el evento", async () => {
    await configurar(COMPANY_A);
    const contacto = await nuevoContacto(COMPANY_A);
    const venta = await vender(COMPANY_A, contacto.id);

    respuesta = { status: "payload_error", error: "(100) Invalid parameter" };
    const log = await logDe(COMPANY_A, `purchase_${venta.id}`);
    await procesarConversion(log.id);

    expect((await log.reload()).status).toBe("failed");
    expect(await Sale.findByPk(venta.id)).not.toBeNull();
  });

  it("registrar un lead nunca lanza, ni con datos raros ni sin configuracion", async () => {
    expect(() => registrarLeadEntrante(null)).not.toThrow();
    expect(() => registrarLeadEntrante({ isGroup: true } as any)).not.toThrow();
    const contacto = await nuevoContacto(COMPANY_A);
    registrarLeadEntrante(contacto);
    await esperarConversionesEnCurso();
    expect(await logDe(COMPANY_A, `lead_${contacto.id}`)).toBeNull();
  });
});

describe("deduplicacion", () => {
  it("el mismo hecho se registra y se encola una sola vez, con eventId deterministico", async () => {
    await configurar(COMPANY_A);
    const contacto = await nuevoContacto(COMPANY_A);
    const venta = await vender(COMPANY_A, contacto.id);

    const peticion = {
      type: "Purchase" as const,
      companyId: COMPANY_A,
      contactId: contacto.id,
      sourceType: "sale" as const,
      sourceId: venta.id,
      occurredAt: venta.createdAt
    };
    const otra = await encolarConversion(peticion);
    const otraMas = await encolarConversion(peticion);

    const filas = await ConversionEventLog.findAll({ where: { companyId: COMPANY_A, eventId: `purchase_${venta.id}` } });
    expect(filas).toHaveLength(1);
    expect(otra.id).toBe(filas[0].id);
    expect(otraMas.id).toBe(filas[0].id);
    expect(encolados.filter(e => e.logId === filas[0].id)).toHaveLength(1);
  });

  it("un evento ya enviado no se vuelve a mandar aunque el trabajo se repita", async () => {
    await configurar(COMPANY_A);
    const contacto = await nuevoContacto(COMPANY_A);
    const venta = await vender(COMPANY_A, contacto.id);
    const log = await logDe(COMPANY_A, `purchase_${venta.id}`);

    await procesarConversion(log.id);
    await procesarConversion(log.id);

    expect(enviados.filter(e => e.eventId === `purchase_${venta.id}`)).toHaveLength(1);
    expect((await log.reload()).status).toBe("sent");
  });
});

describe("aislamiento por empresa", () => {
  it("una empresa no ve la configuracion de otra y la respuesta nunca incluye el token", async () => {
    await guardarConfigMeta(COMPANY_A, { datasetId: "111111111", accessToken: TOKEN_A }, async () => ({ ok: true }));

    const deA = await verConfigMeta(COMPANY_A);
    const deB = await verConfigMeta(companyB.id);

    expect(deA.configured).toBe(true);
    expect(deA.tokenLast4).toBe(TOKEN_A.slice(-4));
    expect(JSON.stringify(deA)).not.toContain(TOKEN_A);
    expect(deB.configured).toBe(false);
    expect(deB.datasetId).toBe("");
  });

  it("el controlador usa la empresa del token e ignora un companyId en el cuerpo", async () => {
    await configurar(COMPANY_A);
    jest.spyOn(axios, "get").mockRejectedValue({ response: { status: 503, data: {} } });

    const res = respuestaHttp();
    await MetaConfigController.update(
      {
        user: { companyId: companyB.id, profile: "admin" },
        body: { companyId: COMPANY_A, datasetId: "333333333", accessToken: TOKEN_B }
      } as any,
      res
    );

    expect((await MetaConfig.findOne({ where: { companyId: COMPANY_A } })).datasetId).toBe("111111111");
    expect((await MetaConfig.findOne({ where: { companyId: companyB.id } })).datasetId).toBe("333333333");
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain(TOKEN_B);

    const lectura = respuestaHttp();
    await MetaConfigController.show({ user: { companyId: companyB.id, profile: "admin" } } as any, lectura);
    expect(lectura.json.mock.calls[0][0].datasetId).toBe("333333333");
  });

  it("un usuario que no es admin no puede leer ni guardar", async () => {
    const req = { user: { companyId: COMPANY_A, profile: "user" }, body: {} } as any;
    await expect(MetaConfigController.show(req, respuestaHttp())).rejects.toMatchObject({ message: "ERR_NO_PERMISSION" });
    await expect(MetaConfigController.update(req, respuestaHttp())).rejects.toMatchObject({ message: "ERR_NO_PERMISSION" });
  });

  it("encolar para una empresa sin Meta no crea nada aunque otra lo tenga activo", async () => {
    await configurar(COMPANY_A);
    const contactoB = await nuevoContacto(companyB.id);
    const ventaB = await vender(companyB.id, contactoB.id);

    expect(await ConversionEventLog.count({ where: { companyId: companyB.id } })).toBe(0);
    expect(await logDe(COMPANY_A, `purchase_${ventaB.id}`)).toBeNull();
  });

  it("un evento de una empresa no puede usar la venta ni el contacto de otra", async () => {
    await configurar(COMPANY_A);
    const contactoB = await nuevoContacto(companyB.id);
    const ventaB = await vender(companyB.id, contactoB.id);

    // Registro forzado a mano con ids de B dentro de A.
    const intruso = await ConversionEventLog.create({
      companyId: COMPANY_A,
      eventId: `purchase_${ventaB.id}`,
      eventType: "Purchase",
      contactId: contactoB.id,
      sourceType: "sale",
      sourceId: ventaB.id,
      occurredAt: new Date(),
      status: "pending",
      attempts: 0
    } as any);

    await procesarConversion(intruso.id);

    expect((await intruso.reload()).status).toBe("skipped");
    expect(enviados).toHaveLength(0);
  });

  it("el proveedor de Meta usa solo las credenciales de la empresa del evento", async () => {
    await configurar(COMPANY_A);
    await configurar(companyB.id);
    const llamadas: Array<{ url: string; body: any }> = [];
    const proveedor = new MetaConversionsProvider({
      post: async (url, body) => {
        llamadas.push({ url, body });
        return { data: { events_received: 1, fbtrace_id: "trace" } };
      }
    });

    const resultado = await proveedor.send({
      type: "Lead",
      companyId: companyB.id,
      contactId: 1,
      eventId: "lead_1",
      timestamp: new Date(),
      user: { phone: "593991234567", externalId: `${companyB.id}:1` },
      data: {}
    });

    expect(resultado.status).toBe("sent");
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toContain("/222222222/events");
    expect(llamadas[0].body.access_token).toBe(TOKEN_B);
    expect(JSON.stringify(llamadas[0])).not.toContain(TOKEN_A);
  });
});

describe("errores y reintentos", () => {
  it("un error de credenciales bloquea la empresa; lo nuevo queda bloqueado y se reencola al corregir", async () => {
    await configurar(COMPANY_A);
    const contacto = await nuevoContacto(COMPANY_A);
    const venta1 = await vender(COMPANY_A, contacto.id);

    respuesta = { status: "auth_error", error: "(190) Error validating access token" };
    const log1 = await logDe(COMPANY_A, `purchase_${venta1.id}`);
    await procesarConversion(log1.id);

    const config = await MetaConfig.findOne({ where: { companyId: COMPANY_A } });
    expect(config.status).toBe("error");
    expect(config.lastError).toContain("190");
    expect((await log1.reload()).status).toBe("blocked");
    expect(await Sale.findByPk(venta1.id)).not.toBeNull();

    const antes = encolados.length;
    const venta2 = await vender(COMPANY_A, contacto.id);
    const log2 = await logDe(COMPANY_A, `purchase_${venta2.id}`);
    expect(log2.status).toBe("blocked");
    expect(encolados.length).toBe(antes);

    await guardarConfigMeta(
      COMPANY_A,
      { datasetId: "111111111", accessToken: "EAAtokenNuevoCorregido00000000009" },
      async () => ({ ok: true })
    );

    expect((await MetaConfig.findOne({ where: { companyId: COMPANY_A } })).status).toBe("ok");
    expect((await log1.reload()).status).toBe("pending");
    expect((await log2.reload()).status).toBe("pending");
    const reencolados = encolados.slice(antes).map(e => e.logId);
    expect(reencolados).toEqual(expect.arrayContaining([log1.id, log2.id]));
  });

  it("un error transitorio lanza para que Bull reintente, y al agotar los intentos queda failed", async () => {
    await configurar(COMPANY_A);
    const contacto = await nuevoContacto(COMPANY_A);
    const venta = await vender(COMPANY_A, contacto.id);
    const log = await logDe(COMPANY_A, `purchase_${venta.id}`);

    respuesta = { status: "transient_error", error: "HTTP 503" };

    await expect(procesarConversion(log.id, { attemptsMade: 0, maxAttempts: 3 })).rejects.toThrow();
    expect((await log.reload()).status).toBe("pending");

    await procesarConversion(log.id, { attemptsMade: 2, maxAttempts: 3 });
    expect((await log.reload()).status).toBe("failed");
  });
});

describe("atribucion Click-to-WhatsApp", () => {
  it("guarda el ctwa_clid con el WABA y solo lo reemplaza un clic nuevo", async () => {
    const contacto = await nuevoContacto(COMPANY_A);
    const whatsapp = { id: null, waba_id: "998877" } as any;
    const hace1h = Math.floor((Date.now() - 60 * 60 * 1000) / 1000);

    await guardarAtribucion({ companyId: COMPANY_A, contactId: contacto.id, whatsapp, referral: { ctwa_clid: "CLID-A", headline: "Anuncio 1" }, recibidoEn: hace1h });
    await guardarAtribucion({ companyId: COMPANY_A, contactId: contacto.id, whatsapp, referral: { ctwa_clid: "CLID-A", headline: "Otro texto" } });

    const primera = await ContactAttribution.findOne({ where: { contactId: contacto.id } });
    expect(primera.ctwaClid).toBe("CLID-A");
    expect(primera.wabaId).toBe("998877");
    expect(primera.headline).toBe("Anuncio 1");

    await guardarAtribucion({ companyId: COMPANY_A, contactId: contacto.id, whatsapp, referral: { ctwa_clid: "CLID-B", headline: "Anuncio 2" } });
    const segunda = await ContactAttribution.findOne({ where: { contactId: contacto.id } });
    expect(segunda.ctwaClid).toBe("CLID-B");
    expect(new Date(segunda.firstCapturedAt).getTime()).toBe(new Date(primera.firstCapturedAt).getTime());

    expect(await ContactAttribution.count({ where: { contactId: contacto.id } })).toBe(1);
  });

  it("sin referral no guarda nada y nunca lanza", async () => {
    const contacto = await nuevoContacto(COMPANY_A);
    await expect(
      guardarAtribucion({ companyId: COMPANY_A, contactId: contacto.id, whatsapp: null, referral: null })
    ).resolves.toBeNull();
    expect(await ContactAttribution.count({ where: { contactId: contacto.id } })).toBe(0);
  });

  it("el Lead de un contacto que llego por un anuncio sale atribuido como LeadSubmitted", async () => {
    await configurar(COMPANY_A);
    const contacto = await nuevoContacto(COMPANY_A);
    await guardarAtribucion({ companyId: COMPANY_A, contactId: contacto.id, whatsapp: { id: null, waba_id: "998877" } as any, referral: { ctwa_clid: "CLID-LEAD" } });

    registrarLeadEntrante(contacto, { mensajeEn: Date.now() });
    await esperarConversionesEnCurso();

    const log = await logDe(COMPANY_A, `lead_${contacto.id}`);
    expect(log).not.toBeNull();

    const construido = await construirEvento(log);
    if (!("evento" in construido)) throw new Error(`no se construyo: ${construido.motivo}`);
    expect(construido.evento.attribution.ctwaClid).toBe("CLID-LEAD");

    const envio = construirEventoMeta(construido.evento);
    expect(envio.ruta).toBe("business_messaging");
    expect(envio.evento.event_name).toBe("LeadSubmitted");
  });

  it("no hay lead por mensajes viejos ni por grupos", async () => {
    await configurar(COMPANY_A);
    const viejo = await nuevoContacto(COMPANY_A);
    const grupo = await nuevoContacto(COMPANY_A, { isGroup: true });

    registrarLeadEntrante(viejo, { mensajeEn: Date.now() - 2 * 24 * 60 * 60 * 1000 });
    registrarLeadEntrante(grupo, { mensajeEn: Date.now() });
    await esperarConversionesEnCurso();

    expect(await logDe(COMPANY_A, `lead_${viejo.id}`)).toBeNull();
    expect(await logDe(COMPANY_A, `lead_${grupo.id}`)).toBeNull();
  });
});
