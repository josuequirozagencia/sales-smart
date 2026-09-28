import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";
import GhlConfig from "../../models/GhlConfig";
import DeleteWhatsAppService from "./DeleteWhatsAppService";
import DeleteBaileysService from "../BaileysServices/DeleteBaileysService";
import { removeWbot } from "../../libs/wbot";
import cacheLayer from "../../libs/cache";
import { DeleteConnectionWhatsAppOficial } from "../../libs/whatsAppOficial/whatsAppOficial.service";
import logger from "../../utils/logger";

/**
 * Borra una conexion, con la limpieza que pida su canal.
 *
 * Antes esto estaba escrito dos veces en WhatsAppController —en remove y en
 * removeAdmin— como una lista de "if" por canal, y los canales que no
 * estaban en la lista NO SE BORRABAN: el endpoint respondia 200 con
 * "Session disconnected" y la fila seguia en su sitio. Le pasaba a GoHighLevel
 * en los dos sitios, y a la API oficial de WhatsApp en el de administracion.
 *
 * Ahora el caso por defecto es borrar. Un canal nuevo entra sin tocar nada y
 * se puede eliminar; solo hay que anadirle una rama si necesita desmontar
 * algo fuera de la base.
 *
 * Devuelve los ids borrados, porque Facebook e Instagram se llevan por
 * delante a todas las conexiones que comparten el mismo token y quien llama
 * tiene que avisar de todas.
 */
export const eliminarConexion = async (
  whatsapp: Whatsapp
): Promise<number[]> => {
  const id = String(whatsapp.id);

  if (whatsapp.channel === "whatsapp") {
    await DeleteBaileysService(id);
    await DeleteWhatsAppService(id);
    await cacheLayer.delFromPattern(`sessions:${id}:*`);
    removeWbot(whatsapp.id);
    return [whatsapp.id];
  }

  if (whatsapp.channel === "whatsapp_oficial") {
    await DeleteWhatsAppService(id);

    // La conexion del lado de la API oficial se intenta retirar, pero su
    // fallo no puede dejar la del CRM a medio borrar.
    try {
      await DeleteConnectionWhatsAppOficial(whatsapp.waba_webhook_id);
    } catch (error) {
      logger.info(
        `[CONEXIONES] No se pudo retirar la conexion en la API oficial: ${
          (error as Error).message
        }`
      );
    }

    return [whatsapp.id];
  }

  if (whatsapp.channel === "facebook" || whatsapp.channel === "instagram") {
    // Una pagina de Facebook y su Instagram comparten el token del usuario:
    // se van juntas, como estaba.
    const { facebookUserToken } = whatsapp;

    const hermanas = await Whatsapp.findAll({
      where: { facebookUserToken, companyId: whatsapp.companyId }
    });

    await Whatsapp.destroy({
      where: {
        id: { [Op.in]: hermanas.map(h => h.id) }
      }
    });

    return hermanas.map(h => h.id);
  }

  if (whatsapp.channel === "ghl") {
    // GoHighLevel guarda su configuracion aparte, por empresa y no por
    // conexion: el token cifrado, el locationId, el secreto del webhook, los
    // flujos anotados a mano y el mapeo de plantillas a Workflows viven todos
    // en una sola fila de GhlConfig.
    //
    // Si solo se borrara la fila de Whatsapp, eliminar la conexion no seria
    // una desconexion: el token seguiria cifrado en la base y el canal
    // volveria a funcionar en cuanto alguien reactivara la conexion, sin que
    // nadie hubiera tenido que volver a pegarlo. Por eso se va tambien la
    // configuracion.
    //
    // Ahora bien, el limite de conexiones es por canal y por plan, asi que
    // una empresa puede tener varias de GoHighLevel. La configuracion solo se
    // borra cuando se va la ultima: mientras quede otra, esa fila no es un
    // resto olvidado, esta en uso.
    const otrasDeGhl = await Whatsapp.count({
      where: {
        companyId: whatsapp.companyId,
        channel: "ghl",
        id: { [Op.ne]: whatsapp.id }
      }
    });

    if (otrasDeGhl === 0) {
      // Con la configuracion se va el webhookSecret, y con el muere la URL
      // que la empresa tenga pegada en la accion "Webhook" de su Workflow de
      // GHL: al reconectar se genera otro secreto y hay que volver a pegar la
      // URL nueva alli a mano. Lo mismo con el mapeo de plantillas y con las
      // credenciales de Meta para leerlas. No es un descuido: esto no es
      // editar la configuracion —donde el secreto se conserva a proposito—,
      // es desconectar del todo, y reconectar empieza de cero.
      await GhlConfig.destroy({
        where: { companyId: whatsapp.companyId }
      });
    }

    await DeleteWhatsAppService(id);
    return [whatsapp.id];
  }

  // Cualquier canal que no abra sesion ni guarde nada fuera: basta con borrar
  // la conexion. Las tablas que apuntan a ella (tickets, contactos,
  // campanas) la sueltan solas: sus claves ajenas son SET NULL o CASCADE.
  await DeleteWhatsAppService(id);
  return [whatsapp.id];
};

export default eliminarConexion;
