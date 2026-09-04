import { google } from "googleapis";

import Appointment from "../../models/Appointment";
import Contact from "../../models/Contact";
import { getAuthorizedClient } from "./OAuthService";

/**
 * Vuelca al Google Calendar de la empresa las citas creadas en el CRM.
 *
 * Regla de oro de este archivo: Google NUNCA puede tumbar una operacion
 * del CRM. Si el calendario esta caido, sin conectar o rechaza la
 * llamada, la cita se guarda igual y simplemente no se refleja fuera.
 * Perder la cita por no poder copiarla seria mucho peor que quedarse sin
 * copia, asi que todas las funciones devuelven en silencio en vez de
 * lanzar.
 */

/**
 * Duracion por defecto de una cita en el calendario.
 *
 * El CRM guarda cuando empieza pero no cuando acaba: una cita es un
 * compromiso puntual, no un bloque de agenda. Google exige un fin, asi que
 * se asume media hora. Es una convencion de presentacion, no un dato del
 * CRM, y por eso vive aqui y no en el modelo.
 */
const DURACION_MINUTOS = 30;

const construirEvento = (
  appointment: Appointment,
  contacto: Contact | null
) => {
  const inicio = new Date(appointment.scheduledAt);
  const fin = new Date(inicio.getTime() + DURACION_MINUTOS * 60000);

  // El nombre del contacto va en el titulo porque en el calendario, fuera
  // del CRM, "Seguimiento" a secas no dice con quien.
  const quien = contacto ? contacto.name : null;
  const asunto = appointment.title || "Cita";
  const resumen = quien ? `${asunto} — ${quien}` : asunto;

  const descripcion = [
    appointment.notes || null,
    quien && contacto.number ? `Contacto: ${quien} (${contacto.number})` : null,
    "Creado desde ChatIA"
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    summary: resumen,
    description: descripcion,
    start: { dateTime: inicio.toISOString() },
    end: { dateTime: fin.toISOString() },
    // Los avisos del CRM se envian por WhatsApp al contacto. Dejar ademas
    // los de Google avisaria al asesor por duplicado y por otro canal.
    reminders: { useDefault: false, overrides: [] }
  };
};

/**
 * Crea o actualiza el evento en Google.
 *
 * Si la cita ya tiene googleEventId se actualiza; si no, se crea y se
 * guarda el identificador para poder tocarlo despues.
 *
 * @returns true si quedo reflejado en Google
 */
export const pushAppointment = async (
  appointment: Appointment
): Promise<boolean> => {
  try {
    // Una cita nacida en Google no se devuelve a Google: es su dueño y
    // reescribirla desde aqui pisaria los cambios hechos alli.
    if (appointment.origin === "google") return false;

    const auth = await getAuthorizedClient(appointment.companyId);
    if (!auth) return false;

    const cal = google.calendar({ version: "v3", auth });

    const contacto = appointment.contactId
      ? await Contact.findByPk(appointment.contactId)
      : null;

    const cuerpo = construirEvento(appointment, contacto);

    if (appointment.googleEventId) {
      await cal.events.patch({
        calendarId: "primary",
        eventId: appointment.googleEventId,
        requestBody: cuerpo
      });
      return true;
    }

    const creado = await cal.events.insert({
      calendarId: "primary",
      requestBody: cuerpo
    });

    if (creado.data.id) {
      // silent: no hace falta mover updatedAt por guardar una referencia
      // externa; el contenido de la cita no ha cambiado.
      await appointment.update(
        { googleEventId: creado.data.id },
        { silent: true }
      );
      return true;
    }

    return false;
  } catch (err) {
    // A proposito sin relanzar: ver la nota de cabecera.
    return false;
  }
};

/**
 * Retira el evento de Google.
 *
 * Se usa al cancelar una cita: dejar el evento puesto haria que el asesor
 * viera en su calendario un compromiso que ya no existe.
 */
export const removeFromGoogle = async (
  appointment: Appointment
): Promise<boolean> => {
  try {
    if (!appointment.googleEventId) return false;

    const auth = await getAuthorizedClient(appointment.companyId);
    if (!auth) return false;

    const cal = google.calendar({ version: "v3", auth });

    await cal.events.delete({
      calendarId: "primary",
      eventId: appointment.googleEventId
    });

    await appointment.update({ googleEventId: null }, { silent: true });
    return true;
  } catch (err) {
    // Si Google responde 404 o 410, el evento ya no estaba: el resultado
    // buscado se cumple igual, asi que tampoco hay nada que relanzar.
    return false;
  }
};

export default { pushAppointment, removeFromGoogle };
