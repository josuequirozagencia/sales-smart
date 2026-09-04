import { Request, Response } from "express";

import CreateService from "../services/AppointmentServices/CreateService";
import ListService from "../services/AppointmentServices/ListService";
import UpdateStatusService from "../services/AppointmentServices/UpdateStatusService";

type IndexQuery = {
  contactId?: string;
  status?: string;
  initialDate?: string;
  finalDate?: string;
};

const aNumero = (v: any): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { contactId, status, initialDate, finalDate } =
    req.query as IndexQuery;

  const appointments = await ListService({
    companyId,
    contactId: contactId ? Number(contactId) : undefined,
    status,
    initialDate,
    finalDate
  });

  return res.json(appointments);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const {
    contactId,
    ticketId,
    scheduledAt,
    title,
    notes,
    reminders,
    whatsappId
  } = req.body;

  const appointment = await CreateService({
    companyId,
    userId: Number(userId),
    contactId: Number(contactId),
    ticketId: aNumero(ticketId),
    scheduledAt,
    title,
    notes,
    // Se normaliza aqui y no en el servicio: el formulario puede mandar
    // filas a medio rellenar, y las que no tienen texto no son un aviso.
    reminders: Array.isArray(reminders)
      ? reminders
          .filter((r: any) => r && typeof r.body === "string" && r.body.trim())
          .map((r: any) => ({
            body: r.body,
            minutesBefore: aNumero(r.minutesBefore) ?? 60
          }))
      : [],
    whatsappId: aNumero(whatsappId)
  });

  return res.status(200).json(appointment);
};

export const updateStatus = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { appointmentId } = req.params;
  const { status } = req.body;
  const { companyId } = req.user;

  const appointment = await UpdateStatusService(
    appointmentId,
    companyId,
    status
  );

  return res.status(200).json(appointment);
};
