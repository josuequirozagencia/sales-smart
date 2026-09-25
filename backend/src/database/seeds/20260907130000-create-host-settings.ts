import { QueryInterface } from "sequelize";

/**
 * Ajustes de la empresa 1 (la instalacion anfitriona) en una instalacion nueva.
 *
 * En una base existente los crean las migraciones
 * 20260905140000-add-registration-settings y 20260907120000-add-currency-setting.
 * En una base vacia esas migraciones no pueden, porque la empresa 1 la crea el
 * seed de empresa, que corre despues. Sin estos ajustes el registro de usuarios
 * falla: CheckSettings responde ERR_NO_SETTING_FOUND si falta requireApproval.
 *
 * Mismos valores que las migraciones. Si un ajuste ya existe no se toca.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const [empresa]: any = await queryInterface.sequelize.query(
      `select currency from "Companies" where id = 1 limit 1`
    );
    if (!empresa || empresa.length === 0) return;

    const ajustes = [
      { key: "requireApproval", value: "enabled" },
      { key: "supportEmail", value: "" },
      { key: "supportPhone", value: "" },
      { key: "supportNote", value: "" },
      { key: "currency", value: empresa[0].currency || "BRL" }
    ];
    const ahora = new Date();

    for (const { key, value } of ajustes) {
      const [existe]: any = await queryInterface.sequelize.query(
        `select id from "Settings" where key = :key and "companyId" = 1 limit 1`,
        { replacements: { key } }
      );
      if (existe && existe.length > 0) continue;

      await queryInterface.sequelize.query(
        `insert into "Settings" (key, value, "companyId", "createdAt", "updatedAt")
         values (:key, :value, 1, :ahora, :ahora)`,
        { replacements: { key, value, ahora } }
      );
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      `delete from "Settings" where key in ('requireApproval','supportEmail','supportPhone','supportNote','currency') and "companyId" = 1`
    );
  }
};
