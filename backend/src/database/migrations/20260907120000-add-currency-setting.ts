import { QueryInterface } from "sequelize";

/**
 * Moneda de la instalacion.
 *
 * Hasta ahora la moneda vivia SOLO en el navegador de cada persona
 * (`localStorage.selectedCurrency`, con real brasileno por defecto). Eso
 * bastaba para las pantallas de dentro, pero no para el registro publico:
 * quien entra por primera vez no tiene nada guardado, asi que veia el
 * precio de los planes en reales aunque la instalacion cobre en otra cosa.
 * Es la primera pantalla que ve un cliente y la cifra estaba mal.
 *
 * Se guarda como ajuste de la empresa 1 —la instalacion anfitriona— igual
 * que userCreation y requireApproval, que tambien se leen antes de iniciar
 * sesion. No se inventa una tabla ni una columna: es la convencion que ya
 * sigue este proyecto.
 *
 * El valor inicial NO es una constante: se toma de la columna `currency`
 * que la empresa 1 ya tiene. Asi nadie ve cambiar una cifra por haber
 * aplicado esta migracion; solo cambiara cuando alguien lo decida desde
 * los ajustes.
 */

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const ahora = new Date();

    const [yaEsta]: any = await queryInterface.sequelize.query(
      `select id from "Settings" where key = 'currency' and "companyId" = 1 limit 1`
    );
    if (yaEsta && yaEsta.length > 0) return;

    const [empresa]: any = await queryInterface.sequelize.query(
      `select currency from "Companies" where id = 1 limit 1`
    );
    // Si la empresa 1 no existe o no tiene moneda, se cae al mismo valor
    // que usaba el codigo hasta ahora, para no cambiar nada por sorpresa.
    const valor =
      empresa && empresa[0] && empresa[0].currency ? empresa[0].currency : "BRL";

    await queryInterface.sequelize.query(
      `insert into "Settings" (key, value, "companyId", "createdAt", "updatedAt")
       values ('currency', :valor, 1, :ahora, :ahora)`,
      { replacements: { valor, ahora } }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      `delete from "Settings" where key = 'currency' and "companyId" = 1`
    );
  }
};
