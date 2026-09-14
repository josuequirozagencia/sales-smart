import fs from "fs";
import path from "path";
import crypto from "crypto";
import { QueryTypes, Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import CompanyConfigClone from "../../models/CompanyConfigClone";
import uploadConfig from "../../config/upload";
import { generateHashWebhookId } from "../../utils/GenerateHashWebhookId";
import logger from "../../utils/logger";

/**
 * Copia la configuracion de una empresa a otra ya creada.
 *
 * Solo para superadministrador (el controlador lo comprueba). Pensado para
 * montar una empresa nueva a partir de otra que sirve de plantilla.
 *
 * QUE SE COPIA
 *   Etiquetas y columnas del Kanban, colas con su arbol de opciones,
 *   productos de cola, integraciones (SIN credenciales), chatbot,
 *   listas de ficheros con sus archivos, mensajes rapidos con sus
 *   adjuntos y componentes, prompts (SIN claves de IA), ajustes de la
 *   empresa y de cumpleanos, ajustes de campana, motivos de finalizacion,
 *   presets de webhook propios de la empresa y webhooks.
 *
 * QUE NO SE COPIA
 *   Canales y sus credenciales, usuarios, datos operativos (contactos,
 *   tickets, mensajes, campanas, ventas, citas...), anuncios y todo
 *   FlowBuilder, que queda para una segunda fase: su JSON referencia ids
 *   de otros recursos y copiarlo sin remapear dejaria flujos rotos por
 *   dentro.
 *
 * COMO
 *   Todo va en UNA transaccion: si algo falla a mitad, la empresa destino
 *   queda como estaba. Los archivos copiados, que la base no puede
 *   deshacer, se borran a mano en ese caso.
 *
 *   Las filas se copian con INSERT ... SELECT columna a columna, leyendo
 *   las columnas reales de la tabla. Asi se copia todo lo que la fila
 *   tiene, aunque el modelo de Sequelize no lo declare, y se evitan los
 *   getters de los modelos: QuickMessage.mediaPath, por ejemplo, devuelve
 *   una URL completa y no el nombre de archivo guardado.
 *
 *   Los ids se remapean en dos pasadas. En la primera, cada fila nueva se
 *   inserta con sus referencias ya traducidas cuando el destino se conoce,
 *   y con el id viejo cuando apunta a la misma tabla (arbol de opciones,
 *   arbol del chatbot, encadenado de columnas del Kanban). En la segunda se
 *   traducen esas autorreferencias con el mapa id viejo -> id nuevo. Una
 *   referencia sin equivalente en destino queda en null: nunca se deja un
 *   puntero a una fila de la empresa origen.
 *
 *   Es aditivo: lo que la empresa destino ya tenia no se borra ni se
 *   sobrescribe, salvo CompaniesSettings y BirthdaySettings, que son una
 *   fila por empresa y se actualizan.
 */

interface Peticion {
  sourceCompanyId: number;
  targetCompanyId: number;
  userId?: number;
}

export interface ResumenClon {
  origen: number;
  destino: number;
  /** Filas nuevas creadas en destino, por tipo. */
  copiados: Record<string, number>;
  /** Ya existian en destino con el mismo nombre o clave: se dejan como estan. */
  yaExistian: Record<string, number>;
  /** Filas de origen que por regla no se copian. */
  omitidos: Record<string, number>;
  archivos: { copiados: number; ausentes: string[] };
  avisos: string[];
}

type Fila = Record<string, any>;
type Mapa = Map<number, number>;

interface Contexto {
  t: Transaction;
  origen: number;
  destino: number;
  columnasPorTabla: Map<string, string[]>;
  archivosCreados: string[];
  resumen: ResumenClon;
}

const PUBLICO: string = (uploadConfig as any).directory;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const leer = async (
  ctx: Contexto,
  sql: string,
  reemplazos: Fila = {}
): Promise<Fila[]> =>
  (await sequelize.query(sql, {
    replacements: reemplazos,
    type: QueryTypes.SELECT,
    transaction: ctx.t
  })) as Fila[];

const existe = async (ctx: Contexto, sql: string, reemplazos: Fila) =>
  (await leer(ctx, sql, reemplazos)).length > 0;

const sumar = (bolsa: Record<string, number>, clave: string, cuanto = 1) => {
  bolsa[clave] = (bolsa[clave] || 0) + cuanto;
};

/**
 * Columnas reales de una tabla, sin la clave primaria.
 *
 * Se leen de la base y no del modelo porque la tabla manda: hay modelos
 * que declaran columnas que su tabla no tiene (Webhook declara
 * requestMonth, requestAll y active, que no existen).
 */
const columnas = async (ctx: Contexto, tabla: string): Promise<string[]> => {
  const guardadas = ctx.columnasPorTabla.get(tabla);
  if (guardadas) return guardadas;

  const filas = await leer(
    ctx,
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = :tabla
      order by ordinal_position`,
    { tabla }
  );
  const lista = filas.map(f => f.column_name).filter(c => c !== "id");
  if (!lista.length) throw new Error(`La tabla ${tabla} no existe`);

  ctx.columnasPorTabla.set(tabla, lista);
  return lista;
};

/**
 * Copia una fila de una tabla en la misma tabla, con los cambios dados.
 *
 * Los valores nuevos van DENTRO del INSERT ... SELECT, no en un UPDATE
 * posterior: las columnas con indice unico (el nombre y el color de una
 * cola por empresa, el nombre de una integracion en toda la base)
 * fallarian en el insert, antes de que el update llegara a cambiarlas.
 */
const clonarFila = async (
  ctx: Contexto,
  tabla: string,
  idOrigen: number,
  cambios: Fila
): Promise<number> => {
  const cols = await columnas(ctx, tabla);
  const ahora = new Date();

  const todos: Fila = {
    ...(cols.includes("createdAt") ? { createdAt: ahora } : {}),
    ...(cols.includes("updatedAt") ? { updatedAt: ahora } : {}),
    ...cambios
  };

  // Un cambio sobre una columna que no existe es un error de programacion,
  // no un dato raro: se para aqui en vez de copiar algo a medias.
  const desconocidas = Object.keys(todos).filter(c => !cols.includes(c));
  if (desconocidas.length) {
    throw new Error(`${tabla} no tiene las columnas: ${desconocidas.join(", ")}`);
  }

  const reemplazos: Fila = { idOrigen };
  const seleccion = cols.map(c => {
    if (!(c in todos)) return `"${c}"`;
    reemplazos[`v_${c}`] = todos[c];
    return `:v_${c}`;
  });

  const [nueva] = await leer(
    ctx,
    `insert into "${tabla}" (${cols.map(c => `"${c}"`).join(", ")})
     select ${seleccion.join(", ")} from "${tabla}" where id = :idOrigen
     returning id`,
    reemplazos
  );

  if (!nueva) throw new Error(`No se pudo copiar ${tabla} ${idOrigen}`);
  return nueva.id;
};

const actualizar = async (
  ctx: Contexto,
  tabla: string,
  id: number,
  cambios: Fila
) => {
  const claves = Object.keys(cambios);
  if (!claves.length) return;
  const reemplazos: Fila = { id };
  const sets = claves.map(c => {
    reemplazos[`v_${c}`] = cambios[c];
    return `"${c}" = :v_${c}`;
  });
  await leer(
    ctx,
    `update "${tabla}" set ${sets.join(", ")} where id = :id returning id`,
    reemplazos
  );
};

/**
 * Primer valor libre para una columna unica: el original y, si esta
 * ocupado, con un sufijo creciente.
 */
const valorLibre = async (
  ctx: Contexto,
  tabla: string,
  columna: string,
  base: string,
  sufijo: (n: number) => string,
  filtro = "",
  reemplazosFiltro: Fila = {}
): Promise<string> => {
  for (let n = 0; n < 500; n++) {
    const candidato = n === 0 ? base : `${base}${sufijo(n)}`;
    const ocupado = await existe(
      ctx,
      `select 1 from "${tabla}" where "${columna}" = :candidato ${filtro} limit 1`,
      { candidato, ...reemplazosFiltro }
    );
    if (!ocupado) return candidato;
  }
  throw new Error(`No hay valor libre para ${tabla}.${columna} a partir de "${base}"`);
};

/** Color de cola libre en la empresa destino: (color, companyId) es unico. */
const colorLibre = async (ctx: Contexto, color: string): Promise<string> => {
  const ocupado = (c: string) =>
    existe(
      ctx,
      `select 1 from "Queues" where color = :c and "companyId" = :d limit 1`,
      { c, d: ctx.destino }
    );

  if (!(await ocupado(color))) return color;

  for (let i = 0; i < 200; i++) {
    const candidato = "#" + crypto.randomBytes(3).toString("hex");
    if (!(await ocupado(candidato))) return candidato;
  }
  throw new Error("No se encontro un color libre para la cola");
};

/**
 * Copia un archivo de la carpeta de la empresa origen a la de destino y
 * devuelve el nombre con el que quedo.
 *
 * Solo se aceptan nombres de archivo sueltos: si el valor guardado
 * contuviera una ruta, no se copia y se avisa, en vez de leer o escribir
 * fuera de la carpeta publica.
 *
 * Si el archivo de origen ya no esta en disco, la fila se copia igual —con
 * el mismo nombre, rota igual que en origen— y se anota en el resumen.
 */
const copiarArchivo = (
  ctx: Contexto,
  carpetaOrigen: string[],
  carpetaDestino: string[],
  nombre: string
): string => {
  if (!nombre) return nombre;

  if (path.basename(nombre) !== nombre) {
    ctx.resumen.avisos.push(`Nombre de archivo con ruta, no se copia: ${nombre}`);
    return nombre;
  }

  const origen = path.join(PUBLICO, ...carpetaOrigen, nombre);
  if (!fs.existsSync(origen)) {
    ctx.resumen.archivos.ausentes.push(path.join(...carpetaOrigen, nombre));
    return nombre;
  }

  const dirDestino = path.join(PUBLICO, ...carpetaDestino);
  fs.mkdirSync(dirDestino, { recursive: true });

  let final = nombre;
  if (fs.existsSync(path.join(dirDestino, final))) {
    final = `${Date.now()}-${nombre}`;
  }

  const destino = path.join(dirDestino, final);
  fs.copyFileSync(origen, destino, fs.constants.COPYFILE_EXCL);
  ctx.archivosCreados.push(destino);
  ctx.resumen.archivos.copiados++;
  return final;
};

const traducir = (mapa: Mapa, viejo: number | null): number | null =>
  viejo === null || viejo === undefined ? null : mapa.get(viejo) ?? null;

// ---------------------------------------------------------------------------
// Cada tipo de configuracion
// ---------------------------------------------------------------------------

interface Mapas {
  integraciones: Mapa;
  ficheros: Mapa;
  etiquetas: Mapa;
  colas: Mapa;
  opciones: Mapa;
  chatbots: Mapa;
  rapidos: Mapa;
}

interface Creadas {
  etiquetas: number[];
  opciones: number[];
  chatbots: number[];
}

/**
 * Integraciones SIN credenciales y desconectadas.
 *
 * jsonContent guarda la cuenta de servicio de Dialogflow y urlN8N la URL
 * del n8n o Typebot de la empresa origen: copiarlos haria que las
 * conversaciones de la empresa destino acabaran en sistemas de la origen.
 * Se vacian, y las colas y el chatbot copiados no se enlazan a ellas: sin
 * credenciales, un bot enlazado fallaria con clientes reales. El admin las
 * completa y las vuelve a enlazar.
 *
 * name y projectName son unicos en TODA la base, asi que la copia lleva
 * un sufijo con la empresa destino.
 */
const clonarIntegraciones = async (ctx: Contexto, mapas: Mapas) => {
  const filas = await leer(
    ctx,
    `select id, name, "projectName" from "QueueIntegrations"
      where "companyId" = :o order by id`,
    { o: ctx.origen }
  );

  const sufijo = (n: number) =>
    n === 1 ? ` (empresa ${ctx.destino})` : ` (empresa ${ctx.destino} ${n})`;

  for (const f of filas) {
    const name = await valorLibre(ctx, "QueueIntegrations", "name", f.name, sufijo);
    const projectName = await valorLibre(
      ctx, "QueueIntegrations", "projectName", f.projectName, sufijo
    );
    const nueva = await clonarFila(ctx, "QueueIntegrations", f.id, {
      companyId: ctx.destino,
      name,
      projectName,
      jsonContent: "",
      urlN8N: ""
    });
    mapas.integraciones.set(f.id, nueva);
    sumar(ctx.resumen.copiados, "integraciones");
  }

  if (filas.length) {
    ctx.resumen.avisos.push(
      `${filas.length} integracion(es) copiadas SIN credenciales ni URL y sin enlazar a colas ni al chatbot: hay que completarlas y enlazarlas en la empresa destino.`
    );
  }
};

/** Listas de ficheros y sus archivos: public/company{N}/fileList/{idLista}/. */
const clonarFicheros = async (ctx: Contexto, mapas: Mapas) => {
  const listas = await leer(
    ctx,
    `select id from "Files" where "companyId" = :o order by id`,
    { o: ctx.origen }
  );

  for (const l of listas) {
    const nueva = await clonarFila(ctx, "Files", l.id, { companyId: ctx.destino });
    mapas.ficheros.set(l.id, nueva);
    sumar(ctx.resumen.copiados, "listasDeFicheros");
  }

  if (!mapas.ficheros.size) return;

  const opciones = await leer(
    ctx,
    `select id, "fileId", path from "FilesOptions"
      where "fileId" in (:ids) order by id`,
    { ids: [...mapas.ficheros.keys()] }
  );

  for (const o of opciones) {
    const listaNueva = mapas.ficheros.get(o.fileId);
    // La carpeta lleva el id de la lista, y ese id cambia en destino.
    const nombre = copiarArchivo(
      ctx,
      [`company${ctx.origen}`, "fileList", String(o.fileId)],
      [`company${ctx.destino}`, "fileList", String(listaNueva)],
      o.path
    );
    await clonarFila(ctx, "FilesOptions", o.id, { fileId: listaNueva, path: nombre });
    sumar(ctx.resumen.copiados, "archivosDeListas");
  }
};

/**
 * Etiquetas y columnas del Kanban.
 *
 * Si la empresa destino ya tiene una etiqueta con el mismo nombre y el
 * mismo tipo (Kanban o no), se reutiliza en vez de duplicarla: dos
 * columnas con el mismo nombre romperian el tablero. La existente no se
 * toca; solo se usa como destino del encadenado de las copiadas.
 */
const clonarEtiquetas = async (ctx: Contexto, mapas: Mapas, creadas: Creadas) => {
  const etiquetas = await leer(
    ctx,
    `select id, name, coalesce(kanban, 0) as kanban from "Tags"
      where "companyId" = :o order by id`,
    { o: ctx.origen }
  );

  for (const e of etiquetas) {
    const [existente] = await leer(
      ctx,
      `select id from "Tags"
        where "companyId" = :d and name = :n and coalesce(kanban, 0) = :k
        order by id limit 1`,
      { d: ctx.destino, n: e.name, k: e.kanban }
    );

    if (existente) {
      mapas.etiquetas.set(e.id, existente.id);
      sumar(ctx.resumen.yaExistian, "etiquetas");
      continue;
    }

    // nextLaneId y rollbackLaneId se copian con el id viejo y se traducen
    // en la segunda pasada, cuando ya existen todas las columnas.
    const nueva = await clonarFila(ctx, "Tags", e.id, { companyId: ctx.destino });
    mapas.etiquetas.set(e.id, nueva);
    creadas.etiquetas.push(nueva);
    sumar(ctx.resumen.copiados, "etiquetas");
  }
};

/**
 * Colas. (name, companyId) y (color, companyId) son unicos: si la empresa
 * destino ya tiene una cola con ese nombre o ese color, la copia cambia de
 * nombre o de color en vez de fallar.
 */
const clonarColas = async (ctx: Contexto, mapas: Mapas) => {
  const colas = await leer(
    ctx,
    `select id, name, color, "fileListId", "integrationId" from "Queues"
      where "companyId" = :o order by id`,
    { o: ctx.origen }
  );

  const sufijo = (n: number) => (n === 1 ? " (copia)" : ` (copia ${n})`);

  for (const c of colas) {
    const name = await valorLibre(
      ctx, "Queues", "name", c.name, sufijo,
      `and "companyId" = :emp`, { emp: ctx.destino }
    );
    const color = await colorLibre(ctx, c.color);

    const nueva = await clonarFila(ctx, "Queues", c.id, {
      companyId: ctx.destino,
      name,
      color,
      // Integraciones desconectadas: ver clonarIntegraciones.
      integrationId: null,
      fileListId: traducir(mapas.ficheros, c.fileListId)
    });

    if (name !== c.name) {
      ctx.resumen.avisos.push(`La cola «${c.name}» ya existia en destino: la copia se llama «${name}».`);
    }
    if (c.integrationId) sumar(ctx.resumen.omitidos, "enlacesColaIntegracion");

    mapas.colas.set(c.id, nueva);
    sumar(ctx.resumen.copiados, "colas");
  }
};

/** Arbol de opciones de cola: raices por queueId, hijas por parentId. */
const clonarOpcionesDeCola = async (ctx: Contexto, mapas: Mapas, creadas: Creadas) => {
  if (!mapas.colas.size) return;

  const opciones = await leer(
    ctx,
    `with recursive arbol(id) as (
       select id from "QueueOptions" where "queueId" in (:qs)
       union
       select o.id from "QueueOptions" o join arbol a on o."parentId" = a.id
     )
     select q.id, q."queueId" from "QueueOptions" q
      where q.id in (select id from arbol) order by q.id`,
    { qs: [...mapas.colas.keys()] }
  );

  for (const o of opciones) {
    const nueva = await clonarFila(ctx, "QueueOptions", o.id, {
      queueId: traducir(mapas.colas, o.queueId)
    });
    mapas.opciones.set(o.id, nueva);
    creadas.opciones.push(nueva);
    sumar(ctx.resumen.copiados, "opcionesDeCola");
  }
};

const clonarProductos = async (ctx: Contexto, mapas: Mapas) => {
  const productos = await leer(
    ctx,
    `select id, "queueId" from "QueueProducts" where "companyId" = :o order by id`,
    { o: ctx.origen }
  );

  for (const p of productos) {
    const queueId = traducir(mapas.colas, p.queueId);
    // queueId es NOT NULL: un producto cuya cola no se copio no tiene donde ir.
    if (!queueId) {
      sumar(ctx.resumen.omitidos, "productosSinCola");
      continue;
    }
    await clonarFila(ctx, "QueueProducts", p.id, { companyId: ctx.destino, queueId });
    sumar(ctx.resumen.copiados, "productos");
  }
};

/**
 * Arbol del chatbot: raices por queueId, hijos por chatbotId.
 *
 * optUserId apunta a un usuario de la empresa origen, que en destino no
 * existe: queda en null. optIntegrationId tambien, por la regla de las
 * integraciones desconectadas.
 */
const clonarChatbots = async (ctx: Contexto, mapas: Mapas, creadas: Creadas) => {
  if (!mapas.colas.size) return;

  const bots = await leer(
    ctx,
    `with recursive arbol(id) as (
       select id from "Chatbots" where "queueId" in (:qs)
       union
       select c.id from "Chatbots" c join arbol a on c."chatbotId" = a.id
     )
     select b.id, b."queueId", b."optQueueId", b."optFileId" from "Chatbots" b
      where b.id in (select id from arbol) order by b.id`,
    { qs: [...mapas.colas.keys()] }
  );

  for (const b of bots) {
    const nuevo = await clonarFila(ctx, "Chatbots", b.id, {
      queueId: traducir(mapas.colas, b.queueId),
      optQueueId: traducir(mapas.colas, b.optQueueId),
      optFileId: traducir(mapas.ficheros, b.optFileId),
      optIntegrationId: null,
      optUserId: null
    });
    mapas.chatbots.set(b.id, nuevo);
    creadas.chatbots.push(nuevo);
    sumar(ctx.resumen.copiados, "nodosDeChatbot");
  }
};

/**
 * Mensajes rapidos y sus componentes. Adjuntos en
 * public/company{N}/quickMessage/.
 *
 * - userId y whatsappId quedan en null: apuntan a un usuario y a un canal
 *   de la empresa origen.
 * - Los personales (geral = false) pasan a generales. Sin dueno, un
 *   mensaje personal no lo veria nadie.
 * - Las plantillas oficiales (isOficial) NO se copian: son espejo de las
 *   plantillas aprobadas por Meta en la cuenta de WhatsApp de la empresa
 *   origen, y en destino no existen.
 */
const clonarMensajesRapidos = async (ctx: Contexto, mapas: Mapas) => {
  const mensajes = await leer(
    ctx,
    `select id, "mediaPath", geral, "isOficial" from "QuickMessages"
      where "companyId" = :o order by id`,
    { o: ctx.origen }
  );

  let personales = 0;

  for (const m of mensajes) {
    if (m.isOficial === true) {
      sumar(ctx.resumen.omitidos, "plantillasOficiales");
      continue;
    }

    const cambios: Fila = { companyId: ctx.destino, userId: null, whatsappId: null };

    if (m.geral === false) {
      cambios.geral = true;
      personales++;
    }

    if (m.mediaPath) {
      cambios.mediaPath = copiarArchivo(
        ctx,
        [`company${ctx.origen}`, "quickMessage"],
        [`company${ctx.destino}`, "quickMessage"],
        m.mediaPath
      );
    }

    const nuevo = await clonarFila(ctx, "QuickMessages", m.id, cambios);
    mapas.rapidos.set(m.id, nuevo);
    sumar(ctx.resumen.copiados, "mensajesRapidos");
  }

  if (personales) {
    ctx.resumen.avisos.push(`${personales} mensaje(s) rapido(s) personales pasaron a generales: su dueno no existe en destino.`);
  }

  if (!mapas.rapidos.size) return;

  const componentes = await leer(
    ctx,
    `select id, "quickMessageId" from "QuickMessageComponents"
      where "quickMessageId" in (:ids) order by id`,
    { ids: [...mapas.rapidos.keys()] }
  );

  for (const c of componentes) {
    await clonarFila(ctx, "QuickMessageComponents", c.id, {
      quickMessageId: mapas.rapidos.get(c.quickMessageId)
    });
    sumar(ctx.resumen.copiados, "componentesDeRapidos");
  }
};

/**
 * Prompts SIN claves: apiKey, voiceKey y voiceRegion son de la cuenta de
 * IA (OpenAI / Azure) de la empresa origen; copiarlos haria que la destino
 * gastara con ella. apiKey es NOT NULL y queda vacia. Los contadores de
 * tokens son consumo de la origen y vuelven a cero.
 */
const clonarPrompts = async (ctx: Contexto, mapas: Mapas) => {
  const prompts = await leer(
    ctx,
    `select id, name, "queueId" from "Prompts" where "companyId" = :o order by id`,
    { o: ctx.origen }
  );

  for (const p of prompts) {
    const queueId = traducir(mapas.colas, p.queueId);
    // queueId es NOT NULL en esta tabla.
    if (!queueId) {
      sumar(ctx.resumen.omitidos, "promptsSinCola");
      ctx.resumen.avisos.push(`El prompt «${p.name}» no se copio: su cola no es de la empresa origen.`);
      continue;
    }
    await clonarFila(ctx, "Prompts", p.id, {
      companyId: ctx.destino,
      queueId,
      apiKey: "",
      voiceKey: null,
      voiceRegion: null,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    });
    sumar(ctx.resumen.copiados, "prompts");
  }

  if (ctx.resumen.copiados.prompts) {
    ctx.resumen.avisos.push(`${ctx.resumen.copiados.prompts} prompt(s) copiados SIN clave de IA: hay que poner la de la empresa destino.`);
  }
};

/**
 * CompaniesSettings y BirthdaySettings: una fila por empresa.
 *
 * La empresa destino ya tiene la suya —CreateCompanyService crea
 * CompaniesSettings al dar de alta la empresa, y BirthdaySettings tiene
 * companyId unico—, asi que se ACTUALIZA con los valores de origen en vez
 * de insertar otra. Si no la tuviera, se crea.
 */
const copiarFilaUnica = async (ctx: Contexto, tabla: string, clave: string) => {
  const [deOrigen] = await leer(
    ctx,
    `select id from "${tabla}" where "companyId" = :o order by id limit 1`,
    { o: ctx.origen }
  );
  if (!deOrigen) return;

  const [deDestino] = await leer(
    ctx,
    `select id from "${tabla}" where "companyId" = :d order by id limit 1`,
    { d: ctx.destino }
  );

  if (!deDestino) {
    await clonarFila(ctx, tabla, deOrigen.id, { companyId: ctx.destino });
    sumar(ctx.resumen.copiados, clave);
    return;
  }

  const cols = (await columnas(ctx, tabla)).filter(
    c => !["companyId", "createdAt", "updatedAt"].includes(c)
  );
  const sets = cols.map(c => `"${c}" = s."${c}"`).join(", ");

  await leer(
    ctx,
    `update "${tabla}" d set ${sets}, "updatedAt" = now()
       from "${tabla}" s
      where d.id = :destino and s.id = :origen
      returning d.id`,
    { destino: deDestino.id, origen: deOrigen.id }
  );
  sumar(ctx.resumen.copiados, clave);
};

/**
 * Filas de catalogo con un nombre o clave que las identifica. Si la
 * empresa destino ya tiene esa clave, se deja la suya: una clave de ajuste
 * de campana repetida haria ambiguas las lecturas, y un motivo de
 * finalizacion repetido saldria dos veces al cerrar un ticket.
 */
const clonarCatalogo = async (
  ctx: Contexto,
  tabla: string,
  columnaClave: string,
  etiqueta: string
) => {
  const filas = await leer(
    ctx,
    `select id, "${columnaClave}" as clave from "${tabla}"
      where "companyId" = :o order by id`,
    { o: ctx.origen }
  );

  for (const f of filas) {
    const yaEsta = await existe(
      ctx,
      `select 1 from "${tabla}" where "companyId" = :d and "${columnaClave}" = :k limit 1`,
      { d: ctx.destino, k: f.clave }
    );
    if (yaEsta) {
      sumar(ctx.resumen.yaExistian, etiqueta);
      continue;
    }
    await clonarFila(ctx, tabla, f.id, { companyId: ctx.destino });
    sumar(ctx.resumen.copiados, etiqueta);
  }
};

/** Solo los presets propios de la empresa; los de companyId null son del sistema. */
const clonarPresetWebhooks = async (ctx: Contexto) => {
  const filas = await leer(
    ctx,
    `select id from "PresetWebhooks" where "companyId" = :o order by id`,
    { o: ctx.origen }
  );
  for (const f of filas) {
    await clonarFila(ctx, "PresetWebhooks", f.id, { companyId: ctx.destino });
    sumar(ctx.resumen.copiados, "presetsDeWebhook");
  }
};

/**
 * Webhooks.
 *
 * - hash_id es el tramo de la URL publica: se genera uno nuevo con el
 *   mismo generador que usa CreateWebHookService. Copiarlo haria que dos
 *   empresas compartieran endpoint.
 * - config lleva details.idFlow, un flujo de FlowBuilder de la empresa
 *   origen. FlowBuilder no se copia en esta fase, y dejar la referencia
 *   haria que el webhook de la destino ejecutara un flujo de la origen:
 *   queda en null, que es como CreateWebHookService crea uno nuevo.
 * - user_id es NOT NULL en la tabla, asi que no puede quedar vacio: se
 *   asigna al administrador de la empresa destino. Sin ningun usuario en
 *   destino, los webhooks no se copian.
 * - Las columnas requestMonth, requestAll y active que declara el modelo
 *   no existen en la tabla: no hay contadores que reiniciar.
 */
const clonarWebhooks = async (ctx: Contexto) => {
  const webhooks = await leer(
    ctx,
    `select id from "Webhooks" where company_id = :o order by id`,
    { o: ctx.origen }
  );
  if (!webhooks.length) return;

  const [usuario] = await leer(
    ctx,
    `select id from "Users" where "companyId" = :d
      order by (profile = 'admin') desc, id asc limit 1`,
    { d: ctx.destino }
  );

  if (!usuario) {
    sumar(ctx.resumen.omitidos, "webhooksSinUsuarioEnDestino", webhooks.length);
    ctx.resumen.avisos.push("Los webhooks no se copiaron: la empresa destino no tiene ningun usuario al que asignarlos.");
    return;
  }

  for (const w of webhooks) {
    let hash = generateHashWebhookId();
    while (await existe(ctx, `select 1 from "Webhooks" where hash_id = :h limit 1`, { h: hash })) {
      hash = generateHashWebhookId();
    }
    await clonarFila(ctx, "Webhooks", w.id, {
      company_id: ctx.destino,
      user_id: usuario.id,
      hash_id: hash,
      config: null
    });
    sumar(ctx.resumen.copiados, "webhooks");
  }

  ctx.resumen.avisos.push(`${webhooks.length} webhook(s) copiados con URL nueva y sin flujo enlazado: el flujo se enlaza a mano en destino.`);
};

/**
 * Segunda pasada: autorreferencias. Cada fila nueva se copio con el id
 * viejo de su padre o de su siguiente columna; aqui se traduce con el
 * mapa. Sin equivalente, null.
 */
const remapear = async (
  ctx: Contexto,
  tabla: string,
  ids: number[],
  campos: Record<string, Mapa>
) => {
  const nombres = Object.keys(campos);
  for (const id of ids) {
    const [fila] = await leer(
      ctx,
      `select ${nombres.map(c => `"${c}"`).join(", ")} from "${tabla}" where id = :id`,
      { id }
    );
    const cambios: Fila = {};
    for (const campo of nombres) {
      const viejo = fila[campo];
      if (viejo === null || viejo === undefined) continue;
      const nuevo = campos[campo].get(viejo) ?? null;
      if (nuevo !== viejo) cambios[campo] = nuevo;
      if (nuevo === null) sumar(ctx.resumen.omitidos, "referenciasSinEquivalente");
    }
    await actualizar(ctx, tabla, id, cambios);
  }
};

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------

const CloneCompanyConfigService = async ({
  sourceCompanyId,
  targetCompanyId,
  userId
}: Peticion): Promise<ResumenClon> => {
  const origen = Number(sourceCompanyId);
  const destino = Number(targetCompanyId);

  if (!Number.isInteger(origen) || !Number.isInteger(destino) || origen <= 0 || destino <= 0) {
    throw new AppError("ERR_CLONE_INVALID_COMPANIES", 400);
  }

  if (origen === destino) {
    throw new AppError("ERR_CLONE_SAME_COMPANY", 400);
  }

  const [empresaOrigen, empresaDestino] = await Promise.all([
    Company.findByPk(origen),
    Company.findByPk(destino)
  ]);

  if (!empresaOrigen || !empresaDestino) {
    throw new AppError("ERR_CLONE_COMPANY_NOT_FOUND", 404);
  }

  const archivosCreados: string[] = [];

  try {
    const resumen = await sequelize.transaction(t =>
      clonarConfiguracion(t, origen, destino, archivosCreados, userId)
    );

    logger.info(
      `[Clon] configuracion de la empresa ${origen} copiada a ${destino}: ${JSON.stringify(resumen.copiados)}`
    );

    return resumen;
  } catch (err) {
    // La transaccion ya se deshizo; los archivos, no.
    borrarArchivosCopiados(archivosCreados);
    throw err;
  }
};

/**
 * Nucleo del clonado, dentro de una transaccion que abre quien llama.
 *
 * Lo usan este servicio y DuplicateCompanyService, que crea la empresa
 * destino y la clona en la MISMA transaccion para que un fallo no deje una
 * empresa a medias. No valida las empresas: eso es cosa de quien llama.
 *
 * Cada archivo copiado se anota en `archivosCreados`. Si la transaccion
 * falla, quien llama tiene que borrarlos con borrarArchivosCopiados: la base
 * no puede deshacerlos.
 */
export const clonarConfiguracion = async (
  t: Transaction,
  origen: number,
  destino: number,
  archivosCreados: string[],
  userId?: number
): Promise<ResumenClon> => {
  const resumen: ResumenClon = {
    origen,
    destino,
    copiados: {},
    yaExistian: {},
    omitidos: {},
    archivos: { copiados: 0, ausentes: [] },
    avisos: []
  };
  const ctx: Contexto = {
    t,
    origen,
    destino,
    columnasPorTabla: new Map(),
    archivosCreados,
    resumen
  };

  // Un segundo clonado del mismo par se BLOQUEA: al ser aditivo, duplicaria
  // todo. Se comprueba dentro de la transaccion, y el indice unico de la
  // tabla cubre la carrera entre dos peticiones a la vez.
  const previo = await CompanyConfigClone.findOne({
    where: { sourceCompanyId: origen, targetCompanyId: destino },
    transaction: t
  });
  if (previo) {
    throw new AppError("ERR_CLONE_ALREADY_DONE", 409);
  }

  const mapas: Mapas = {
    integraciones: new Map(),
    ficheros: new Map(),
    etiquetas: new Map(),
    colas: new Map(),
    opciones: new Map(),
    chatbots: new Map(),
    rapidos: new Map()
  };
  const creadas: Creadas = { etiquetas: [], opciones: [], chatbots: [] };

  // El orden importa: cada paso usa los mapas de los anteriores.
  await clonarIntegraciones(ctx, mapas);
  await clonarFicheros(ctx, mapas);
  await clonarEtiquetas(ctx, mapas, creadas);
  await clonarColas(ctx, mapas);
  await clonarOpcionesDeCola(ctx, mapas, creadas);
  await clonarProductos(ctx, mapas);
  await clonarChatbots(ctx, mapas, creadas);
  await clonarMensajesRapidos(ctx, mapas);
  await clonarPrompts(ctx, mapas);
  await copiarFilaUnica(ctx, "CompaniesSettings", "ajustesDeEmpresa");
  await copiarFilaUnica(ctx, "BirthdaySettings", "ajustesDeCumpleanos");
  await clonarCatalogo(ctx, "CampaignSettings", "key", "ajustesDeCampana");
  await clonarCatalogo(ctx, "TicketFinalizationReasons", "name", "motivosDeFinalizacion");
  await clonarPresetWebhooks(ctx);
  await clonarWebhooks(ctx);

  // Segunda pasada.
  await remapear(ctx, "Tags", creadas.etiquetas, {
    nextLaneId: mapas.etiquetas,
    rollbackLaneId: mapas.etiquetas
  });
  await remapear(ctx, "QueueOptions", creadas.opciones, { parentId: mapas.opciones });
  await remapear(ctx, "Chatbots", creadas.chatbots, { chatbotId: mapas.chatbots });

  await CompanyConfigClone.create(
    {
      sourceCompanyId: origen,
      targetCompanyId: destino,
      userId: userId || null,
      summary: JSON.stringify(resumen)
    } as any,
    { transaction: t }
  );

  return resumen;
};

/**
 * Borra los archivos que copio un clonado cuya transaccion fallo, para que
 * no queden adjuntos huerfanos en la carpeta de destino.
 */
export const borrarArchivosCopiados = (archivos: string[]): void => {
  for (const archivo of archivos) {
    try {
      fs.unlinkSync(archivo);
    } catch (e) {
      logger.warn(`[Clon] no se pudo borrar ${archivo} tras el fallo: ${e.message}`);
    }
  }
};

export default CloneCompanyConfigService;
