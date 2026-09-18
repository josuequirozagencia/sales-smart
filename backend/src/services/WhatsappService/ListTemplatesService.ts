import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
import { getTemplatesWhatsAppOficial } from "../../libs/whatsAppOficial/whatsAppOficial.service";

/**
 * Plantillas de WhatsApp aprobadas por Meta para una conexion, tal cual las
 * devuelve Meta ({ data, paging }). Solo lectura: se administran en Meta (o en
 * GHL), no aqui.
 *
 * - WhatsApp Oficial: la unica fuente real es api_oficial
 *   (GET /v1/templates-whatsapp/:token_mult100), que llama al Graph API de
 *   Meta con las credenciales de la conexion.
 * - WhatsApp por QR (Baileys) no tiene plantillas de Meta.
 *
 * Todo filtrado por empresa: la conexion tiene que ser de quien pregunta.
 */

export interface PlantillaMeta {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: any[];
  [campo: string]: any;
}

export interface ListaPlantillas {
  data: PlantillaMeta[];
  paging?: any;
}

const ListTemplatesService = async (whatsappId: number, companyId: number): Promise<ListaPlantillas> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId },
    attributes: ["id", "companyId", "channel", "token"]
  });
  if (!whatsapp) throw new AppError("ERR_NO_WAPP_FOUND", 404);

  if (whatsapp.channel !== "whatsapp_oficial") {
    throw new AppError("ERR_TEMPLATES_CHANNEL_UNSUPPORTED", 400);
  }
  if (!whatsapp.token) throw new AppError("ERR_TEMPLATES_UNAVAILABLE", 400);

  try {
    const resultado = await getTemplatesWhatsAppOficial(whatsapp.token);
    return { data: resultado?.data || [], paging: (resultado as any)?.paging };
  } catch (err) {
    // El cliente de api_oficial deja el detalle en el log; al usuario le
    // basta con saber que Meta no respondio.
    logger.warn(`[PLANTILLAS] Conexion ${whatsapp.id}: ${(err as Error).message}`);
    throw new AppError("ERR_TEMPLATES_UNAVAILABLE", 502);
  }
};

export default ListTemplatesService;
