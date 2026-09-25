import Tag from "../../models/Tag";

interface Request {
  companyId: number;
  pipelineId?: number | string;
}

/**
 * Etapas del tablero: las etiquetas con kanban = 1.
 *
 * Con pipelineId devuelve solo las de ese embudo; sin el, todas las de la
 * empresa, que es como se comportaba cuando solo habia un tablero.
 */
const KanbanListService = async ({
  companyId,
  pipelineId
}: Request): Promise<Tag[]> => {
  const where: Record<string, unknown> = { kanban: 1, companyId };

  if (pipelineId !== undefined && pipelineId !== null && pipelineId !== "") {
    const id = Number(pipelineId);
    if (Number.isInteger(id)) where.pipelineId = id;
  }

  const tags = await Tag.findAll({
    where,
    order: [["id", "ASC"]],
    raw: true
  });

  return tags;
};

export default KanbanListService;
