import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

/**
 * A que embudo pertenece cada etapa del Kanban.
 *
 * Al desplegar esto, cada empresa que ya tenga tablero se queda con un embudo
 * "Proceso de venta" que contiene sus etapas actuales: nadie pierde su tablero.
 * Se hace aqui, en la misma migracion que crea la columna, para que corra una
 * sola vez.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tags", "pipelineId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "KanbanPipelines", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    const empresas: { companyId: number }[] = await queryInterface.sequelize.query(
      `SELECT DISTINCT "companyId" FROM "Tags" WHERE "kanban" = 1`,
      { type: QueryTypes.SELECT }
    );

    for (const { companyId } of empresas) {
      const [creado]: { id: number }[] = await queryInterface.sequelize.query(
        `INSERT INTO "KanbanPipelines" ("name", "order", "isDefault", "companyId", "createdAt", "updatedAt")
         VALUES ('Proceso de venta', 0, true, :companyId, NOW(), NOW())
         RETURNING "id"`,
        { type: QueryTypes.SELECT, replacements: { companyId } }
      );

      await queryInterface.sequelize.query(
        `UPDATE "Tags" SET "pipelineId" = :pipelineId
         WHERE "kanban" = 1 AND "companyId" = :companyId`,
        { replacements: { pipelineId: creado.id, companyId } }
      );
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Tags", "pipelineId");
  }
};
