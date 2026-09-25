import fs from "fs";
import path from "path";
import crypto from "crypto";
import { QueryTypes, Transaction } from "sequelize";
import sequelize from "../../database";
import uploadConfig from "../../config/upload";
import { generateHashWebhookId } from "../../utils/GenerateHashWebhookId";
import logger from "../../utils/logger";

/**
 * Motor de paquetes de configuracion.
 *
 * La configuracion de una empresa se mueve en dos pasos:
 *
 *   capturarPaquete  lee de una empresa las filas de los modulos pedidos y
 *                    las devuelve como datos, YA SANEADAS: sin credenciales
 *                    de integraciones, sin claves de IA, sin usuarios ni
 *                    canales de la empresa origen, sin flujos enlazados.
 *   aplicarPaquete   inserta esas filas en otra empresa con ids nuevos y
 *                    traduce las referencias entre ellas.
 *
 * Lo usan el clonado entre empresas y el duplicado (capturan y aplican en la
 * misma transaccion) y las instantaneas de configuracion (la captura se
 * guarda y se aplica mas tarde, quiza por partes). Que se copia, que no y
 * por que: docs/CLONAR_EMPRESA.md y docs/INSTANTANEAS.md.
 *
 * COMO SE INSERTA
 *   Cada fila capturada es el to_jsonb de la fila real, con todas sus
 *   columnas. Se inserta con jsonb_populate_record, que convierte cada valor
 *   al tipo de su columna (fechas, json, numericos). Solo se insertan las
 *   columnas que trae la fila: si la tabla gano columnas despues de una
 *   captura guardada, esas toman su valor por defecto.
 *
 * REFERENCIAS
 *   Las referencias a otras filas del paquete se traducen con mapas id viejo
 *   -> id nuevo. Las autorreferencias (arbol de opciones de cola, arbol del
 *   chatbot, encadenado del Kanban) se insertan vacias y se rellenan en una
 *   segunda pasada, cuando ya existen todas las filas: en una captura
 *   guardada el id viejo puede no existir ya en la base. Una referencia sin
 *   equivalente queda en null: nunca apunta a una fila de la empresa origen.
 *
 *   Los mapas se devuelven para que una carga posterior del mismo paquete en
 *   la misma empresa (otra parte de una instantanea) encuentre lo que cargo
 *   la anterior.
 *
 * ADITIVO
 *   Lo que la empresa destino ya tenia no se borra ni se sobrescribe, salvo
 *   CompaniesSettings y BirthdaySettings, que son una fila por empresa y se
 *   actualizan.
 */

export type Fila = Record<string, any>;
type Mapa = Map<number, number>;

// ---------------------------------------------------------------------------
// Modulos
// ---------------------------------------------------------------------------

/**
 * Modulos de configuracion, en el orden en que se aplican: cada uno puede
 * usar los mapas de los anteriores (las colas, la lista de ficheros; el
 * chatbot, las colas y los ficheros).
 */
export const MODULOS = [
  "integraciones",
  "archivos",
  "etiquetas",
  "colas",
  "chatbot",
  "mensajesRapidos",
  "prompts",
  "ajustesEmpresa",
  "cumpleanos",
  "campanas",
  "motivos",
  "webhooks"
] as const;

export type Modulo = typeof MODULOS[number];

/** Modulos que no funcionan sin otro: sus filas cuelgan de una cola. */
export const DEPENDENCIAS: Partial<Record<Modulo, Modulo[]>> = {
  chatbot: ["colas"],
  prompts: ["colas"]
};

export const esModulo = (valor: unknown): valor is Modulo =>
  (MODULOS as readonly string[]).includes(valor as string);

/** Los modulos pedidos mas sus dependencias, en el orden en que se aplican. */
export const conDependencias = (pedidos: Modulo[]): Modulo[] => {
  const todos = new Set<Modulo>(pedidos);
  pedidos.forEach(m => (DEPENDENCIAS[m] || []).forEach(d => todos.add(d)));
  return MODULOS.filter(m => todos.has(m));
};

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ArchivoPaquete {
  /** Subcarpeta de la empresa: public/company{N}/{carpeta}/. */
  carpeta: "fileList" | "quickMessage";
  /** Solo en fileList: id (viejo) de la lista, que da nombre a su carpeta. */
  lista?: number | null;
  nombre: string;
}

export interface UbicacionArchivo {
  ruta: string;
  /** Ruta relativa legible, para el resumen. */
  etiqueta: string;
}

export interface Paquete {
  version: 1;
  modulos: Modulo[];
  /** Filas capturadas por tabla, ya saneadas. */
  filas: Record<string, Fila[]>;
  /** Archivos a los que apuntan las filas. */
  archivos: ArchivoPaquete[];
  /** Lo que la captura dejo fuera por regla, por modulo. */
  omitidos: Partial<Record<Modulo, Record<string, number>>>;
  /** Avisos de la captura, por modulo. */
  avisos: Partial<Record<Modulo, string[]>>;
}

