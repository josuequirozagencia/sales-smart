import Company from "../../models/Company";
import Contact from "../../models/Contact";
import GhlConfig from "../../models/GhlConfig";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import {
  enviarPlantillaGhl,
  guardarMapa,
  plantillasEnviables,
  textoConVariables,
  variablesDe
} from "../../services/GhlServices/PlantillasGhlService";
import { guardarConfiguracion } from "../../services/GhlServices/GhlConfigService";
import ListTemplatesService from "../../services/WhatsappService/ListTemplatesService";
import { actualizarCamposContacto, inscribirEnFlujo } from "../../services/GhlServices/GhlApiClient";
import { closeConnection, uniqueSuffix } from "../helpers/db";

jest.mock("../../libs/socket", () => ({ getIO: () => ({ of: () => ({ emit: () => undefined }) }) }));
// Meta (lista de plantillas) y GHL (campos e inscripcion) son externos.
jest.mock("../../services/WhatsappService/ListTemplatesService", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../services/GhlServices/GhlApiClient", () => ({
  clienteDeEmpresa: jest.fn(async () => ({})),
  upsertContacto: jest.fn(async () => "ghl-contacto"),
  actualizarCamposContacto: jest.fn(async () => ({ ok: true })),
  inscribirEnFlujo: jest.fn(async () => ({ ok: true })),
  enviarMensaje: jest.fn()
}));
const listaMeta = ListTemplatesService as unknown as jest.Mock;
const camposMock = actualizarCamposContacto as jest.Mock;
const inscribirMock = inscribirEnFlujo as jest.Mock;

// Plantillas en tickets de GHL, enviadas con un Workflow (la via documentada
// de GHL): variables a campos personalizados + inscripcion + nota interna.

const BIENVENIDA = {
  id: "1",
  name: "bienvenida",
  language: "es",
  status: "APPROVED",
  category: "MARKETING",
  components: [
    { type: "HEADER", format: "TEXT", text: "Hola {{1}}" },
    { type: "BODY", text: "Tu curso {{1}} empieza el {{2}}." },
    { type: "FOOTER", text: "Academia" }
  ]
};
const CON_IMAGEN = {
  id: "2",
  name: "promo",
  language: "es",
  status: "APPROVED",
  category: "MARKETING",
  components: [{ type: "HEADER", format: "IMAGE" }, { type: "BODY", text: "Oferta" }]
};
const PENDIENTE = { ...BIENVENIDA, id: "3", name: "borrador", status: "PENDING" };

let empresa: Company;
let conexion: Whatsapp;
let contacto: Contact;
let ticket: Ticket;

beforeAll(async () => {
  empresa = await Company.create({ name: `ghl-plantillas-${uniqueSuffix()}`, planId: 1, status: true } as any);
  conexion = await Whatsapp.create({ name: `ghl-${uniqueSuffix()}`, channel: "ghl", companyId: empresa.id, status: "CONNECTED", isDefault: false } as any);
  await guardarConfiguracion({ companyId: empresa.id, token: "pit-no-real", locationId: "loc-1", isActive: true });
  contacto = await Contact.create({
    name: "Ana",
    number: `5939${String(Date.now()).slice(-8)}`,
    companyId: empresa.id,
    ghlContactId: "ghl-ana"
  } as any);
  ticket = await Ticket.create({ status: "open", companyId: empresa.id, contactId: contacto.id, whatsappId: conexion.id, channel: "ghl", isGroup: false } as any);
});

beforeEach(() => {
  listaMeta.mockResolvedValue({ data: [BIENVENIDA, CON_IMAGEN, PENDIENTE] });
  camposMock.mockClear();
  inscribirMock.mockClear();
});

afterAll(async () => {
  await Message.destroy({ where: { companyId: empresa.id } });
  await Ticket.destroy({ where: { companyId: empresa.id } });
  await Contact.destroy({ where: { companyId: empresa.id } });
  await GhlConfig.destroy({ where: { companyId: empresa.id } });
  await Whatsapp.destroy({ where: { id: conexion.id } });
  await empresa.destroy();
  await closeConnection();
});

describe("Variables de una plantilla", () => {
  it("toma las del encabezado de texto y del cuerpo, y pinta el texto con valores", () => {
    expect(variablesDe(BIENVENIDA)).toEqual({ claves: ["header.1", "body.1", "body.2"], soportada: true });
    expect(textoConVariables(BIENVENIDA, { "header.1": "Ana", "body.1": "Ingles", "body.2": "lunes" })).toBe(
      "Hola Ana\n\nTu curso Ingles empieza el lunes.\n\nAcademia"
    );
  });

  it("un encabezado multimedia o botones con variables no se pueden enviar desde aqui", () => {
    expect(variablesDe(CON_IMAGEN)).toMatchObject({ soportada: false, motivo: "HEADER_MEDIA" });
    const conBoton = { components: [{ type: "BUTTONS", buttons: [{ type: "URL", url: "https://x.com/{{1}}" }] }] };
    expect(variablesDe(conBoton)).toMatchObject({ soportada: false, motivo: "BUTTON_VARIABLES" });
  });
});

