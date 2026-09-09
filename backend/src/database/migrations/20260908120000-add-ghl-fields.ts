import { QueryInterface, DataTypes } from "sequelize";

/**
 * Identificador del contacto en GoHighLevel.
 *
 * Cada llamada a la API de GHL —mandar un mensaje, poner una etiqueta,
 * inscribir en un flujo— se hace contra SU identificador de contacto, no
 * contra el telefono. Sin guardarlo habria que resolverlo con una busqueda
 * en cada operacion: una peticion de red extra por cada etiqueta que
 * alguien pulse.
 *
 * Es nulo para todo lo que no venga de GHL, que es la inmensa mayoria. La
 * columna NO es unica: dos empresas distintas pueden estar conectadas a la
 * misma location de GHL y ver el mismo contacto, y un indice unico global
 * lo impediria. El indice es solo de busqueda.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Contacts", "ghlContactId", {
      type: DataTypes.STRING,
      allowNull: true
    });

    // El webhook de entrada busca por este campo en cada mensaje que llega.
    await queryInterface.addIndex("Contacts", ["ghlContactId"], {
      name: "contacts_ghl_contact_id"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Contacts", "contacts_ghl_contact_id");
    await queryInterface.removeColumn("Contacts", "ghlContactId");
  }
};
