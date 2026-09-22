import { Op } from "sequelize";
import User from "../../models/User";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import UpdateDeletedUserOpenTicketsStatus from "../../helpers/UpdateDeletedUserOpenTicketsStatus";
import Chat from "../../models/Chat";
import { getIO } from "../../libs/socket";

const DeleteUserService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const user = await User.findOne({
    where: { id }
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  // El ultimo superadministrador no se borra.
  //
  // El 22 sep 2026 se borro en produccion la unica cuenta super y no quedo
  // ninguna via de vuelta: el panel de administracion dejo de existir, el
  // correo de recuperacion no esta configurado y los seeds solo corren con
  // la base vacia. Hubo que entrar a la base por SSH para recuperarlo.
  //
  // Se comprueba sobre TODAS las empresas, no solo la suya: el super es un
  // rol de la instalacion entera.
  if (user.super) {
    const otrosSupers = await User.count({
      where: { super: true, id: { [Op.ne]: user.id } }
    });

    if (otrosSupers === 0) {
      throw new AppError("ERR_LAST_SUPER_USER", 400);
    }
  }

  const userOpenTickets: Ticket[] = await user.$get("tickets", {
    where: { status: "open" }
  });

  if (userOpenTickets.length > 0) {
    UpdateDeletedUserOpenTicketsStatus(userOpenTickets, companyId);
  }

  // Find all chats owned by the user
  const userChats = await Chat.findAll({
    where: { ownerId: id }
  });

  // Delete all chats owned by the user and emit socket events
  for (const chat of userChats) {
    await chat.destroy();

    const io = getIO();
    io.of(String(companyId)).emit(`company-${companyId}-chat`, {
      action: "delete",
      id: chat.id
    });
  }

  await user.destroy();
};

export default DeleteUserService;
