import Company from "../../models/Company";
import KanbanPipeline from "../../models/KanbanPipeline";
import Tag from "../../models/Tag";
import {
  listarPipelines,
  crearPipeline,
  actualizarPipeline,
  borrarPipeline
} from "../../services/KanbanPipelineServices/KanbanPipelineService";
import KanbanListService from "../../services/TagServices/KanbanListService";
import { closeConnection, uniqueSuffix } from "../helpers/db";

// Embudos del Kanban: agrupan las etapas (etiquetas con kanban = 1) para que
// una empresa pueda tener varios tableros. Al borrar un embudo sus etapas se
// mudan, no se pierden, y el ultimo no se puede borrar.

let empresaA: Company;
let empresaB: Company;

const crearEmpresa = async () =>
  Company.create({
    name: `kanban-${uniqueSuffix()}`,
    planId: 1,
    status: true
  } as any);

const crearEtapa = async (companyId: number, pipelineId: number | null, name: string) =>
  Tag.create({
    name: `${name}-${uniqueSuffix()}`,
    color: "#A4CCCC",
    kanban: 1,
    companyId,
    pipelineId
  } as any);

beforeAll(async () => {
  empresaA = await crearEmpresa();
  empresaB = await crearEmpresa();
});

afterAll(async () => {
  await Tag.destroy({ where: { companyId: [empresaA.id, empresaB.id] } });
  await KanbanPipeline.destroy({ where: { companyId: [empresaA.id, empresaB.id] } });
  await Company.destroy({ where: { id: [empresaA.id, empresaB.id] } });
  await closeConnection();
});

describe("crearPipeline", () => {
  it("el primero de la empresa es el de referencia y los siguientes no", async () => {
    const primero = await crearPipeline(empresaA.id, "Proceso de venta");
    const segundo = await crearPipeline(empresaA.id, "Postventa");

    expect(primero.isDefault).toBe(true);
    expect(primero.order).toBe(0);
    expect(segundo.isDefault).toBe(false);
    expect(segundo.order).toBe(1);
  });

  it("rechaza un nombre vacio o demasiado corto", async () => {
    await expect(crearPipeline(empresaA.id, "")).rejects.toMatchObject({
      message: "ERR_PIPELINE_NAME_INVALID",
      statusCode: 400
    });
    await expect(crearPipeline(empresaA.id, "x")).rejects.toMatchObject({
      message: "ERR_PIPELINE_NAME_INVALID"
    });
  });
});

describe("listarPipelines", () => {
  it("devuelve solo los de su empresa, por orden", async () => {
    await crearPipeline(empresaB.id, "Embudo de otra empresa");

    const deA = await listarPipelines(empresaA.id);
    const deB = await listarPipelines(empresaB.id);

    expect(deA.map(p => p.name)).toEqual(["Proceso de venta", "Postventa"]);
    expect(deB).toHaveLength(1);
    expect(deB[0].name).toBe("Embudo de otra empresa");
  });
});

describe("actualizarPipeline", () => {
  it("renombra y reordena", async () => {
    const [primero] = await listarPipelines(empresaA.id);
    const cambiado = await actualizarPipeline(primero.id, empresaA.id, {
      name: "Ventas",
      order: 3
    });

    expect(cambiado.name).toBe("Ventas");
    expect(cambiado.order).toBe(3);
  });

  it("no toca un embudo de otra empresa", async () => {
    const [deB] = await listarPipelines(empresaB.id);
    await expect(
      actualizarPipeline(deB.id, empresaA.id, { name: "Intento" })
    ).rejects.toMatchObject({ message: "ERR_PIPELINE_NOT_FOUND", statusCode: 404 });
  });

  it("rechaza un orden que no es un entero positivo", async () => {
    const [primero] = await listarPipelines(empresaA.id);
    await expect(
      actualizarPipeline(primero.id, empresaA.id, { order: -1 })
    ).rejects.toMatchObject({ message: "ERR_PIPELINE_ORDER_INVALID" });
  });
});

describe("borrarPipeline", () => {
  it("no deja borrar el ultimo embudo de la empresa", async () => {
    const [unico] = await listarPipelines(empresaB.id);
    await expect(borrarPipeline(unico.id, empresaB.id)).rejects.toMatchObject({
      message: "ERR_PIPELINE_LAST_ONE",
      statusCode: 400
    });
    expect(await listarPipelines(empresaB.id)).toHaveLength(1);
  });

  it("muda las etapas del embudo borrado al de referencia", async () => {
    const pipelines = await listarPipelines(empresaA.id);
    const referencia = pipelines.find(p => p.isDefault);
    const otro = pipelines.find(p => !p.isDefault);

    const etapa = await crearEtapa(empresaA.id, otro.id, "Negociacion");

    await borrarPipeline(otro.id, empresaA.id);

    await etapa.reload();
    expect(etapa.pipelineId).toBe(referencia.id);
    expect(await KanbanPipeline.findByPk(otro.id)).toBeNull();
  });

  it("si se borra el de referencia, otro pasa a serlo y recibe sus etapas", async () => {
    const referencia = (await listarPipelines(empresaA.id)).find(p => p.isDefault);
    const nuevo = await crearPipeline(empresaA.id, "Soporte");
    const etapa = await crearEtapa(empresaA.id, referencia.id, "Contacto");

    await borrarPipeline(referencia.id, empresaA.id);

    await etapa.reload();
    await nuevo.reload();
    expect(nuevo.isDefault).toBe(true);
    expect(etapa.pipelineId).toBe(nuevo.id);
  });
});

describe("KanbanListService", () => {
  it("filtra las etapas por embudo y sin filtro devuelve todas las de la empresa", async () => {
    const embudo1 = (await listarPipelines(empresaA.id))[0];
    const embudo2 = await crearPipeline(empresaA.id, "Cobranza");

    const enUno = await crearEtapa(empresaA.id, embudo1.id, "Etapa1");
    const enDos = await crearEtapa(empresaA.id, embudo2.id, "Etapa2");

    const soloUno = await KanbanListService({
      companyId: empresaA.id,
      pipelineId: embudo1.id
    });
    const todas = await KanbanListService({ companyId: empresaA.id });

    expect(soloUno.map(t => t.id)).toContain(enUno.id);
    expect(soloUno.map(t => t.id)).not.toContain(enDos.id);
    expect(todas.map(t => t.id)).toEqual(
      expect.arrayContaining([enUno.id, enDos.id])
    );
  });
});
