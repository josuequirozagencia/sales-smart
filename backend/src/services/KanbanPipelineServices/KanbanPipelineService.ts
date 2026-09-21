import * as Yup from "yup";
import AppError from "../../errors/AppError";
import KanbanPipeline from "../../models/KanbanPipeline";
import Tag from "../../models/Tag";

/**
 * Embudos del Kanban. Cada uno agrupa las etapas (etiquetas con kanban = 1) de
 * un tablero. La empresa sale SIEMPRE de quien llama, nunca del cuerpo de la
 * peticion, y ninguna consulta cruza empresas.
 */

const esquemaNombre = Yup.object().shape({
  name: Yup.string().required().min(2).max(60)
});

const validarNombre = async (name: unknown) => {
  try {
    await esquemaNombre.validate({ name });
  } catch (err: any) {
    throw new AppError("ERR_PIPELINE_NAME_INVALID", 400);
  }
  return String(name).trim();
};

export const listarPipelines = async (
  companyId: number
): Promise<KanbanPipeline[]> =>
  KanbanPipeline.findAll({
    where: { companyId },
    order: [
      ["order", "ASC"],
      ["id", "ASC"]
    ]
  });

const buscarPipeline = async (
  id: number | string,
  companyId: number
): Promise<KanbanPipeline> => {
  const pipeline = await KanbanPipeline.findOne({ where: { id, companyId } });
  if (!pipeline) throw new AppError("ERR_PIPELINE_NOT_FOUND", 404);
  return pipeline;
};

export const crearPipeline = async (
  companyId: number,
  name: unknown
): Promise<KanbanPipeline> => {
  const nombre = await validarNombre(name);
  const existentes = await KanbanPipeline.count({ where: { companyId } });

  return KanbanPipeline.create({
    name: nombre,
    companyId,
    order: existentes,
    // El primero de la empresa es el de referencia: ahi van a parar las etapas
    // de cualquier embudo que se borre despues.
    isDefault: existentes === 0
  } as any);
};

export const actualizarPipeline = async (
  id: number | string,
  companyId: number,
  datos: { name?: unknown; order?: unknown }
): Promise<KanbanPipeline> => {
  const pipeline = await buscarPipeline(id, companyId);
  const cambios: { name?: string; order?: number } = {};

  if (datos.name !== undefined) {
    cambios.name = await validarNombre(datos.name);
  }

  if (datos.order !== undefined) {
    const orden = Number(datos.order);
    if (!Number.isInteger(orden) || orden < 0) {
      throw new AppError("ERR_PIPELINE_ORDER_INVALID", 400);
    }
    cambios.order = orden;
  }

  await pipeline.update(cambios);
  return pipeline.reload();
};

/**
 * Borrar un embudo NO borra sus etapas: se mueven al embudo de referencia de la
 * empresa, como DeleteUserService hace con los tickets del usuario que se
 * borra. Y no se puede borrar el ultimo: la empresa se quedaria sin tablero y
 * con etapas sueltas que no se veran en ninguna parte.
 */
export const borrarPipeline = async (
  id: number | string,
  companyId: number
): Promise<void> => {
  const pipeline = await buscarPipeline(id, companyId);
  const total = await KanbanPipeline.count({ where: { companyId } });

  if (total <= 1) {
    throw new AppError("ERR_PIPELINE_LAST_ONE", 400);
  }

  const destino = await KanbanPipeline.findOne({
    where: { companyId, isDefault: true },
    order: [["id", "ASC"]]
  });

  // Si el que se borra era el de referencia, el destino es el siguiente por
  // orden, que ademas pasa a ser el de referencia.
  let receptor = destino && destino.id !== pipeline.id ? destino : null;
  if (!receptor) {
    receptor = await KanbanPipeline.findOne({
      where: { companyId },
      order: [
        ["order", "ASC"],
        ["id", "ASC"]
      ]
    });
    if (receptor?.id === pipeline.id) {
      receptor = await KanbanPipeline.findOne({
        where: { companyId },
        order: [
          ["order", "DESC"],
          ["id", "DESC"]
        ]
      });
    }
    if (receptor) await receptor.update({ isDefault: true });
  }

  await Tag.update(
    { pipelineId: receptor.id } as any,
    { where: { pipelineId: pipeline.id, companyId } }
  );

  await pipeline.destroy();
};
