// src/services/UserServices/UpdateUserService.ts - ATUALIZADO COM NOVA COLUNA
import * as Yup from "yup";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import ShowUserService from "./ShowUserService";
import Company from "../../models/Company";
import User from "../../models/User";

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  companyId?: number;
  queueIds?: number[];
  startWork?: string;
  endWork?: string;
  farewellMessage?: string;
  whatsappId?: number;
  allTicket?: string;
  distributionWeight?: number;
  defaultTheme?: string;
  defaultMenu?: string;
  allowGroup?: boolean;
  allHistoric?: string;
  allUserChat?: string;
  userClosePendingTicket?: string;
  showDashboard?: string;
  defaultTicketsManagerWidth?: number;
  allowRealTime?: string;
  allowConnections?: string;
  showContacts?: string;
  showCampaign?: string;
  showFlow?: string;
  profileImage?: string;
  finalizacaoComValorVendaAtiva?: boolean;
  birthDate?: Date | string;
  allowSeeMessagesInPendingTickets?: string; // 🆕 NOVO CAMPO ADICIONADO
  /**
   * Rol de instalacion, por encima del perfil de empresa. Solo lo puede
   * cambiar otro super; ver las reglas donde se aplica.
   */
  super?: boolean;
}

interface Request {
  userData: UserData;
  userId: string | number;
  companyId: number;
  requestUserId: number;
}

interface Response {
  id: number;
  name: string;
  email: string;
  profile: string;
}

const UpdateUserService = async ({
  userData,
  userId,
  companyId,
  requestUserId
}: Request): Promise<Response | undefined> => {
  const user = await ShowUserService(userId, companyId);

  const requestUser = await User.findByPk(requestUserId);

  if (requestUser.super === false && userData.companyId !== companyId) {
    throw new AppError("O usuário não pertence à esta empresa");
  }

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    allHistoric: Yup.string(),
    email: Yup.string().email(),
    profile: Yup.string(),
    password: Yup.string(),
    birthDate: Yup.date().nullable().max(new Date(), "Data de nascimento não pode ser no futuro"),
  });

  const oldUserEmail = user.email;

  const {
    email,
    password,
    profile,
    name,
    queueIds = [],
    startWork,
    endWork,
    farewellMessage,
    whatsappId,
    allTicket,
    distributionWeight,
    defaultTheme,
    defaultMenu,
    allowGroup,
    allHistoric,
    allUserChat,
    userClosePendingTicket,
    showDashboard,
    allowConnections,
    defaultTicketsManagerWidth = 550,
    allowRealTime,
    showContacts,
    showCampaign,
    showFlow,
    profileImage,
    finalizacaoComValorVendaAtiva,
    birthDate,
    allowSeeMessagesInPendingTickets,
    super: superPedido
  } = userData;

  try {
    await schema.validate({ 
      email, 
      password, 
      profile, 
      name, 
      birthDate
    });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // Processar data de nascimento
  let processedBirthDate: Date | null = user.birthDate;
  if (birthDate !== undefined) {
    if (birthDate === null || birthDate === '') {
      processedBirthDate = null;
    } else if (typeof birthDate === 'string') {
      const dateOnly = birthDate.split('T')[0];
      processedBirthDate = new Date(dateOnly + 'T12:00:00');
    } else if (birthDate instanceof Date) {
      const year = birthDate.getFullYear();
      const month = birthDate.getMonth();
      const day = birthDate.getDate();
      processedBirthDate = new Date(year, month, day, 12, 0, 0);
    }
  }

  // Quien es super se decide aqui, y con tres reglas.
  //
  // Hasta ahora no se podia cambiar desde ningun sitio: ni el formulario lo
  // ofrecia ni este servicio aceptaba el campo, asi que el unico modo de
  // nombrar un super era escribir en la base a mano. Eso dejaba a la
  // instalacion con un solo super y sin forma de preparar un relevo.
  let superFinal = user.super;

  if (superPedido !== undefined && Boolean(superPedido) !== user.super) {
    // 1. Solo un super reparte el rol. Si no, cualquier admin se ascenderia
    //    a si mismo y vería las empresas de todos los clientes.
    if (!requestUser.super) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }

    // 2. Nadie se quita el super a si mismo: es la forma mas facil de
    //    quedarse fuera del panel sin querer.
    if (!superPedido && Number(user.id) === Number(requestUser.id)) {
      throw new AppError("ERR_CANNOT_REMOVE_OWN_SUPER", 400);
    }

    // 3. No puede quedarse la instalacion sin ninguno.
    if (!superPedido) {
      const otrosSupers = await User.count({
        where: { super: true, id: { [Op.ne]: user.id } }
      });

      if (otrosSupers === 0) {
        throw new AppError("ERR_LAST_SUPER_USER", 400);
      }
    }

    superFinal = Boolean(superPedido);
  }

  await user.update({
    email,
    password,
    profile,
    super: superFinal,
    name,
    startWork,
    endWork,
    farewellMessage,
    whatsappId: whatsappId || null,
    allTicket,
    distributionWeight,
    defaultTheme,
    defaultMenu,
    allowGroup,
    allHistoric,
    allUserChat,
    userClosePendingTicket,
    showDashboard,
    defaultTicketsManagerWidth,
    allowRealTime,
    profileImage,
    allowConnections,
    showContacts,
    showCampaign,
    showFlow,
    finalizacaoComValorVendaAtiva,
    birthDate: processedBirthDate,
    allowSeeMessagesInPendingTickets
  });

  await user.$set("queues", queueIds);

  await user.reload();

  const company = await Company.findByPk(user.companyId);

  if (company.email === oldUserEmail) {
    await company.update({
      email,
      password
    });
  }

  const serializedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    company,
    queues: user.queues,
    startWork: user.startWork,
    endWork: user.endWork,
    greetingMessage: user.farewellMessage,
    allTicket: user.allTicket,
    defaultMenu: user.defaultMenu,
    defaultTheme: user.defaultTheme,
    allowGroup: user.allowGroup,
    allHistoric: user.allHistoric,
    userClosePendingTicket: user.userClosePendingTicket,
    showDashboard: user.showDashboard,
    defaultTicketsManagerWidth: user.defaultTicketsManagerWidth,
    allowRealTime: user.allowRealTime,
    allowConnections: user.allowConnections,
    showContacts: user.showContacts,
    showCampaign: user.showCampaign,
    profileImage: user.profileImage,
    showFlow: user.showFlow,
    finalizacaoComValorVendaAtiva: user.finalizacaoComValorVendaAtiva,
    birthDate: user.birthDate,
    allowSeeMessagesInPendingTickets: user.allowSeeMessagesInPendingTickets
  };

  return serializedUser;
};

export default UpdateUserService;