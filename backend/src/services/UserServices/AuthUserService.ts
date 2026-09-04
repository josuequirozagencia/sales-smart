import User from "../../models/User";
import AppError from "../../errors/AppError";
import { evaluarAccesoDeUsuario } from "../../helpers/CompanyAccessPolicy";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";
import { SerializeUser } from "../../helpers/SerializeUser";
import Queue from "../../models/Queue";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import Setting from "../../models/Setting";
import CompaniesSettings from "../../models/CompaniesSettings";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  queues: Queue[];
  companyId: number;
  allTicket: string;
  defaultTheme: string;
  defaultMenu: string;
  allowGroup?: boolean;
  allHistoric?: string;
  allUserChat?: string;
  allowSeeMessagesInPendingTickets?: string;
  userClosePendingTicket?: string;
  showDashboard?: string;
  token?: string;
}

interface Request {
  email: string;
  password: string;
}

interface Response {
  serializedUser: SerializedUser;
  token: string;
  refreshToken: string;
}

const AuthUserService = async ({
  email,
  password
}: Request): Promise<Response> => {
  const user = await User.findOne({
    where: { email },
    include: [
      "queues",
      { model: Company, include: [{ model: CompaniesSettings }] }
    ],
    attributes: { include: ["finalizacaoComValorVendaAtiva"] }
  });

  if (!user) {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }

  const Hr = new Date();

  const hh: number = Hr.getHours() * 60 * 60;
  const mm: number = Hr.getMinutes() * 60;
  const hora = hh + mm;

  const inicio: string = user.startWork;
  const hhinicio = Number(inicio.split(":")[0]) * 60 * 60;
  const mminicio = Number(inicio.split(":")[1]) * 60;
  const horainicio = hhinicio + mminicio;

  const termino: string = user.endWork;
  const hhtermino = Number(termino.split(":")[0]) * 60 * 60;
  const mmtermino = Number(termino.split(":")[1]) * 60;
  const horatermino = hhtermino + mmtermino;

  if (hora < horainicio || hora > horatermino) {
    throw new AppError("ERR_OUT_OF_HOURS", 401);
  }

  if (await user.checkPassword(password)) {
    // Se incluye el plan: la politica necesita saber si es una prueba
    // para decidir el corte por vencimiento. Sin el, isTrial seria siempre
    // falso y el corte no actuaria nunca, fallando en silencio.
    const company = await Company.findByPk(user?.companyId, {
      include: [{ model: Plan }]
    });

    // La contrasena es correcta, pero puede que la empresa no pueda
    // entrar: pendiente de aprobacion, rechazada, suspendida o con la
    // prueba vencida.
    //
    // Se comprueba DESPUES de validar la contrasena a proposito: hacerlo
    // antes revelaria el estado de una empresa a quien solo conoce un
    // correo, sin demostrar que es de los suyos.
    const bloqueo = evaluarAccesoDeUsuario(user, company);
    if (bloqueo) {
      throw new AppError(bloqueo, 401);
    }

    await company.update({
      lastLogin: new Date()
    });
  } else {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }

  const token = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  const serializedUser = await SerializeUser(user);

  return {
    serializedUser,
    token,
    refreshToken
  };
};

export default AuthUserService;
