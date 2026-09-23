import Setting from "../models/Setting";
import AppError from "../errors/AppError";

//será usado por agora somente para userCreation
const CheckSettings = async (key: string, companyId = 1): Promise<string> => {
  const setting = await Setting.findOne({
    where: { key, companyId }
  });

  if (!setting) {
    throw new AppError("ERR_NO_SETTING_FOUND", 404);
  }

  return setting.value;
};

export default CheckSettings;
