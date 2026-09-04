import AppError from "../../errors/AppError";
import Appointment from "../../models/Appointment";
import AppointmentReminder from "../../models/AppointmentReminder";
import Schedule from "../../models/Schedule";

const ESTADOS = ["pending", "done", "cancelled"];

/**
 * Cambia el estado de una cita.
 *
 * Al cancelarla se borran TODOS sus recordatorios pendientes: dejar uno
 * vivo enviaria al contacto el aviso de una cita que ya no existe, que es
 * peor que no avisar. Los que ya se enviaron no se tocan, porque borrarlos
 * no desharia nada y solo perderia el rastro.
 */
const UpdateStatusService = async (
  appointmentId: number | string,
  companyId: number,
  status: string
): Promise<Appointment> => {
  if (!ESTADOS.includes(status)) {
    throw new AppError("ERR_INVALID_APPOINTMENT_STATUS");
  }

  const appointment = await Appointment.findOne({
    where: { id: appointmentId, companyId },
    include: [{ model: AppointmentReminder }]
  });

  if (!appointment) {
    throw new AppError("ERR_NO_APPOINTMENT_FOUND", 404);
  }

  if (status === "cancelled") {
    const avisos = appointment.reminders || [];

    for (const aviso of avisos) {
      if (!aviso.scheduleId) continue;
      try {
        const schedule = await Schedule.findOne({
          where: { id: aviso.scheduleId, companyId }
        });
        // Un aviso ya enviado se deja: borrarlo no lo devuelve.
        if (schedule && !schedule.sentAt) {
          await schedule.destroy();
          await aviso.update({ scheduleId: null });
        }
      } catch (err) {
        // Si el mensaje ya no existiera, cancelar la cita sigue siendo lo
        // correcto.
      }
    }
  }

  await appointment.update({ status });

  return appointment;
};

export default UpdateStatusService;
