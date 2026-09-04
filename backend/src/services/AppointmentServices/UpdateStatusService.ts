import AppError from "../../errors/AppError";
import Appointment from "../../models/Appointment";
import Schedule from "../../models/Schedule";

const ESTADOS = ["pending", "done", "cancelled"];

/**
 * Cambia el estado de una cita.
 *
 * Al cancelarla se borra tambien su recordatorio: dejarlo programado
 * enviaria al contacto un aviso de una cita que ya no existe, que es peor
 * que no avisar.
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
    where: { id: appointmentId, companyId }
  });

  if (!appointment) {
    throw new AppError("ERR_NO_APPOINTMENT_FOUND", 404);
  }

  if (status === "cancelled" && appointment.scheduleId) {
    try {
      await Schedule.destroy({
        where: { id: appointment.scheduleId, companyId }
      });
    } catch (err) {
      // Si el recordatorio ya no existiera, cancelar la cita sigue siendo
      // lo correcto.
    }
    await appointment.update({ scheduleId: null });
  }

  await appointment.update({ status });

  return appointment;
};

export default UpdateStatusService;
