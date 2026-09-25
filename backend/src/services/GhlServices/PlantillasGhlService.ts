import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import logger from "../../utils/logger";
import ShowTicketService from "../TicketServices/ShowTicketService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import ListTemplatesService from "../WhatsappService/ListTemplatesService";
import { PlantillaMeta } from "../WhatsappService/MetaTemplatesClient";
import { buscarIntegracion } from "./GhlConfigService";
import { actualizarCamposContacto, clienteDeEmpresa, inscribirEnFlujo } from "./GhlApiClient";
import { buscarConexion, CANAL } from "./ReceiveGhlMessageService";
import { resolverContactoGhl } from "./SendGhlMessage";

/**
 * Envio de plantillas de WhatsApp aprobadas en tickets de GoHighLevel.
 *
 * GHL no documenta como enviar una plantilla por su API de mensajes (solo un
 * `templateId` generico, sin variables ni idioma). La via documentada es un
 * Workflow con la accion "Send WhatsApp": aqui se guarda que Workflow envia
 * cada plantilla y en que campos personalizados del contacto van sus
 * variables. Enviar = dar valor a esos campos (PUT /contacts/{id}) e inscribir
 * al contacto en el Workflow (POST /contacts/{id}/workflow/{workflowId}).
 *
 * El mensaje lo envia GHL, no Sales Smart: en el ticket queda una nota interna
 * con el texto, no un mensaje "entregado" que no nos consta.
 */

export interface CampoGhl {
  /** Id del campo personalizado en GHL (preferido). */
  id?: string;
  /** Clave del campo (p. ej. "contact.nombre_curso"), si no hay id. */
  key?: string;
}

export interface PlantillaWorkflow {
  name: string;
  language: string;
  workflowId: string;
  workflowName?: string;
  /** Variable ("header.1", "body.2"...) -> campo personalizado de GHL. */
  fields: Record<string, CampoGhl>;
}

export interface VariablesPlantilla {
  claves: string[];
  soportada: boolean;
  motivo?: string;
}

const VARIABLE = /{{\s*(\d+)\s*}}/g;
const TIENE_VARIABLE = /{{\s*\d+\s*}}/;

/**
 * Variables de una plantilla de Meta. Se admiten las de texto del encabezado y
 * del cuerpo; un encabezado multimedia o botones con variables no se pueden
 * rellenar con campos de texto del contacto.
 */
export const variablesDe = (plantilla: Pick<PlantillaMeta, "components">): VariablesPlantilla => {
  const claves: string[] = [];
  for (const c of plantilla.components || []) {
    const tipo = String(c?.type || "").toUpperCase();
    if (tipo === "HEADER" && c.format && String(c.format).toUpperCase() !== "TEXT") {
      return { claves, soportada: false, motivo: "HEADER_MEDIA" };
    }
    if (tipo === "BUTTONS") {
      const botones = Array.isArray(c.buttons) ? c.buttons : [];
      if (botones.some((b: any) => TIENE_VARIABLE.test(String(b?.url || "")) || (b?.example && b.example.length))) {
        return { claves, soportada: false, motivo: "BUTTON_VARIABLES" };
      }
    }
    if (tipo === "HEADER" || tipo === "BODY") {
      const texto = String(c.text || "");
      let m: RegExpExecArray | null;
      VARIABLE.lastIndex = 0;
      while ((m = VARIABLE.exec(texto)) !== null) {
        const clave = `${tipo.toLowerCase()}.${m[1]}`;
        if (!claves.includes(clave)) claves.push(clave);
      }
    }
  }
  return { claves, soportada: true };
};

/** Texto de la plantilla con las variables ya puestas, para la nota interna. */
export const textoConVariables = (plantilla: Pick<PlantillaMeta, "components">, valores: Record<string, string>): string =>
  (plantilla.components || [])
    .filter(c => ["HEADER", "BODY", "FOOTER"].includes(String(c?.type || "").toUpperCase()) && c.text)
    .map(c => {
      const tipo = String(c.type).toLowerCase();
      return String(c.text).replace(VARIABLE, (_, n) => valores[`${tipo}.${n}`] ?? `{{${n}}}`);
    })
    .join("\n\n");