export interface ResumenClon {
  /** Empresa de la que salio la configuracion; null si ya no existe. */
  origen: number | null;
  destino: number;
  /** Filas nuevas creadas en destino, por tipo. */
  copiados: Record<string, number>;
  /** Ya existian en destino con el mismo nombre o clave: se dejan como estan. */
  yaExistian: Record<string, number>;
  /** Filas que por regla no se copian. */
  omitidos: Record<string, number>;
  archivos: { copiados: number; ausentes: string[] };
  avisos: string[];
}

const NOMBRES_MAPA = [
  "integraciones",
  "ficheros",
  "etiquetas",
  "colas",
  "opciones",
  "chatbots",
  "rapidos"
] as const;

type NombreMapa = typeof NOMBRES_MAPA[number];

/** Tabla de cada mapa, para comprobar que lo cargado antes sigue existiendo. */
const TABLA_DE_MAPA: Record<NombreMapa, string> = {
  integraciones: "QueueIntegrations",
  ficheros: "Files",
  etiquetas: "Tags",
  colas: "Queues",
  opciones: "QueueOptions",
  chatbots: "Chatbots",
  rapidos: "QuickMessages"
};

export type MapasGuardados = Partial<Record<NombreMapa, Record<string, number>>>;

interface Pendiente {
  tabla: string;
  id: number;
  refs: Record<string, { mapa: NombreMapa; viejo: number | null }>;
}

interface Contexto {
  t: Transaction;
  destino: number;
  columnasPorTabla: Map<string, string[]>;
  archivosCreados: string[];
  leerArchivo: (archivo: ArchivoPaquete) => UbicacionArchivo;
  resumen: ResumenClon;
  mapas: Record<NombreMapa, Mapa>;
  pendientes: Pendiente[];
}

const PUBLICO: string = (uploadConfig as any).directory;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const leer = async (
  t: Transaction,
  sql: string,
  reemplazos: Fila = {}
): Promise<Fila[]> =>
  (await sequelize.query(sql, {
    replacements: reemplazos,
    type: QueryTypes.SELECT,
    transaction: t
  })) as Fila[];

const existe = async (ctx: Contexto, sql: string, reemplazos: Fila) =>
  (await leer(ctx.t, sql, reemplazos)).length > 0;

const sumar = (bolsa: Record<string, number>, clave: string, cuanto = 1) => {
  bolsa[clave] = (bolsa[clave] || 0) + cuanto;
};

const traducir = (mapa: Mapa, viejo: number | null): number | null =>
  viejo === null || viejo === undefined ? null : mapa.get(Number(viejo)) ?? null;

/**
 * Columnas reales de una tabla, sin la clave primaria.
 *
 * Se leen de la base y no del modelo porque la tabla manda: hay modelos que
 * declaran columnas que su tabla no tiene (Webhook declara requestMonth,
 * requestAll y active, que no existen).
 */
