import { google } from "googleapis";

import Appointment from "../../models/Appointment";
import GoogleCalendarIntegration from "../../models/GoogleCalendarIntegration";
import { getAuthorizedClient } from "./OAuthService";

/**
 * Trae al CRM los eventos del Google Calendar de la empresa.
 *
 * Va por SONDEO y no por notificaciones push porque estas exigen una URL
 * publica con HTTPS a la que Google pueda llamar, y el backend corre en
 * local. El precio es que los cambios hechos en Google tardan lo que tarde
 * la siguiente pasada, no que se pierdan.
 *
 * Tres cosas que este archivo tiene que evitar:
 *
 *   El eco. Los eventos que el CRM empujo a Google vuelven en la lectura.
 *   Si se crearan otra vez como citas, cada cita se duplicaria en cada
 *   pasada. Se reconocen por googleEventId.
 *
 *   Pisar al dueño. Una cita nacida en el CRM manda sobre su copia; lo que
 *   venga de Google para ella se ignora. Al reves tambien: un evento
 *   nacido en Google manda sobre la cita que lo refleja aqui.
 *
 *   Perder el hilo. Google caduca el syncToken y responde 410; entonces
 *   hay que releer desde cero en vez de quedarse sin sincronizar.
 */

/** Cuanto pasado se lee en la primera sincronizacion. */
const DIAS_HACIA_ATRAS = 7;

interface Resultado {
  creadas: number;
  actualizadas: number;
  canceladas: number;
  ignoradas: number;
  /** true si hubo que releer todo por haber caducado el token. */
  releidoDesdeCero: boolean;
}

const vacio = (): Resultado => ({
  creadas: 0,
  actualizadas: 0,
  canceladas: 0,
  ignoradas: 0,
  releidoDesdeCero: false
});

/** Momento de inicio de un evento, sea con hora o de dia completo. */
const inicioDe = (evento: any): Date | null => {
  const valor = evento.start?.dateTime || evento.start?.date;
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};

const aplicarEvento = async (
  evento: any,
  companyId: number,
  res: Resultado
): Promise<void> => {
  const existente = await Appointment.findOne({
    where: { companyId, googleEventId: evento.id }
  });

  // --- borrado en Google ---
  if (evento.status === "cancelled") {
    if (!existente) {
      res.ignoradas += 1;
      return;
    }
    if (existente.origin === "crm") {
      // El dueño es el CRM. Que alguien borre la copia en Google no
      // cancela el compromiso; se deja la cita y se olvida la referencia,
      // de modo que un cambio posterior vuelva a crear el evento.
      await existente.update({ googleEventId: null }, { silent: true });
      res.ignoradas += 1;
      return;
    }
    await existente.update({ status: "cancelled" });
    res.canceladas += 1;
    return;
  }

  const cuando = inicioDe(evento);
  if (!cuando) {
    res.ignoradas += 1;
    return;
  }

  if (existente) {
    // Regla de propiedad: lo que nacio en el CRM no se sobrescribe con lo
    // que diga Google.
    if (existente.origin === "crm") {
      res.ignoradas += 1;
      return;
    }
    await existente.update({
      scheduledAt: cuando,
      title: evento.summary || existente.title,
      notes: evento.description || null
    });
    res.actualizadas += 1;
    return;
  }

  // Evento nuevo de Google. Entra sin contacto: puede ser una reunion o
  // una cita personal, sin nadie de WhatsApp detras. La base lo permite
  // desde la migracion; crear desde ChatIA sigue exigiendo contacto.
  await Appointment.create({
    companyId,
    contactId: null,
    scheduledAt: cuando,
    title: evento.summary || "Evento de Google",
    notes: evento.description || null,
    status: "pending",
    origin: "google",
    googleEventId: evento.id
  } as any);
  res.creadas += 1;
};

/**
 * Lee los cambios del calendario y los aplica al CRM.
 *
 * @returns null si la empresa no tiene el calendario conectado
 */
export const pullFromGoogle = async (
  companyId: number
): Promise<Resultado | null> => {
  const integracion = await GoogleCalendarIntegration.findOne({
    where: { companyId, active: true }
  });
  if (!integracion) return null;

  const auth = await getAuthorizedClient(companyId);
  if (!auth) return null;

  const cal = google.calendar({ version: "v3", auth });
  const res = vacio();

  // Se leen todas las paginas antes de guardar el token nuevo: Google solo
  // lo entrega en la ultima, y guardarlo a medias daria por vistos
  // cambios que no se aplicaron.
  const recorrer = async (usarToken: boolean): Promise<string | null> => {
    let pageToken: string = undefined;
    let syncToken: string = null;

    do {
      const params: any = {
        calendarId: integracion.calendarId || "primary",
        singleEvents: true,
        maxResults: 250,
        pageToken
      };

      if (usarToken && integracion.syncToken) {
        // Con syncToken NO se pueden mandar filtros como timeMin: Google
        // rechaza la peticion. El token ya lleva implicito el alcance de
        // la lectura anterior.
        params.syncToken = integracion.syncToken;
        params.showDeleted = true;
      } else {
        const desde = new Date();
        desde.setDate(desde.getDate() - DIAS_HACIA_ATRAS);
        params.timeMin = desde.toISOString();
      }

      const r = await cal.events.list(params);

      for (const evento of r.data.items || []) {
        await aplicarEvento(evento, companyId, res);
      }

      pageToken = r.data.nextPageToken || undefined;
      if (r.data.nextSyncToken) syncToken = r.data.nextSyncToken;
    } while (pageToken);

    return syncToken;
  };

  let nuevoToken: string = null;

  try {
    nuevoToken = await recorrer(true);
  } catch (err: any) {
    // 410 GONE: el token caduco. Es lo esperado si pasa mucho tiempo entre
    // pasadas, no un error que haya que propagar.
    const codigo = err?.code || err?.response?.status;
    if (codigo === 410) {
      await integracion.update({ syncToken: null });
      res.releidoDesdeCero = true;
      nuevoToken = await recorrer(false);
    } else {
      throw err;
    }
  }

  await integracion.update({
    syncToken: nuevoToken || integracion.syncToken,
    lastSyncAt: new Date()
  });

  return res;
};

export default { pullFromGoogle };
