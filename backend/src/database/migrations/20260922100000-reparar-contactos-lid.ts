import { QueryInterface, QueryTypes } from "sequelize";
import { parDeMensajeGuardado } from "../../helpers/LidTelefono";

/**
 * Devuelve a los contactos su telefono, donde se les habia guardado el LID.
 *
 * WhatsApp empezo a direccionar por identificadores anonimos y el codigo
 * guardaba ese identificador en el campo del numero: en la empresa 1, 47 de
 * 55 contactos tenian por numero algo como "257720267587711@lid". De ahi los
 * nombres de quince digitos en la lista y la imposibilidad de llamar.
 *
 * El telefono no hay que pedirselo a WhatsApp: los mensajes ya guardados lo
 * traen en su dataJson (key.senderPn). Esta migracion lo saca de ahi.
 *
 * Lo que NO hace: fusionar contactos. Si el telefono ya es de otra ficha, el
 * contacto por LID se deja intacto y se cuenta en el log. Fusionar mueve
 * mensajes y tickets y borra una ficha; eso lo decide una persona mirando las
 * dos, no una migracion.
 *
 * La logica esta tambien en RepararContactosLid.ts, que es la que tiene
 * pruebas y sirve para volver a pasarla a mano. Aqui va en SQL porque en una
 * migracion los modelos todavia no estan registrados.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Antes de tocar nada, una copia de lo que se va a cambiar. Railway no
    // tiene copias continuas activadas y un volcado completo pide abrir el
    // Postgres al exterior; para una migracion de datos basta con guardar las
    // filas afectadas, que ademas es lo unico que haria falta restaurar.
    // La tabla se queda: ocupa poco y es la red de seguridad de este cambio.
    await queryInterface.sequelize.query(
      `CREATE TABLE IF NOT EXISTS "RespaldoLidContactos" (
         "id" SERIAL PRIMARY KEY,
         "contactId" INTEGER NOT NULL,
         "companyId" INTEGER,
         "number" VARCHAR(255),
         "name" VARCHAR(255),
         "lid" VARCHAR(255),
         "profilePicUrl" TEXT,
         "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
       )`
    );

    await queryInterface.sequelize.query(
      `INSERT INTO "RespaldoLidContactos"
         ("contactId", "companyId", "number", "name", "lid", "profilePicUrl")
       SELECT "id", "companyId", "number", "name", "lid", "profilePicUrl"
       FROM "Contacts"
       WHERE "number" LIKE '%@lid%'
         AND NOT EXISTS (
           SELECT 1 FROM "RespaldoLidContactos" r WHERE r."contactId" = "Contacts"."id"
         )`
    );

    const empresas: { companyId: number }[] =
      await queryInterface.sequelize.query(
        `SELECT DISTINCT "companyId" FROM "Contacts" WHERE "number" LIKE '%@lid%'`,
        { type: QueryTypes.SELECT }
      );

    for (const { companyId } of empresas) {
      const mensajes: { dataJson: string }[] =
        await queryInterface.sequelize.query(
          `SELECT "dataJson" FROM "Messages"
           WHERE "companyId" = :companyId AND "dataJson" LIKE '%senderPn%'`,
          { type: QueryTypes.SELECT, replacements: { companyId } }
        );

      const mapa = new Map<string, string>();
      for (const { dataJson } of mensajes) {
        const par = parDeMensajeGuardado(dataJson);
        if (par && !mapa.has(par.lid)) mapa.set(par.lid, par.telefono);
      }

      if (!mapa.size) continue;

      const contactos: { id: number; number: string; name: string }[] =
        await queryInterface.sequelize.query(
          `SELECT "id", "number", "name" FROM "Contacts"
           WHERE "companyId" = :companyId AND "number" LIKE '%@lid%'`,
          { type: QueryTypes.SELECT, replacements: { companyId } }
        );

      let reparados = 0;
      let ocupados = 0;

      for (const contacto of contactos) {
        const lid = (contacto.number || "").replace(/\D/g, "");
        const telefono = mapa.get(lid);
        if (!telefono) continue;

        const [ocupado]: { id: number }[] =
          await queryInterface.sequelize.query(
            `SELECT "id" FROM "Contacts"
             WHERE "companyId" = :companyId AND "number" = :telefono AND "id" <> :id
             LIMIT 1`,
            {
              type: QueryTypes.SELECT,
              replacements: { companyId, telefono, id: contacto.id }
            }
          );

        if (ocupado) {
          ocupados += 1;
          continue;
        }

        // El nombre solo se toca si era el propio identificador.
        const nombreEsLid = /^\d{6,}$/.test((contacto.name || "").trim());

        await queryInterface.sequelize.query(
          `UPDATE "Contacts"
           SET "number" = :telefono,
               "lid" = :lid,
               "name" = CASE WHEN :nombreEsLid THEN :telefono ELSE "name" END,
               "profilePicUrl" = CASE
                 WHEN "profilePicUrl" IS NULL OR "profilePicUrl" = '' OR "profilePicUrl" LIKE '%nopicture%'
                 THEN NULL ELSE "profilePicUrl" END,
               "updatedAt" = NOW()
           WHERE "id" = :id`,
          {
            replacements: {
              telefono,
              lid,
              nombreEsLid,
              id: contacto.id
            }
          }
        );

        await queryInterface.sequelize.query(
          `INSERT INTO "WhatsappLidMaps" ("lid", "companyId", "contactId", "createdAt", "updatedAt")
           SELECT :lid, :companyId, :id, NOW(), NOW()
           WHERE NOT EXISTS (
             SELECT 1 FROM "WhatsappLidMaps" WHERE "lid" = :lid AND "companyId" = :companyId
           )`,
          { replacements: { lid, companyId, id: contacto.id } }
        );

        reparados += 1;
      }

      // eslint-disable-next-line no-console
      console.log(
        `[LID] Empresa ${companyId}: ${reparados} contactos con su telefono, ` +
          `${ocupados} sin tocar porque el telefono ya era de otra ficha`
      );
    }
  },

  down: async (queryInterface: QueryInterface) => {
    // Devuelve a cada contacto lo que tenia antes, fila por fila, desde la
    // copia que dejo el up(). No es lo deseable —el LID en el campo del
    // numero es el fallo— pero si algo sale mal en produccion hay que poder
    // volver al estado exacto sin depender de un volcado externo.
    await queryInterface.sequelize.query(
      `UPDATE "Contacts" c
       SET "number" = r."number",
           "name" = r."name",
           "lid" = r."lid",
           "profilePicUrl" = r."profilePicUrl",
           "updatedAt" = NOW()
       FROM "RespaldoLidContactos" r
       WHERE r."contactId" = c."id"`
    );

    await queryInterface.sequelize.query(
      `DELETE FROM "WhatsappLidMaps" w
       USING "RespaldoLidContactos" r
       WHERE w."contactId" = r."contactId" AND r."lid" IS DISTINCT FROM w."lid"`
    );
  }
};