const columnas = async (ctx: Contexto, tabla: string): Promise<string[]> => {
  const guardadas = ctx.columnasPorTabla.get(tabla);
  if (guardadas) return guardadas;

  const filas = await leer(
    ctx.t,
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
 * Inserta una fila capturada con los cambios dados y devuelve su id nuevo.
 *
 * Los valores van por parametro (bind) y los convierte jsonb_populate_record,
 * asi que ningun texto de la fila se interpreta como SQL. Los cambios con
 * valores unicos (nombre y color de una cola, nombre de una integracion) ya
 * vienen resueltos: van en el mismo insert, no en un update posterior.
 */
const insertarFila = async (
  ctx: Contexto,
  tabla: string,
  fila: Fila,
  cambios: Fila = {}
): Promise<number> => {
  const cols = await columnas(ctx, tabla);

  // Un cambio sobre una columna que no existe es un error de programacion,
  // no un dato raro: se para aqui en vez de insertar algo a medias.
  const desconocidas = Object.keys(cambios).filter(c => !cols.includes(c));
  if (desconocidas.length) {
    throw new Error(`${tabla} no tiene las columnas: ${desconocidas.join(", ")}`);
  }

  const ahora = new Date().toISOString();
  const valores: Fila = { ...fila, ...cambios };
  if (cols.includes("createdAt")) valores.createdAt = ahora;
  if (cols.includes("updatedAt")) valores.updatedAt = ahora;
  delete valores.id;

  const usadas = cols
    .filter(c => c in valores)
    .map(c => `"${c}"`)
    .join(", ");

  const [nueva] = (await sequelize.query(
    `insert into "${tabla}" (${usadas})
     select ${usadas} from jsonb_populate_record(null::"${tabla}", $1::jsonb)
     returning id`,
    { bind: [JSON.stringify(valores)], type: QueryTypes.SELECT, transaction: ctx.t }
  )) as Fila[];

  if (!nueva) throw new Error(`No se pudo insertar en ${tabla}`);
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
    ctx.t,
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

/** Donde vive un archivo del paquete en la carpeta publica de una empresa. */
export const archivoDeEmpresa = (
  empresa: number,
  archivo: ArchivoPaquete
): UbicacionArchivo => {
  const partes = [
    `company${empresa}`,
    archivo.carpeta,
    ...(archivo.lista !== undefined && archivo.lista !== null ? [String(archivo.lista)] : []),
    archivo.nombre
  ];
  return { ruta: path.join(PUBLICO, ...partes), etiqueta: path.join(...partes) };
};

/**
 * Copia un archivo del paquete a la carpeta de la empresa destino y devuelve
 * el nombre con el que quedo.
 *
 * Solo se aceptan nombres de archivo sueltos: si el valor guardado
 * contuviera una ruta, no se copia y se avisa, en vez de leer o escribir
 * fuera de la carpeta.
 *
 * Si el archivo de origen no esta, la fila se copia igual —con el mismo
 * nombre, rota igual que en origen— y se anota en el resumen.
 */
const copiarArchivo = (
  ctx: Contexto,
  archivo: ArchivoPaquete,
  carpetaDestino: string[]
): string => {
  const { nombre } = archivo;
  if (!nombre) return nombre;

  if (path.basename(nombre) !== nombre) {
    ctx.resumen.avisos.push(`Nombre de archivo con ruta, no se copia: ${nombre}`);
    return nombre;
  }

  const { ruta, etiqueta } = ctx.leerArchivo(archivo);
  if (!fs.existsSync(ruta)) {
    ctx.resumen.archivos.ausentes.push(etiqueta);
    return nombre;
  }

  const dirDestino = path.join(PUBLICO, ...carpetaDestino);
  fs.mkdirSync(dirDestino, { recursive: true });

  let final = nombre;
  if (fs.existsSync(path.join(dirDestino, final))) {
    final = `${Date.now()}-${nombre}`;
  }

  const destino = path.join(dirDestino, final);
  fs.copyFileSync(ruta, destino, fs.constants.COPYFILE_EXCL);
  ctx.archivosCreados.push(destino);
  ctx.resumen.archivos.copiados++;
  return final;
};

/**
 * Borra los archivos que copio una aplicacion cuya transaccion fallo: la
 * base se deshace sola, los archivos no.
 */
export const borrarArchivosCopiados = (archivos: string[]): void => {
  for (const archivo of archivos) {
    try {
      fs.unlinkSync(archivo);
    } catch (e) {
      logger.warn(`[Configuracion] no se pudo borrar ${archivo} tras el fallo: ${e.message}`);
    }
  }
};

// ---------------------------------------------------------------------------
// Captura
// ---------------------------------------------------------------------------

/** Filas completas de una consulta, como objetos JSON de sus columnas. */
const capturar = async (
  t: Transaction,
  sql: string,
  reemplazos: Fila = {}
): Promise<Fila[]> =>
  (
    await leer(t, `select to_jsonb(x) as fila from (${sql}) x order by x.id`, reemplazos)
  ).map(r => r.fila);

/**
 * Captura la configuracion de una empresa para los modulos pedidos (mas sus
 * dependencias).
 *
 * El saneado ocurre AQUI, no al aplicar, para que una captura guardada no
 * llegue a contener nunca un secreto:
 *
 * - Integraciones: sin jsonContent (cuenta de servicio de Dialogflow) ni
 *   urlN8N (URL del n8n o Typebot de la origen).
 * - Chatbot: sin optUserId (usuario de la origen) ni optIntegrationId.
 * - Mensajes rapidos: sin usuario ni canal; los personales pasan a
 *   generales, porque sin dueno no los veria nadie; las plantillas oficiales
 *   de Meta no se capturan, son espejo de la cuenta de WhatsApp de la origen.
 * - Prompts: sin apiKey, voiceKey ni voiceRegion, y con los contadores de
 *   tokens a cero.
 * - Webhooks: sin config (flujo de FlowBuilder de la origen), sin hash_id
 *   (se genera uno al aplicar) y sin usuario.
 */
export const capturarPaquete = async (
  t: Transaction,
  empresa: number,
  pedidos: Modulo[]
): Promise<Paquete> => {
  const modulos = conDependencias(pedidos);
  const paquete: Paquete = {
    version: 1,
    modulos,
    filas: {},
    archivos: [],
    omitidos: {},
    avisos: {}
  };
  const e = { e: empresa };
  const tiene = (m: Modulo) => modulos.includes(m);
  const omitir = (m: Modulo, clave: string) => {
    const bolsa = (paquete.omitidos[m] = paquete.omitidos[m] || {});
    sumar(bolsa, clave);
  };
  const avisar = (m: Modulo, texto: string) => {
    (paquete.avisos[m] = paquete.avisos[m] || []).push(texto);
  };
  const { filas } = paquete;

  if (tiene("integraciones")) {
    filas.QueueIntegrations = (
      await capturar(t, `select * from "QueueIntegrations" where "companyId" = :e`, e)
    ).map(f => ({ ...f, jsonContent: "", urlN8N: "" }));
  }

  if (tiene("archivos")) {
    filas.Files = await capturar(t, `select * from "Files" where "companyId" = :e`, e);
    const ids = filas.Files.map(f => f.id);
    filas.FilesOptions = ids.length
      ? await capturar(t, `select * from "FilesOptions" where "fileId" in (:ids)`, { ids })
      : [];
    for (const o of filas.FilesOptions) {
      if (o.path) paquete.archivos.push({ carpeta: "fileList", lista: o.fileId, nombre: o.path });
    }
  }

  if (tiene("etiquetas")) {
    filas.Tags = await capturar(t, `select * from "Tags" where "companyId" = :e`, e);
  }

  if (tiene("colas")) {
    filas.Queues = await capturar(t, `select * from "Queues" where "companyId" = :e`, e);
    const qs = filas.Queues.map(q => q.id);
    filas.QueueOptions = qs.length
      ? await capturar(
          t,
          `with recursive arbol(id) as (
             select id from "QueueOptions" where "queueId" in (:qs)
             union
             select o.id from "QueueOptions" o join arbol a on o."parentId" = a.id
           )
           select q.* from "QueueOptions" q where q.id in (select id from arbol)`,
          { qs }
        )
      : [];
    filas.QueueProducts = await capturar(
      t,
      `select * from "QueueProducts" where "companyId" = :e`,
      e
    );
  }

  if (tiene("chatbot")) {
    const qs = (filas.Queues || []).map(q => q.id);
    filas.Chatbots = qs.length
      ? (
          await capturar(
            t,
            `with recursive arbol(id) as (
               select id from "Chatbots" where "queueId" in (:qs)
               union
               select c.id from "Chatbots" c join arbol a on c."chatbotId" = a.id
             )
             select b.* from "Chatbots" b where b.id in (select id from arbol)`,
            { qs }
          )
        ).map(b => ({ ...b, optUserId: null, optIntegrationId: null }))
      : [];
  }

  if (tiene("mensajesRapidos")) {
    const todos = await capturar(
      t,
      `select * from "QuickMessages" where "companyId" = :e`,
      e
    );
    let personales = 0;
    filas.QuickMessages = [];

    for (const m of todos) {
      if (m.isOficial === true) {
        omitir("mensajesRapidos", "plantillasOficiales");
        continue;
      }
      if (m.geral === false) personales++;
      filas.QuickMessages.push({ ...m, userId: null, whatsappId: null, geral: true });
      if (m.mediaPath) paquete.archivos.push({ carpeta: "quickMessage", nombre: m.mediaPath });
    }

    if (personales) {
      avisar(
        "mensajesRapidos",
        `${personales} mensaje(s) rapido(s) personales pasaron a generales: su dueno no existe en destino.`
      );
    }

    const ids = filas.QuickMessages.map(m => m.id);
    filas.QuickMessageComponents = ids.length
      ? await capturar(
          t,
          `select * from "QuickMessageComponents" where "quickMessageId" in (:ids)`,
          { ids }
        )
      : [];
  }

  if (tiene("prompts")) {
    filas.Prompts = (
      await capturar(t, `select * from "Prompts" where "companyId" = :e`, e)
    ).map(p => ({
      ...p,
      apiKey: "",
      voiceKey: null,
      voiceRegion: null,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    }));
  }

  if (tiene("ajustesEmpresa")) {
    filas.CompaniesSettings = await capturar(
      t,
      `select * from "CompaniesSettings" where "companyId" = :e order by id limit 1`,
      e
    );
  }

  if (tiene("cumpleanos")) {
    filas.BirthdaySettings = await capturar(
      t,
      `select * from "BirthdaySettings" where "companyId" = :e order by id limit 1`,
      e
    );
  }

  if (tiene("campanas")) {
    filas.CampaignSettings = await capturar(
      t,
      `select * from "CampaignSettings" where "companyId" = :e`,
      e
    );
  }

  if (tiene("motivos")) {
    filas.TicketFinalizationReasons = await capturar(
      t,
      `select * from "TicketFinalizationReasons" where "companyId" = :e`,
      e
    );
  }

  if (tiene("webhooks")) {
    // Solo los presets propios; los de companyId null son del sistema.
    filas.PresetWebhooks = await capturar(
      t,
      `select * from "PresetWebhooks" where "companyId" = :e`,
      e
    );
    filas.Webhooks = (
      await capturar(t, `select * from "Webhooks" where company_id = :e`, e)
    ).map(w => ({ ...w, config: null, hash_id: null, user_id: null }));
  }

  return paquete;
};

const CLAVES_DE_CONTEO: Record<string, string> = {
  QueueIntegrations: "integraciones",
  Files: "listasDeFicheros",
  FilesOptions: "archivosDeListas",
  Tags: "etiquetas",
  Queues: "colas",
  QueueOptions: "opcionesDeCola",
  QueueProducts: "productos",
  Chatbots: "nodosDeChatbot",
  QuickMessages: "mensajesRapidos",
  QuickMessageComponents: "componentesDeRapidos",
  Prompts: "prompts",
  CompaniesSettings: "ajustesDeEmpresa",
  BirthdaySettings: "ajustesDeCumpleanos",
  CampaignSettings: "ajustesDeCampana",
  TicketFinalizationReasons: "motivosDeFinalizacion",
  PresetWebhooks: "presetsDeWebhook",
  Webhooks: "webhooks"
};

/** Cuantas filas lleva un paquete, con las mismas claves que el resumen. */
export const contarPaquete = (paquete: Paquete): Record<string, number> => {
  const cuenta: Record<string, number> = {};
  Object.keys(paquete.filas).forEach(tabla => {
    const n = paquete.filas[tabla].length;
    if (n) cuenta[CLAVES_DE_CONTEO[tabla] || tabla] = n;
  });
  return cuenta;
};

// ---------------------------------------------------------------------------
// Aplicacion
// ---------------------------------------------------------------------------

/**
 * Integraciones SIN credenciales y desconectadas: las colas y el chatbot
 * copiados no se enlazan a ellas. Sin credenciales, un bot enlazado fallaria
 * con clientes reales; el admin las completa y las vuelve a enlazar.
 *
 * name y projectName son unicos en TODA la base, asi que la copia lleva un
 * sufijo con la empresa destino.
 */
const aplicarIntegraciones = async (ctx: Contexto, filas: Fila[]) => {
  const sufijo = (n: number) =>
    n === 1 ? ` (empresa ${ctx.destino})` : ` (empresa ${ctx.destino} ${n})`;

  for (const f of filas) {
    const name = await valorLibre(ctx, "QueueIntegrations", "name", f.name, sufijo);
    const projectName = await valorLibre(
      ctx, "QueueIntegrations", "projectName", f.projectName, sufijo
    );
    const nueva = await insertarFila(ctx, "QueueIntegrations", f, {
      companyId: ctx.destino,
      name,
      projectName,
      jsonContent: "",
      urlN8N: ""
    });
    ctx.mapas.integraciones.set(f.id, nueva);
    sumar(ctx.resumen.copiados, "integraciones");
  }

  if (filas.length) {
    ctx.resumen.avisos.push(
      `${filas.length} integracion(es) copiadas SIN credenciales ni URL y sin enlazar a colas ni al chatbot: hay que completarlas y enlazarlas en la empresa destino.`
    );
  }
};

/** Listas de ficheros y sus archivos: public/company{N}/fileList/{idLista}/. */
const aplicarArchivos = async (ctx: Contexto, listas: Fila[], opciones: Fila[]) => {
  for (const l of listas) {
    const nueva = await insertarFila(ctx, "Files", l, { companyId: ctx.destino });
    ctx.mapas.ficheros.set(l.id, nueva);
    sumar(ctx.resumen.copiados, "listasDeFicheros");
  }

  for (const o of opciones) {
    const listaNueva = ctx.mapas.ficheros.get(o.fileId);
    if (!listaNueva) continue;
    // La carpeta lleva el id de la lista, y ese id cambia en destino.
    const nombre = copiarArchivo(
      ctx,
      { carpeta: "fileList", lista: o.fileId, nombre: o.path },
      [`company${ctx.destino}`, "fileList", String(listaNueva)]
    );
    await insertarFila(ctx, "FilesOptions", o, { fileId: listaNueva, path: nombre });
    sumar(ctx.resumen.copiados, "archivosDeListas");
  }
};

/**
 * Etiquetas y columnas del Kanban.
 *
 * Si la empresa destino ya tiene una etiqueta con el mismo nombre y el mismo
 * tipo (Kanban o no), se reutiliza en vez de duplicarla: dos columnas con el
 * mismo nombre romperian el tablero. La existente no se toca; solo se usa
 * como destino del encadenado de las copiadas.
 */
const aplicarEtiquetas = async (ctx: Contexto, etiquetas: Fila[]) => {
  for (const e of etiquetas) {
    const [existente] = await leer(
      ctx.t,
      `select id from "Tags"
        where "companyId" = :d and name = :n and coalesce(kanban, 0) = :k
        order by id limit 1`,
      { d: ctx.destino, n: e.name, k: e.kanban ?? 0 }
    );

    if (existente) {
      ctx.mapas.etiquetas.set(e.id, existente.id);
      sumar(ctx.resumen.yaExistian, "etiquetas");
      continue;
    }

    const nueva = await insertarFila(ctx, "Tags", e, {
      companyId: ctx.destino,
      nextLaneId: null,
      rollbackLaneId: null
    });
    ctx.mapas.etiquetas.set(e.id, nueva);
    ctx.pendientes.push({
      tabla: "Tags",
      id: nueva,
      refs: {
        nextLaneId: { mapa: "etiquetas", viejo: e.nextLaneId },
        rollbackLaneId: { mapa: "etiquetas", viejo: e.rollbackLaneId }
      }
    });
    sumar(ctx.resumen.copiados, "etiquetas");
  }
};

/**
 * Colas, su arbol de opciones y sus productos.
 *
 * (name, companyId) y (color, companyId) son unicos: si la empresa destino
 * ya tiene una cola con ese nombre o ese color, la copia cambia de nombre o
 * de color en vez de fallar.
 */
const aplicarColas = async (
  ctx: Contexto,
  colas: Fila[],
  opciones: Fila[],
  productos: Fila[]
) => {
  const sufijo = (n: number) => (n === 1 ? " (copia)" : ` (copia ${n})`);

  for (const c of colas) {
    const name = await valorLibre(
      ctx, "Queues", "name", c.name, sufijo,
      `and "companyId" = :emp`, { emp: ctx.destino }
    );
    const color = await colorLibre(ctx, c.color);

    const nueva = await insertarFila(ctx, "Queues", c, {
      companyId: ctx.destino,
      name,
      color,
      // Integraciones desconectadas: ver aplicarIntegraciones.
      integrationId: null,
      fileListId: traducir(ctx.mapas.ficheros, c.fileListId)
    });

    if (name !== c.name) {
      ctx.resumen.avisos.push(`La cola «${c.name}» ya existia en destino: la copia se llama «${name}».`);
    }
    if (c.integrationId) sumar(ctx.resumen.omitidos, "enlacesColaIntegracion");

    ctx.mapas.colas.set(c.id, nueva);
    sumar(ctx.resumen.copiados, "colas");
  }

  // Raices por queueId, hijas por parentId (segunda pasada).
  for (const o of opciones) {
    const nueva = await insertarFila(ctx, "QueueOptions", o, {
      queueId: traducir(ctx.mapas.colas, o.queueId),
      parentId: null
    });
    ctx.mapas.opciones.set(o.id, nueva);
    ctx.pendientes.push({
      tabla: "QueueOptions",
      id: nueva,
      refs: { parentId: { mapa: "opciones", viejo: o.parentId } }
    });
    sumar(ctx.resumen.copiados, "opcionesDeCola");
  }

  for (const p of productos) {
    const queueId = traducir(ctx.mapas.colas, p.queueId);
    // queueId es NOT NULL: un producto cuya cola no se copio no tiene donde ir.
    if (!queueId) {
      sumar(ctx.resumen.omitidos, "productosSinCola");
      continue;
    }
    await insertarFila(ctx, "QueueProducts", p, { companyId: ctx.destino, queueId });
    sumar(ctx.resumen.copiados, "productos");
  }
};

/** Arbol del chatbot: raices por queueId, hijos por chatbotId (segunda pasada). */
const aplicarChatbot = async (ctx: Contexto, bots: Fila[]) => {
  for (const b of bots) {
    const nuevo = await insertarFila(ctx, "Chatbots", b, {
      queueId: traducir(ctx.mapas.colas, b.queueId),
      chatbotId: null,
      optQueueId: traducir(ctx.mapas.colas, b.optQueueId),
      optFileId: traducir(ctx.mapas.ficheros, b.optFileId),
      optIntegrationId: null,
      optUserId: null
    });
    ctx.mapas.chatbots.set(b.id, nuevo);
    ctx.pendientes.push({
      tabla: "Chatbots",
      id: nuevo,
      refs: { chatbotId: { mapa: "chatbots", viejo: b.chatbotId } }
    });
    sumar(ctx.resumen.copiados, "nodosDeChatbot");
  }
};

/** Mensajes rapidos y sus componentes. Adjuntos en public/company{N}/quickMessage/. */
const aplicarMensajesRapidos = async (
  ctx: Contexto,
  mensajes: Fila[],
  componentes: Fila[]
) => {
  for (const m of mensajes) {
    const cambios: Fila = { companyId: ctx.destino, userId: null, whatsappId: null };

    if (m.mediaPath) {
      cambios.mediaPath = copiarArchivo(
        ctx,
        { carpeta: "quickMessage", nombre: m.mediaPath },
        [`company${ctx.destino}`, "quickMessage"]
      );
    }

    const nuevo = await insertarFila(ctx, "QuickMessages", m, cambios);
    ctx.mapas.rapidos.set(m.id, nuevo);
    sumar(ctx.resumen.copiados, "mensajesRapidos");
  }

  for (const c of componentes) {
    const quickMessageId = ctx.mapas.rapidos.get(c.quickMessageId);
    if (!quickMessageId) continue;
    await insertarFila(ctx, "QuickMessageComponents", c, { quickMessageId });
    sumar(ctx.resumen.copiados, "componentesDeRapidos");
  }
};

/** Prompts, ya sin claves desde la captura. */
const aplicarPrompts = async (ctx: Contexto, prompts: Fila[]) => {
  let copiados = 0;

  for (const p of prompts) {
    const queueId = traducir(ctx.mapas.colas, p.queueId);
    // queueId es NOT NULL en esta tabla.
    if (!queueId) {
      sumar(ctx.resumen.omitidos, "promptsSinCola");
      ctx.resumen.avisos.push(`El prompt «${p.name}» no se copio: su cola no esta en destino.`);
      continue;
    }
    await insertarFila(ctx, "Prompts", p, {
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
    copiados++;
  }

  if (copiados) {
    ctx.resumen.avisos.push(`${copiados} prompt(s) copiados SIN clave de IA: hay que poner la de la empresa destino.`);
  }
};

/**
 * CompaniesSettings y BirthdaySettings: una fila por empresa.
 *
 * La empresa destino ya suele tener la suya —CreateCompanyService crea
 * CompaniesSettings al dar de alta la empresa—, asi que se ACTUALIZA con los
 * valores capturados en vez de insertar otra. Si no la tiene, se crea.
 */
const aplicarFilaUnica = async (
  ctx: Contexto,
  tabla: string,
  fila: Fila | undefined,
  clave: string
) => {
  if (!fila) return;

  const [deDestino] = await leer(
    ctx.t,
    `select id from "${tabla}" where "companyId" = :d order by id limit 1`,
    { d: ctx.destino }
  );

  if (!deDestino) {
    await insertarFila(ctx, tabla, fila, { companyId: ctx.destino });
    sumar(ctx.resumen.copiados, clave);
    return;
  }

  const todas = await columnas(ctx, tabla);
  const cols = todas
    .filter(c => !["companyId", "createdAt", "updatedAt"].includes(c) && c in fila)
    .map(c => `"${c}"`);

  if (cols.length) {
    const marca = todas.includes("updatedAt") ? `, "updatedAt" = now()` : "";
    await sequelize.query(
      `update "${tabla}"
          set (${cols.join(", ")}) =
              (select ${cols.join(", ")} from jsonb_populate_record(null::"${tabla}", $1::jsonb))
              ${marca}
        where id = $2`,
      { bind: [JSON.stringify(fila), deDestino.id], transaction: ctx.t }
    );
  }
  sumar(ctx.resumen.copiados, clave);
};

/**
 * Filas de catalogo con un nombre o clave que las identifica. Si la empresa
 * destino ya tiene esa clave, se deja la suya: una clave de ajuste de
 * campana repetida haria ambiguas las lecturas, y un motivo de finalizacion
 * repetido saldria dos veces al cerrar un ticket.
 */
const aplicarCatalogo = async (
  ctx: Contexto,
  tabla: string,
  filas: Fila[],
  columnaClave: string,
  etiqueta: string
) => {
  for (const f of filas) {
    const yaEsta = await existe(
      ctx,
      `select 1 from "${tabla}" where "companyId" = :d and "${columnaClave}" = :k limit 1`,
      { d: ctx.destino, k: f[columnaClave] }
    );
    if (yaEsta) {
      sumar(ctx.resumen.yaExistian, etiqueta);
      continue;
    }
    await insertarFila(ctx, tabla, f, { companyId: ctx.destino });
    sumar(ctx.resumen.copiados, etiqueta);
  }
};

const aplicarPresetWebhooks = async (ctx: Contexto, filas: Fila[]) => {
  for (const f of filas) {
    await insertarFila(ctx, "PresetWebhooks", f, { companyId: ctx.destino });
    sumar(ctx.resumen.copiados, "presetsDeWebhook");
  }
};

/**
 * Webhooks.
 *
 * - hash_id es el tramo de la URL publica: se genera uno nuevo con el mismo
 *   generador que usa CreateWebHookService. Copiarlo haria que dos empresas
 *   compartieran endpoint.
 * - config (flujo de FlowBuilder de la origen) ya viene vacio de la captura:
 *   es como CreateWebHookService crea uno nuevo.
 * - user_id es NOT NULL: se asigna al administrador de la empresa destino.
 *   Sin ningun usuario en destino, los webhooks no se copian.
 */
const aplicarWebhooks = async (ctx: Contexto, webhooks: Fila[]) => {
  if (!webhooks.length) return;

  const [usuario] = await leer(
    ctx.t,
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
    await insertarFila(ctx, "Webhooks", w, {
      company_id: ctx.destino,
      user_id: usuario.id,
      hash_id: hash,
      config: null
    });
    sumar(ctx.resumen.copiados, "webhooks");
  }

  ctx.resumen.avisos.push(`${webhooks.length} webhook(s) copiados con URL nueva y sin flujo enlazado: el flujo se enlaza a mano en destino.`);
};

/** Segunda pasada: autorreferencias, con los mapas ya completos. Sin equivalente, null. */
const segundaPasada = async (ctx: Contexto) => {
  for (const p of ctx.pendientes) {
    const cambios: Fila = {};
    Object.keys(p.refs).forEach(campo => {
      const { mapa, viejo } = p.refs[campo];
      if (viejo === null || viejo === undefined) return;
      const nuevo = traducir(ctx.mapas[mapa], viejo);
      cambios[campo] = nuevo;
      if (nuevo === null) sumar(ctx.resumen.omitidos, "referenciasSinEquivalente");
    });
    await actualizar(ctx, p.tabla, p.id, cambios);
  }
};

const mapasVacios = (): Record<NombreMapa, Mapa> => {
  const mapas = {} as Record<NombreMapa, Mapa>;
  NOMBRES_MAPA.forEach(n => {
    mapas[n] = new Map();
  });
  return mapas;
};

/**
 * Mapas de cargas anteriores del mismo paquete en la misma empresa.
 *
 * Lo cargado antes puede haberse borrado despues en destino: se descarta lo
 * que ya no existe, o una referencia a ello fallaria al insertar.
 */
const restaurarMapas = async (
  t: Transaction,
  previos?: MapasGuardados | null
): Promise<Record<NombreMapa, Mapa>> => {
  const mapas = mapasVacios();
  if (!previos) return mapas;

  for (const nombre of NOMBRES_MAPA) {
    const guardado = previos[nombre] || {};
    const nuevos = Array.from(new Set(Object.keys(guardado).map(k => Number(guardado[k]))));
    if (!nuevos.length) continue;

    const vivos = new Set(
      (
        await leer(t, `select id from "${TABLA_DE_MAPA[nombre]}" where id in (:ids)`, {
          ids: nuevos
        })
      ).map(f => Number(f.id))
    );

    Object.keys(guardado).forEach(viejo => {
      const nuevo = Number(guardado[viejo]);
      if (vivos.has(nuevo)) mapas[nombre].set(Number(viejo), nuevo);
    });
  }

  return mapas;
};

const guardarMapas = (mapas: Record<NombreMapa, Mapa>): MapasGuardados => {
  const guardados: MapasGuardados = {};
  NOMBRES_MAPA.forEach(nombre => {
    const plano: Record<string, number> = {};
    mapas[nombre].forEach((nuevo, viejo) => {
      plano[String(viejo)] = nuevo;
    });
    guardados[nombre] = plano;
  });
  return guardados;
};

export interface OpcionesAplicar {
  /** Modulos a aplicar; los que el paquete no lleva se ignoran. */
  modulos: Modulo[];
  /** Empresa de la que salio el paquete, para el resumen. */
  origen: number | null;
  /** Donde leer cada archivo del paquete. */
  leerArchivo: (archivo: ArchivoPaquete) => UbicacionArchivo;
  /** Aqui se anotan los archivos copiados, por si la transaccion falla. */
  archivosCreados: string[];
  /** Mapas de cargas anteriores del mismo paquete en la misma empresa. */
  mapasPrevios?: MapasGuardados | null;
}

/**
 * Aplica un paquete a una empresa, dentro de la transaccion de quien llama.
 * Devuelve el resumen y los mapas de ids para cargas posteriores.
 */
export const aplicarPaquete = async (
  t: Transaction,
  destino: number,
  paquete: Paquete,
  opciones: OpcionesAplicar
): Promise<{ resumen: ResumenClon; mapas: MapasGuardados }> => {
  const resumen: ResumenClon = {
    origen: opciones.origen,
    destino,
    copiados: {},
    yaExistian: {},
    omitidos: {},
    archivos: { copiados: 0, ausentes: [] },
    avisos: []
  };

  const ctx: Contexto = {
    t,
    destino,
    columnasPorTabla: new Map(),
    archivosCreados: opciones.archivosCreados,
    leerArchivo: opciones.leerArchivo,
    resumen,
    mapas: await restaurarMapas(t, opciones.mapasPrevios),
    pendientes: []
  };

  const aplica = (m: Modulo) => opciones.modulos.includes(m) && paquete.modulos.includes(m);
  const filas = (tabla: string): Fila[] => paquete.filas[tabla] || [];

  // Lo que la captura ya dejo fuera, solo de los modulos que se aplican.
  MODULOS.filter(aplica).forEach(m => {
    const omitidos = paquete.omitidos[m] || {};
    Object.keys(omitidos).forEach(clave => sumar(resumen.omitidos, clave, omitidos[clave]));
    resumen.avisos.push(...(paquete.avisos[m] || []));
  });

  // El orden importa: cada paso usa los mapas de los anteriores.
  if (aplica("integraciones")) await aplicarIntegraciones(ctx, filas("QueueIntegrations"));
  if (aplica("archivos")) await aplicarArchivos(ctx, filas("Files"), filas("FilesOptions"));
  if (aplica("etiquetas")) await aplicarEtiquetas(ctx, filas("Tags"));
  if (aplica("colas")) {
    await aplicarColas(ctx, filas("Queues"), filas("QueueOptions"), filas("QueueProducts"));
  }
  if (aplica("chatbot")) await aplicarChatbot(ctx, filas("Chatbots"));
  if (aplica("mensajesRapidos")) {
    await aplicarMensajesRapidos(ctx, filas("QuickMessages"), filas("QuickMessageComponents"));
  }
  if (aplica("prompts")) await aplicarPrompts(ctx, filas("Prompts"));
  if (aplica("ajustesEmpresa")) {
    await aplicarFilaUnica(ctx, "CompaniesSettings", filas("CompaniesSettings")[0], "ajustesDeEmpresa");
  }
  if (aplica("cumpleanos")) {
    await aplicarFilaUnica(ctx, "BirthdaySettings", filas("BirthdaySettings")[0], "ajustesDeCumpleanos");
  }
  if (aplica("campanas")) {
    await aplicarCatalogo(ctx, "CampaignSettings", filas("CampaignSettings"), "key", "ajustesDeCampana");
  }
  if (aplica("motivos")) {
    await aplicarCatalogo(
      ctx, "TicketFinalizationReasons", filas("TicketFinalizationReasons"), "name", "motivosDeFinalizacion"
    );
  }
  if (aplica("webhooks")) {
    await aplicarPresetWebhooks(ctx, filas("PresetWebhooks"));
    await aplicarWebhooks(ctx, filas("Webhooks"));
  }

  await segundaPasada(ctx);

  return { resumen, mapas: guardarMapas(ctx.mapas) };
};