export const leerMapa = (texto: string | null | undefined): PlantillaWorkflow[] => {
  try {
    const lista = JSON.parse(texto || "[]");
    return Array.isArray(lista) ? lista : [];
  } catch (err) {
    return [];
  }
};

const mismaPlantilla = (a: { name: string; language: string }, b: { name: string; language: string }) =>
  a.name === b.name && a.language === b.language;

/** Valida y guarda el mapa plantilla -> Workflow de la empresa. */
export const guardarMapa = async (companyId: number, entradas: unknown): Promise<PlantillaWorkflow[]> => {
  const fila = await buscarIntegracion(companyId);
  if (!fila) throw new AppError("ERR_GHL_NO_CONFIGURADO", 400);
  if (!Array.isArray(entradas)) throw new AppError("ERR_GHL_PLANTILLAS_INVALIDAS", 400);

  const mapa: PlantillaWorkflow[] = [];
  for (const e of entradas as any[]) {
    const name = String(e?.name || "").trim();
    const language = String(e?.language || "").trim();
    const workflowId = String(e?.workflowId || "").trim();
    if (!name || !language) throw new AppError("ERR_GHL_PLANTILLAS_INVALIDAS", 400);
    // Sin Workflow la plantilla simplemente no se puede enviar: no se guarda.
    if (!workflowId) continue;
    const fields: Record<string, CampoGhl> = {};
    for (const [variable, campo] of Object.entries(e?.fields || {})) {
      if (!/^(header|body)\.\d+$/.test(variable)) throw new AppError("ERR_GHL_PLANTILLAS_INVALIDAS", 400);
      const id = String((campo as any)?.id || "").trim();
      const key = String((campo as any)?.key || "").trim();
      if (id || key) fields[variable] = id ? { id } : { key };
    }
    if (mapa.some(m => mismaPlantilla(m, { name, language }))) continue;
    mapa.push({ name, language, workflowId, workflowName: String(e?.workflowName || ""), fields });
  }
  await fila.update({ templateWorkflows: JSON.stringify(mapa) });
  return mapa;
};

export interface PlantillaEnviable extends PlantillaMeta {
  workflowId: string | null;
  workflowName: string | null;
  variables: string[];
  enviable: boolean;
  /** Por que no se puede enviar: NO_WORKFLOW, MISSING_FIELDS, HEADER_MEDIA... */
  motivo?: string;
}

/**
 * Plantillas aprobadas de la conexion GHL con lo que hace falta para enviarlas
 * desde un ticket. Las lee de Meta (ListTemplatesService).
 */
export const plantillasEnviables = async (companyId: number): Promise<PlantillaEnviable[]> => {
  const conexion = await buscarConexion(companyId);
  if (!conexion) throw new AppError("ERR_GHL_NO_CONFIGURADO", 400);
  const [lista, fila] = await Promise.all([ListTemplatesService(conexion.id, companyId), buscarIntegracion(companyId)]);
  const mapa = leerMapa(fila?.templateWorkflows);

  return lista.data
    .filter(p => String(p.status).toUpperCase() === "APPROVED")
    .map(p => {
      const variables = variablesDe(p);
      const asignada = mapa.find(m => mismaPlantilla(m, p));
      let motivo: string | undefined;
      if (!variables.soportada) motivo = variables.motivo;
      else if (!asignada) motivo = "NO_WORKFLOW";
      else if (variables.claves.some(v => !asignada.fields[v])) motivo = "MISSING_FIELDS";
      return {
        ...p,
        workflowId: asignada?.workflowId || null,
        workflowName: asignada?.workflowName || null,
        variables: variables.claves,
        enviable: !motivo,
        motivo
      };
    });
};

