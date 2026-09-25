import { QueryInterface } from "sequelize";

/**
 * El contacto pasa a ser opcional en las citas.
 *
 * Hace falta para traer la agenda de Google: un evento del calendario
 * puede ser una reunion de equipo o el dentista, sin ningun contacto de
 * WhatsApp detras. Con la columna obligatoria, esos eventos no se podian
 * guardar y la sincronizacion en ese sentido era imposible.
 *
 * OJO: esto lo permite la BASE, no la aplicacion. Crear una cita DESDE
 * ChatIA sigue exigiendo contacto, y eso se comprueba en
 * AppointmentServices/CreateService. La diferencia es deliberada: se abre
 * el hueco justo para lo que entra de fuera, sin relajar lo que se crea
 * dentro.
 *
 * Se usa SQL directo y no queryInterface.changeColumn porque con este
 * Sequelize y Postgres, al pasarle `references`, changeColumn NO llegaba a
 * quitar el NOT NULL y ademas creaba una segunda clave foranea sobre la
 * misma columna. Comprobado: decia "migrated" y la columna seguia igual.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Restos de un intento anterior con changeColumn. IF EXISTS lo hace
    // inofensivo en una base limpia.
    await queryInterface.sequelize.query(
      `alter table "Appointments" drop constraint if exists "Appointments_contactId_fkey1"`
    );

    await queryInterface.sequelize.query(
      `alter table "Appointments" alter column "contactId" drop not null`
    );
  },

  down: async (queryInterface: QueryInterface) => {
    // Volver a NOT NULL exige que no queden filas sin contacto.
    //
    // Las de origen google son copias del calendario y se recuperan
    // volviendo a sincronizar, asi que se retiran. Cualquier otra fila sin
    // contacto seria un dato que no sabemos reconstruir: en ese caso se
    // aborta con un mensaje claro en vez de borrarlo por nuestra cuenta.
    const [huerfanas]: any = await queryInterface.sequelize.query(
      `select count(*)::int as n from "Appointments"
       where "contactId" is null and coalesce("origin", 'crm') <> 'google'`
    );

    if (huerfanas[0] && huerfanas[0].n > 0) {
      throw new Error(
        `No se puede revertir: hay ${huerfanas[0].n} citas sin contacto que no vienen de Google. ` +
          `Asignales un contacto o eliminalas a mano antes de revertir.`
      );
    }

    await queryInterface.sequelize.query(
      `delete from "Appointments" where "contactId" is null and "origin" = 'google'`
    );

    await queryInterface.sequelize.query(
      `alter table "Appointments" alter column "contactId" set not null`
    );
  }
};
