import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
import { getTemplatesWhatsAppOficial } from "../../libs/whatsAppOficial/whatsAppOficial.service";
import { obtenerCredencialesMeta } from "../GhlServices/GhlConfigService";
import { ListaPlantillas, listarPlantillasMeta } from "./MetaTemplatesClient";

/**
 * Plantillas de WhatsApp aprobadas por Meta para una conexion, tal cual las
 * devuelve Meta ({ data, paging }). Solo lectura: se administran en Meta (o en
 * GHL), no aqui.
 *
 * - WhatsApp Oficial: la unica fuente real es api_oficial
 *   (GET /v1/templates-whatsapp/:token_mult100), que llama al Graph API de
 *   Meta con las credenciales de la conexion.
 * - GoHighLevel: GHL no deja leer plantillas por su API, pero la cuenta de
 *   WhatsApp Business de detras es de Meta. Con el ID de esa cuenta y un
 *   token de Meta guardados en la configuracion de GHL se leen del Graph API.
 * - WhatsApp por QR (Baileys) no tiene plantillas de Meta.
 *
 * Todo filtrado por empresa: la conexion tiene que ser de quien pregunta.
 */

const ListTemplatesService = async (
  whatsappId: number,
  companyId: number,
  opciones: { baseURLMeta?: string } = {}
): Promise<ListaPlantillas> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId },
    attributes: ["id", "companyId", "channel", "token"]
  });
  if (!whatsapp) throw new AppError("ERR_NO_WAPP_FOUND", 404);

  if (whatsapp.channel === "ghl") {
    const credenciales = await obtenerCredencialesMeta(companyId);
    if (!credenciales) throw new AppError("ERR_TEMPLATES_GHL_META_NOT_CONFIGURED", 400);
    return listarPlantillasMeta(credenciales.businessId, credenciales.accessToken, { baseURL: opciones.baseURLMeta });
  }

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
