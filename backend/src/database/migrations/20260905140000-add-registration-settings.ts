import { QueryInterface } from "sequelize";

/**
 * Ajustes de registro y acceso.
 *
 * requireApproval decide si una empresa recien registrada queda pendiente
 * o entra directa. Por defecto EXIGE aprobacion: es la opcion conservadora,
 * y quien quiera acceso automatico lo activa a conciencia. Al reves seria
 * abrir la puerta por omision.
 *
 * Los tres datos de soporte se movieron aqui desde el ambito global en el
 * que los cree en la migracion anterior. El motivo es que el endpoint que
 * guarda ajustes desde la pantalla escribe SIEMPRE con el companyId de
 * quien edita, asi que no puede tocar una fila global: quedarian creados
 * pero no editables. Se alinean con userCreation, que ya funciona asi y
 * tambien se lee antes de iniciar sesion.
 *
 * La empresa 1 es la instalacion anfitriona. Es la convencion que ya sigue
 * este proyecto: publicShow resuelve a companyId 1 cuando no se le dice
 * otra cosa.
 */

const CLAVES = ["supportEmail", "supportPhone", "supportNote"];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const ahora = new Date();

    // En una base vacia la empresa 1 aun no existe: la crean los seeds, que
    // corren despues de las migraciones, e insertar aqui romperia la clave
    // foranea. Se retiran los globales vacios de la migracion anterior y el
    // seed 20260907130000-create-host-settings crea estos ajustes.
    const [anfitriona]: any = await queryInterface.sequelize.query(
      `select id from "Companies" where id = 1 limit 1`
    );
    if (!anfitriona || anfitriona.length === 0) {
      await queryInterface.sequelize.query(
        `delete from "Settings" where key in (:claves) and "companyId" is null`,
        { replacements: { claves: CLAVES } }
      );
      return;
    }

    // Mover los de soporte a la empresa 1, conservando su valor si alguien
    // ya lo hubiera rellenado.
    for (const key of CLAVES) {
      const [global]: any = await queryInterface.sequelize.query(
        `select value from "Settings" where key = :key and "companyId" is null limit 1`,
        { replacements: { key } }
      );
      const valor = global && global[0] ? global[0].value : "";

      const [existe]: any = await queryInterface.sequelize.query(
        `select id from "Settings" where key = :key and "companyId" = 1 limit 1`,
        { replacements: { key } }
      );

      if (!existe || existe.length === 0) {
        await queryInterface.sequelize.query(
          `insert into "Settings" (key, value, "companyId", "createdAt", "updatedAt")
           values (:key, :valor, 1, :ahora, :ahora)`,
          { replacements: { key, valor, ahora } }
        );
      }

      await queryInterface.sequelize.query(
        `delete from "Settings" where key = :key and "companyId" is null`,
        { replacements: { key } }
      );
    }

    // Aprobacion manual, activada por defecto.
    const [yaEsta]: any = await queryInterface.sequelize.query(
      `select id from "Settings" where key = 'requireApproval' and "companyId" = 1 limit 1`
    );
    if (!yaEsta || yaEsta.length === 0) {
      await queryInterface.sequelize.query(
        `insert into "Settings" (key, value, "companyId", "createdAt", "updatedAt")
         values ('requireApproval', 'enabled', 1, :ahora, :ahora)`,
        { replacements: { ahora } }
      );
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      `delete from "Settings" where key in ('requireApproval','supportEmail','supportPhone','supportNote') and "companyId" = 1`
    );
  }
};
