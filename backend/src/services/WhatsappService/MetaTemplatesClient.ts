import axios from "axios";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";

/**
 * Plantillas de una cuenta de WhatsApp Business directamente del Graph API de
 * Meta: la misma llamada que hace MetaService.getListTemplates en api_oficial
 * (GET /{business_id}/message_templates, misma version del API), para las
 * conexiones de GoHighLevel, cuyas credenciales de Meta viven en el backend.
 *
 * A diferencia de la de api_oficial recorre todas las paginas: Meta devuelve
 * de 25 en 25 y una cuenta con mas plantillas se veria recortada.
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

export const GRAPH_META = "https://graph.facebook.com/v20.0";
const MAX_PAGINAS = 20;

export const listarPlantillasMeta = async (
  businessId: string,
  accessToken: string,
  { baseURL = GRAPH_META }: { baseURL?: string } = {}
): Promise<ListaPlantillas> => {
  const plantillas: PlantillaMeta[] = [];
  let url: string | null = `${baseURL}/${encodeURIComponent(businessId)}/message_templates?limit=100`;
  let ultimaPaginacion: any;

  try {
    for (let pagina = 0; url && pagina < MAX_PAGINAS; pagina++) {
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000
      });
      plantillas.push(...(Array.isArray(data?.data) ? data.data : []));
      ultimaPaginacion = data?.paging;
      url = data?.paging?.next || null;
    }
  } catch (err: any) {
    const estado = err?.response?.status;
    const detalle = err?.response?.data?.error?.message || err?.message;
    logger.warn(`[PLANTILLAS] Graph API de Meta respondio ${estado || "sin respuesta"}: ${detalle}`);
    // 400/401/403 con un error de OAuth: credenciales o ID de cuenta mal.
    if ([400, 401, 403].includes(estado)) throw new AppError("ERR_TEMPLATES_META_REJECTED", 400);
    throw new AppError("ERR_TEMPLATES_UNAVAILABLE", 502);
  }

  return { data: plantillas, paging: ultimaPaginacion };
};
