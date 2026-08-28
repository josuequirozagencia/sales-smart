// import AppError from "../../errors/AppError";
// import socketEmit from "../../helpers/socketEmit";
import LogTicket from "../../models/LogTicket";

type logType =
  | "access"
  | "create"
  | "closed"
  | "clientClosed"
  | "transfered"
  | "receivedTransfer"
  | "open"
  | "reopen"
  | "pending"
  | "nps"
  | "lgpd"
  | "queue"
  | "userDefine"
  | "delete"
  | "chatBot"
  | "autoClose"
  | "retriesLimitQueue"
  | "retriesLimitUserDefine"
  | "redirect"
  | "autoReturnQueue"
  // Escrito por el enrutador automatico cada vez que asigna un ticket,
  // incluida la primera vez. Es la unica fuente del momento de asignacion y,
  // contando registros, del numero de rotaciones. No vale reutilizar
  // "transfered": ese lo escribe tambien un traslado manual, y esos no deben
  // gastar el limite de rotaciones automaticas.
  | "routerAssign";

interface Request {
  type: logType;
  ticketId: number | string;
  userId?: number | string;
  queueId?: number | string;
}

const CreateLogTicketService = async ({
  type,
  userId,
  ticketId,
  queueId
}: Request): Promise<void> => {
  await LogTicket.create({
    userId,
    ticketId,
    type,
    queueId
  });
};

export default CreateLogTicketService;
