import { QueryInterface, DataTypes } from "sequelize";

/**
 * Ciclo de aprobacion de una empresa.
 *
 * NO se toca la columna `status`, que ya existe como booleano y significa
 * otra cosa: si la empresa esta activa o desactivada. La pantalla de
 * empresas la lee, y probablemente mas sitios. Son dos conceptos distintos
 * y mezclarlos obligaria a revisar cada uso.
 *
 *   status          activa / inactiva
 *   approvalStatus  el ciclo de la solicitud
 *
 * Las empresas existentes quedan APPROVED. Cualquier otro valor por
 * defecto dejaria fuera a quien ya estaba dentro, que es exactamente el
 * fallo que no puede cometer una migracion sobre el camino de acceso.
 */

/** pending | approved | rejected | suspended */
const ESTADOS = ["pending", "approved", "rejected", "suspended"];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Companies", "approvalStatus", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "approved"
    });

    // Quien aprobo o rechazo. Nulo para las que existian antes de esto y
    // para las aprobadas automaticamente.
    await queryInterface.addColumn("Companies", "approvedByUserId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await queryInterface.addColumn("Companies", "approvalAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await queryInterface.addColumn("Companies", "rejectionReason", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    // El panel de solicitudes lista por estado y fecha.
    await queryInterface.addIndex("Companies", ["approvalStatus"], {
      name: "companies_approval_status"
    });

    // Datos de soporte para el aviso de prueba vencida.
    //
    // Van como ajustes GLOBALES —companyId nulo— porque el mensaje se
    // muestra ANTES de entrar, cuando aun no se sabe de que empresa es
    // quien mira. Ya hay precedente de ajustes globales en esta tabla.
    const ahora = new Date();
    const ajustes = [
      { key: "supportEmail", value: "" },
      { key: "supportPhone", value: "" },
      { key: "supportNote", value: "" }
    ];

    for (const a of ajustes) {
      const [existe]: any = await queryInterface.sequelize.query(
        `select id from "Settings" where key = :key and "companyId" is null limit 1`,
        { replacements: { key: a.key } }
      );
      if (!existe || existe.length === 0) {
        await queryInterface.sequelize.query(
          `insert into "Settings" (key, value, "companyId", "createdAt", "updatedAt")
           values (:key, :value, null, :ahora, :ahora)`,
          { replacements: { key: a.key, value: a.value, ahora } }
        );
      }
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      `delete from "Settings" where key in ('supportEmail','supportPhone','supportNote') and "companyId" is null`
    );
    await queryInterface.removeIndex("Companies", "companies_approval_status");
    await queryInterface.removeColumn("Companies", "rejectionReason");
    await queryInterface.removeColumn("Companies", "approvalAt");
    await queryInterface.removeColumn("Companies", "approvedByUserId");
    await queryInterface.removeColumn("Companies", "approvalStatus");
  }
};

export { ESTADOS };
