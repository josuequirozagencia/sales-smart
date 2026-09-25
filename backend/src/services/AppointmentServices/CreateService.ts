import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Appointment from "../../models/Appointment";
import AppointmentReminder from "../../models/AppointmentReminder";
import Contact from "../../models/Contact";
import CreateScheduleService from "../ScheduleServices/CreateService";
import { pushAppointment } from "../GoogleCalendarServices/PushService";
import EnsureContactTagService, {
  APPOINTMENT_TAG_NAME,
  APPOINTMENT_TAG_COLOR
} from "../SaleServices/EnsureContactTagService";

/**
 * Tope de avisos por cita.
 *
 * Esta aqui y en un solo sitio para poder subirlo sin buscarlo por el
 * codigo. Tres cubre el caso habitual —el dia antes, unas horas antes y
 * un ultimo aviso— sin convertir un recordatorio en acoso.
 */
export const MAX_REMINDERS = 3;

interface ReminderInput {
  body: string;
  minutesBefore: number;
}

interface Request {
  companyId: number;
  contactId: number;
  userId?: number;
  ticketId?: number;
  scheduledAt: string;
  title?: string;
  notes?: string;
  reminders?: ReminderInput[];
  whatsappId?: number;
}

const CreateService = async ({
  companyId,
  contactId,
  userId = null,
  ticketId = null,
  scheduledAt,
  title = null,
  notes = null,
  reminders = [],
  whatsappId = null
}: Request): Promise<Appointment> => {
  const schema = Yup.object().shape({
    scheduledAt: Yup.string().required()
  });

  try {
    await schema.validate({ scheduledAt });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const cuando = new Date(scheduledAt);
  if (Number.isNaN(cuando.getTime())) {
    throw new AppError("ERR_INVALID_APPOINTMENT_DATE");
  }

  if (reminders.length > MAX_REMINDERS) {
    throw new AppError("ERR_TOO_MANY_REMINDERS");
  }

  // Contacto OBLIGATORIO por este camino.
  //
  // La columna admite nulo desde que se trae la agenda de Google, donde un
  // evento puede no tener contacto detras. Pero una cita creada DESDE
  // ChatIA nace de una conversacion y siempre lo tiene: sin el no se
  // podria enviar el recordatorio ni saber a quien se atiende.
  //
  // La comprobacion vive aqui, en el camino de la aplicacion, y no en la
  // base: es la base la que tiene que ser permisiva para lo que entra de
  // fuera, no la aplicacion para lo que crea dentro.
  if (!contactId) {
    throw new AppError("ERR_APPOINTMENT_NEEDS_CONTACT");
  }

  const contact = await Contact.findOne({
    where: { id: contactId, companyId }
  });
  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  const appointment = await Appointment.create({
    companyId,
    contactId,
    userId,
    ticketId,
    scheduledAt: cuando,
    title,
    notes,
    status: "pending"
  } as any);

  // Los avisos se crean DESPUES de la cita: cada uno necesita su id, y si
  // alguno fallara la cita ya esta guardada y no se pierde.
  for (const r of reminders) {
    if (!r || !r.body || !r.body.trim()) continue;

    const antelacion = Number(r.minutesBefore) || 0;
    const envio = new Date(cuando.getTime() - antelacion * 60000);

    let scheduleId: number = null;

    // Un aviso para un momento que ya paso no se programa: saldria de
    // inmediato, anunciando algo inminente o ya ocurrido. Se deja
    // registrado igual, sin mensaje, para que se vea que se pidio.
    if (envio.getTime() > Date.now()) {
      try {
        const schedule = await CreateScheduleService({
          body: r.body.trim(),
          sendAt: envio.toISOString(),
          contactId,
          companyId,
          userId,
          whatsappId
        });
        scheduleId = schedule.id;
      } catch (err) {
        // Un aviso que no se pudo programar no invalida los demas ni la
        // cita.
      }
    }

    await AppointmentReminder.create({
      appointmentId: appointment.id,
      scheduleId,
      minutesBefore: antelacion
    } as any);
  }

  try {
    await EnsureContactTagService(
      contactId,
      companyId,
      APPOINTMENT_TAG_NAME,
      APPOINTMENT_TAG_COLOR
    );
  } catch (err) {
    // La etiqueta es comodidad visual, no el registro.
  }

  // Reflejo en Google Calendar, si la empresa lo tiene conectado.
  //
  // Va DESPUES de guardar y no lanza nunca: si el calendario esta caido o
  // sin conectar, la cita existe igual. Perderla por no poder copiarla
  // seria peor que quedarse sin copia.
  await pushAppointment(appointment);

  await appointment.reload({ include: [{ model: AppointmentReminder }] });

  return appointment;
};

export default CreateService;
