import { Op } from "sequelize";

import Appointment from "../../models/Appointment";
import AppointmentReminder from "../../models/AppointmentReminder";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import User from "../../models/User";

interface Request {
  companyId: number;
  /** Quien pregunta. Un asesor solo ve sus citas. */
  userId?: number;
  /** Perfil de quien pregunta: "admin" ve las de todos. */
  profile?: string;
  contactId?: number;
  status?: string;
  initialDate?: string;
  finalDate?: string;
}

const ListService = async ({
  companyId,
  userId,
  profile,
  contactId,
  status,
  initialDate,
  finalDate
}: Request): Promise<Appointment[]> => {
  const where: any = { companyId };

  // Cada asesor ve solo lo que agendo el; el administrador, todo.
  //
  // El filtro se aplica AQUI y no en el frontend a proposito: ocultar en
  // pantalla lo que la API sigue devolviendo no es separar nada, basta con
  // mirar la respuesta. La comprobacion tiene que estar del lado del
  // servidor para que signifique algo.
  //
  // Las citas sin duenio —creadas antes de que existiera este filtro, o si
  // el usuario se borro— quedan visibles para todos: esconderlas seria
  // perderlas, y nadie podria reclamarlas.
  if (profile !== "admin" && userId) {
    where[Op.or] = [{ userId }, { userId: null }];
  }

  if (contactId) where.contactId = contactId;
  if (status) where.status = status;

  if (initialDate && finalDate) {
    where.scheduledAt = {
      [Op.gte]: `${initialDate} 00:00:00`,
      [Op.lte]: `${finalDate} 23:59:59`
    };
  }

  return Appointment.findAll({
    where,
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "urlPicture"]
      },
      { model: Ticket, as: "ticket", attributes: ["id", "uuid", "status"] },
      { model: User, as: "user", attributes: ["id", "name"] },
      { model: AppointmentReminder }
    ],
    // Ascendente: una agenda se lee hacia adelante, lo mas proximo primero.
    order: [["scheduledAt", "ASC"]]
  });
};

export default ListService;
