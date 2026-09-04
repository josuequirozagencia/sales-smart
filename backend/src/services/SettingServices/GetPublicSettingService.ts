import Setting from "../../models/Setting";

interface Request {
  key: string;
  companyId?: number;
}

const publicSettingsKeys = [
  "userCreation",
  "primaryColorLight",
  "primaryColorDark",
  "appLogoLight",
  "appLogoDark",
  "appLogoFavicon",
  "appName",
  "enabledLanguages",
  "appLogoBackgroundLight",
  "appLogoBackgroundDark",
  // Datos de soporte. Se muestran ANTES de entrar —por ejemplo al avisar
  // de que la prueba vencio— cuando aun no se sabe de que empresa es quien
  // mira, asi que tienen que ser legibles sin sesion. No son secretos: son
  // precisamente los datos de contacto que uno quiere que se vean.
  // El registro consulta si hace falta aprobacion antes de que exista
  // empresa ni sesion, asi que tiene que poder leerse sin autenticar. No
  // es sensible: solo dice si las altas pasan por revision.
  "requireApproval",
  "supportEmail",
  "supportPhone",
  "supportNote"
];

const GetPublicSettingService = async ({
  key,
  companyId
}: Request): Promise<string | undefined> => {
  if (!publicSettingsKeys.includes(key)) {
    return null;
  }

  const targetCompanyId = companyId || 1;

  const setting = await Setting.findOne({
    where: {
      companyId: targetCompanyId,
      key
    }
  });

  if (setting) return setting.value;

  // Respaldo global: un ajuste con companyId nulo vale para todas. Hace
  // falta para lo que se consulta sin sesion, cuando no hay empresa que
  // mirar. No cambia nada para las claves que ya existian: ninguna tiene
  // fila global, asi que siguen resolviendose igual.
  const global = await Setting.findOne({
    where: { companyId: null, key }
  });

  return global?.value;
};

export default GetPublicSettingService;
