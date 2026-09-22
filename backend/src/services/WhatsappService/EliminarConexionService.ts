import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";
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

  // GoHighLevel y cualquier canal que no abra sesion: no hay nada que
  // desmontar fuera, basta con borrar la conexion. Las tablas que apuntan a
  // ella (tickets, contactos, campanas) la sueltan solas: sus claves ajenas
  // son SET NULL o CASCADE.
  await DeleteWhatsAppService(id);
  return [whatsapp.id];
};

export default eliminarConexion;
