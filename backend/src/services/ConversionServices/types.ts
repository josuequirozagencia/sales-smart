/**
 * Contratos del motor de conversiones.
 *
 * Nada de aqui sabe de Meta. Un evento describe un hecho del CRM (un lead,
 * una cita, una venta) con lo necesario para que CUALQUIER proveedor lo
 * mande; MetaConversionsProvider es hoy el unico que lo implementa. Ver
 * docs/META_CONVERSIONS_API.md.
 */

export type ConversionEventType = "Lead" | "Schedule" | "Purchase";

export type ConversionSourceType = "contact" | "appointment" | "sale";

/** Meta no admite eventos de mas de 7 dias, ni atribuye un clic mas viejo. */
export const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Identificador de deduplicacion: deterministico por hecho real, nunca
 * aleatorio, para que un reintento o un disparo repetido lleven el mismo.
 */
export const eventIdDe = (tipo: ConversionEventType, sourceId: number): string => {
  const prefijo = { Lead: "lead", Schedule: "schedule", Purchase: "purchase" }[tipo];
  return `${prefijo}_${sourceId}`;
};

/** Anuncio por el que llego el contacto, si llego por uno. */
export interface ConversionAttribution {
  ctwaClid: string;
  /** Cuenta de WhatsApp Business por la que entro el mensaje. */
  wabaId?: string | null;
  sourceId?: string | null;
  sourceType?: string | null;
  headline?: string | null;
  mediaType?: string | null;
  /** Momento del clic: de el cuentan los 7 dias. */
  capturedAt: Date;
}

/**
 * Datos del contacto EN CLARO. Solo existen en memoria mientras se envia:
 * el proveedor los normaliza y los cifra, y no se guardan en ningun sitio.
 */
export interface ConversionUserData {
  phone?: string | null;
  email?: string | null;
  /** Identificador estable del contacto dentro del CRM. */
  externalId: string;
}

export interface ConversionEventData {
  value?: number;
  currency?: string;
  contentName?: string | null;
  channel?: string | null;
}

export interface ConversionEvent {
  type: ConversionEventType;
  companyId: number;
  contactId: number;
  eventId: string;
  timestamp: Date;
  attribution?: ConversionAttribution | null;
  user: ConversionUserData;
  data: ConversionEventData;
}

export type ConversionOutcome =
  | { status: "sent"; route: string; sentEventName: string; fbtraceId?: string | null }
  /** No se envia por regla: no es un error. */
  | { status: "skipped"; reason: string }
  /** La empresa tiene las credenciales con error: no se intenta. */
  | { status: "blocked"; reason: string }
  /** Red, 5xx, limites de uso: se reintenta. */
  | { status: "transient_error"; error: string }
  /** Token o dataset rechazados: se marca la configuracion, sin reintentos. */
  | { status: "auth_error"; error: string }
  /** El proveedor rechazo el contenido: se descarta. */
  | { status: "payload_error"; error: string };

export interface ConversionProvider {
  readonly name: string;
  send(event: ConversionEvent): Promise<ConversionOutcome>;
}
