import { useCallback, useEffect, useState } from "react";

import api from "../../services/api";

/**
 * Citas de la agenda, para pintarlas en el mismo calendario que los
 * mensajes programados.
 *
 * Vive aparte de la pantalla porque esta ya tenia cuatrocientas lineas y
 * mezclar aqui la carga, el filtrado y los cambios de estado la habria
 * hecho ilegible.
 *
 * El servidor decide QUE citas se devuelven: un asesor recibe las suyas y
 * el administrador todas. Aqui no se filtra por usuario, solo se presenta.
 */
const useAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get("/appointments");
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      // Un fallo al cargar las citas no debe impedir ver los mensajes
      // programados, que es lo que esta pantalla hacia antes.
      setAppointments([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarEstado = useCallback(
    async (appointmentId, status) => {
      await api.put(`/appointments/${appointmentId}/status`, { status });
      await cargar();
    },
    [cargar]
  );

  /**
   * Identificadores de los mensajes programados que son recordatorios de
   * una cita.
   *
   * Sin esto, el recordatorio saldria DOS VECES en el calendario: una como
   * cita y otra como mensaje, porque tecnicamente son dos registros. Se
   * ocultan los mensajes y se conserva la cita, que es la que tiene
   * sentido para quien mira la agenda.
   */
  const idsDeRecordatorios = appointments.reduce((acc, a) => {
    (a.reminders || []).forEach(r => {
      if (r.scheduleId) acc.add(r.scheduleId);
    });
    return acc;
  }, new Set());

  /** Asesores que aparecen en las citas, para el filtro del administrador. */
  const asesores = Object.values(
    appointments.reduce((acc, a) => {
      if (a.user && !acc[a.user.id]) acc[a.user.id] = a.user;
      return acc;
    }, {})
  );

  return {
    appointments,
    cargando,
    recargar: cargar,
    cambiarEstado,
    idsDeRecordatorios,
    asesores
  };
};

export default useAppointments;