/**
 * Envia una plantilla en un ticket de GHL: rellena los campos del contacto,
 * lo inscribe en el Workflow y deja una nota interna en el ticket.
 */
export const enviarPlantillaGhl = async ({
  ticketId,
  companyId,
  name,
  language,
  valores
}: {
  ticketId: number;
  companyId: number;
  name: string;
  language: string;
  valores: Record<string, string>;
}): Promise<{ ok: true }> => {
  const ticket = await ShowTicketService(ticketId, companyId);
  if (ticket.channel !== CANAL) throw new AppError("ERR_GHL_TICKET_NO_GHL", 400);

  const fila = await buscarIntegracion(companyId);
  const asignada = leerMapa(fila?.templateWorkflows).find(m => mismaPlantilla(m, { name, language }));
  if (!asignada) throw new AppError("ERR_GHL_PLANTILLA_SIN_WORKFLOW", 400);

  // La plantilla tiene que seguir aprobada en Meta, y de ella salen sus variables.
  const conexion = await buscarConexion(companyId);
  if (!conexion) throw new AppError("ERR_GHL_NO_CONFIGURADO", 400);
  const plantilla = (await ListTemplatesService(conexion.id, companyId)).data.find(
    p => mismaPlantilla(p, { name, language }) && String(p.status).toUpperCase() === "APPROVED"
  );
  if (!plantilla) throw new AppError("ERR_GHL_PLANTILLA_NO_APROBADA", 400);

  const variables = variablesDe(plantilla);
  if (!variables.soportada) throw new AppError("ERR_GHL_PLANTILLA_NO_SOPORTADA", 400);
  const faltan = variables.claves.filter(v => !String(valores?.[v] ?? "").trim() || !asignada.fields[v]);
  if (faltan.length) throw new AppError("ERR_GHL_PLANTILLA_FALTAN_VARIABLES", 400);

  // El contacto completo: el que trae el ticket no incluye ghlContactId.
  const contacto = await Contact.findOne({ where: { id: ticket.contactId, companyId } });
  if (!contacto) throw new AppError("ERR_GHL_TICKET_SIN_CONTACTO", 400);
  const cliente = await clienteDeEmpresa(companyId);
  const contactIdGhl = await resolverContactoGhl(cliente, contacto);
  if (!contactIdGhl) throw new AppError("ERR_GHL_CONTACTO_NO_RESUELTO", 400);

  if (variables.claves.length) {
    const campos = variables.claves.map(v => ({ ...asignada.fields[v], fieldValue: String(valores[v]).trim() }));
    const r = await actualizarCamposContacto(cliente, contactIdGhl, campos);
    if (!r.ok) throw new AppError(`ERR_GHL_CAMPOS: ${r.error}`, 400);
  }

  const inscripcion = await inscribirEnFlujo(cliente, contactIdGhl, asignada.workflowId);
  if (!inscripcion.ok) throw new AppError(`ERR_GHL_INSCRIPCION: ${inscripcion.error}`, 400);

  // Nota interna: el mensaje lo manda GHL; aqui queda constancia de que se
  // pidio y de con que texto.
  const texto = textoConVariables(plantilla, valores);
  await CreateMessageService({
    messageData: {
      wid: `PVT_ghl_tpl_${ticket.id}_${Date.now()}`,
      ticketId: ticket.id,
      contactId: undefined,
      body: `📋 Plantilla «${name}» (${language}) enviada con el Workflow de GHL${
        asignada.workflowName ? ` «${asignada.workflowName}»` : ""
      }:\n\n${texto}`,
      fromMe: true,
      mediaType: "extendedTextMessage",
      read: true,
      ack: 2,
      isPrivate: true,
      channel: CANAL
    } as any,
    companyId
  });

  logger.info(`[GHL] plantilla ${name} (${language}) -> Workflow ${asignada.workflowId}, ticket ${ticket.id}`);
  return { ok: true };
};