describe("Plantilla -> Workflow", () => {
  it("solo aprobadas; sin Workflow o sin campos para sus variables no son enviables", async () => {
    await guardarMapa(empresa.id, [
      { name: "bienvenida", language: "es", workflowId: "wf-1", fields: { "header.1": { id: "cf-nombre" }, "body.1": { id: "cf-curso" } } }
    ]);
    let lista = await plantillasEnviables(empresa.id);
    expect(lista.map(p => p.name)).toEqual(["bienvenida", "promo"]);
    expect(lista.find(p => p.name === "bienvenida")).toMatchObject({ enviable: false, motivo: "MISSING_FIELDS" });
    expect(lista.find(p => p.name === "promo")).toMatchObject({ enviable: false, motivo: "HEADER_MEDIA" });

    await guardarMapa(empresa.id, [
      {
        name: "bienvenida",
        language: "es",
        workflowId: "wf-1",
        workflowName: "Bienvenida WhatsApp",
        fields: { "header.1": { id: "cf-nombre" }, "body.1": { id: "cf-curso" }, "body.2": { key: "contact.fecha_inicio" } }
      },
      { name: "promo", language: "es", workflowId: "" }
    ]);
    lista = await plantillasEnviables(empresa.id);
    expect(lista.find(p => p.name === "bienvenida")).toMatchObject({ enviable: true, workflowId: "wf-1" });
  });

  it("rechaza variables que no son del encabezado ni del cuerpo", async () => {
    await expect(
      guardarMapa(empresa.id, [{ name: "x", language: "es", workflowId: "wf", fields: { "buttons.1": { id: "a" } } }])
    ).rejects.toMatchObject({ message: "ERR_GHL_PLANTILLAS_INVALIDAS" });
  });
});

describe("Envio desde un ticket de GHL", () => {
  it("rellena los campos, inscribe en el Workflow y deja una nota interna con el texto", async () => {
    await enviarPlantillaGhl({
      ticketId: ticket.id,
      companyId: empresa.id,
      name: "bienvenida",
      language: "es",
      valores: { "header.1": "Ana", "body.1": "Ingles", "body.2": "lunes" }
    });

    expect(camposMock).toHaveBeenCalledWith({}, "ghl-ana", [
      { id: "cf-nombre", fieldValue: "Ana" },
      { id: "cf-curso", fieldValue: "Ingles" },
      { key: "contact.fecha_inicio", fieldValue: "lunes" }
    ]);
    expect(inscribirMock).toHaveBeenCalledWith({}, "ghl-ana", "wf-1");

    const nota = await Message.findOne({ where: { ticketId: ticket.id, isPrivate: true }, order: [["createdAt", "DESC"]] });
    expect(nota!.body).toContain("Plantilla «bienvenida» (es)");
    expect(nota!.body).toContain("Tu curso Ingles empieza el lunes.");
  });

  it("sin todas las variables no envia nada", async () => {
    await expect(
      enviarPlantillaGhl({ ticketId: ticket.id, companyId: empresa.id, name: "bienvenida", language: "es", valores: { "header.1": "Ana" } })
    ).rejects.toMatchObject({ message: "ERR_GHL_PLANTILLA_FALTAN_VARIABLES" });
    expect(inscribirMock).not.toHaveBeenCalled();
  });

  it("una plantilla sin Workflow o que ya no esta aprobada no se envia", async () => {
    await expect(
      enviarPlantillaGhl({ ticketId: ticket.id, companyId: empresa.id, name: "promo", language: "es", valores: {} })
    ).rejects.toMatchObject({ message: "ERR_GHL_PLANTILLA_SIN_WORKFLOW" });
    listaMeta.mockResolvedValue({ data: [{ ...BIENVENIDA, status: "PAUSED" }] });
    await expect(
      enviarPlantillaGhl({
        ticketId: ticket.id,
        companyId: empresa.id,
        name: "bienvenida",
        language: "es",
        valores: { "header.1": "a", "body.1": "b", "body.2": "c" }
      })
    ).rejects.toMatchObject({ message: "ERR_GHL_PLANTILLA_NO_APROBADA" });
    expect(inscribirMock).not.toHaveBeenCalled();
  });

  it("otra empresa no puede enviar en este ticket", async () => {
    const otra = await Company.create({ name: `ghl-otra-${uniqueSuffix()}`, planId: 1, status: true } as any);
    try {
      await expect(
        enviarPlantillaGhl({ ticketId: ticket.id, companyId: otra.id, name: "bienvenida", language: "es", valores: {} })
      ).rejects.toBeTruthy();
      expect(inscribirMock).not.toHaveBeenCalled();
    } finally {
      await otra.destroy();
    }
  });
});
