import { Op } from "sequelize";

import Appointment from "../../models/Appointment";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import User from "../../models/User";

interface Request {
  companyId: number;
  contactId?: number;
  status?: string;
  initialDate?: string;
  finalDate?: string;
}

const ListService = async ({
  companyId,
  contactId,
  status,
  initialDate,
  finalDate
}: Request): Promise<Appointment[]> => {
  const where: any = { companyId };

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
      { model: User, as: "user", attributes: ["id", "name"] }
    ],
    // Ascendente: una agenda se lee hacia adelante, lo mas proximo primero.
    order: [["scheduledAt", "ASC"]]
  });
};

export default ListService;
