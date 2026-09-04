import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Appointment from "../../models/Appointment";
import Contact from "../../models/Contact";
import CreateScheduleService from "../ScheduleServices/CreateService";
import EnsureContactTagService, {
  APPOINTMENT_TAG_NAME,
  APPOINTMENT_TAG_COLOR
} from "../SaleServices/EnsureContactTagService";

interface Request {
  companyId: number;
  contactId: number;
  userId?: number;
  ticketId?: number;
  scheduledAt: string;
  title?: string;
  notes?: string;
  /** Texto del recordatorio a enviar. Sin el, no se programa ninguno. */
  reminderBody?: string;
  /** Minutos de antelacion del recordatorio. */
  reminderMinutesBefore?: number;
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
  reminderBody = null,
  reminderMinutesBefore = 60,
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

  const contact = await Contact.findOne({
    where: { id: contactId, companyId }
  });
  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  // El recordatorio se programa ANTES de crear la cita, para poder guardar
  // su identificador y despues poder anularlo si la cita se cancela.
  let scheduleId: number = null;

  if (reminderBody && reminderBody.trim()) {
    const aviso = new Date(
      cuando.getTime() - (Number(reminderMinutesBefore) || 0) * 60000
    );

    // Un recordatorio para un momento que ya paso no se programa: se
    // enviaria de inmediato y el contacto recibiria un aviso de algo que
    // esta a punto de ocurrir o ya ocurrio.
    if (aviso.getTime() > Date.now()) {
      try {
        const schedule = await CreateScheduleService({
          body: reminderBody.trim(),
          sendAt: aviso.toISOString(),
          contactId,
          companyId,
          userId,
          whatsappId
        });
        scheduleId = schedule.id;
      } catch (err) {
        // La cita vale por si misma. Si el recordatorio no se pudo
        // programar, se guarda igual sin el: perder la cita por eso seria
        // peor que quedarse sin aviso.
      }
    }
  }

  const appointment = await Appointment.create({
    companyId,
    contactId,
    userId,
    ticketId,
    scheduledAt: cuando,
    title,
    notes,
    status: "pending",
    scheduleId
  } as any);

  try {
    await EnsureContactTagService(
      contactId,
      companyId,
      APPOINTMENT_TAG_NAME,
      APPOINTMENT_TAG_COLOR
    );
  } catch (err) {
    // Igual que en las ventas: la etiqueta es comodidad visual, no el
    // registro, y no vale tumbar una cita valida por ella.
  }

  await appointment.reload();

  return appointment;
};

export default CreateService;
