import Plan from "../../models/Plan";

/**
 * Los planes que se pueden OFRECER.
 *
 * Esto alimenta al endpoint publico /plans/list, que no lleva sesion: lo
 * consultan la pantalla de registro y el selector de planes.
 *
 * Antes solo filtraba por isPublic cuando recibia listPublic === "false",
 * una condicion al reves de como se lee y, sobre todo, opcional: una
 * peticion anonima SIN parametros se llevaba el catalogo entero, planes
 * privados incluidos, con sus precios y sus limites. Quien llama no puede
 * elegir si se aplica el filtro, asi que el parametro ya no se mira.
 *
 * Los planes privados siguen disponibles para la administracion por
 * /plans/all, que si exige sesion.
 */
const FindAllPlanService = async (): Promise<Plan[]> =>
  Plan.findAll({
    where: { isPublic: true },
    order: [["name", "ASC"]]
  });

export default FindAllPlanService;
