import { QueryInterface, DataTypes } from "sequelize";

/**
 * Ultima lista de etiquetas que GoHighLevel reporto para cada contacto.
 *
 * GHL no dice QUE etiqueta cambio. Tanto el evento ContactTagUpdate (que
 * solo pueden recibir las apps del Marketplace, no un Private Integration
 * Token) como el webhook de un Workflow con disparador "Contact Tag" mandan
 * la lista COMPLETA de etiquetas actuales del contacto. Para aplicar en
 * Sales Smart solo lo que cambio hay que compararla con la anterior, y esa
 * anterior es la que se guarda aqui, en JSON.
 *
 * Sin esta columna la unica alternativa seria forzar que el contacto tenga
 * en Sales Smart exactamente las etiquetas de GHL, y eso borraria las que
 * solo existen aqui: las puestas antes de conectar GHL y las que no llegaron
 * a espejarse porque GHL estaba caido en ese momento.
 *
 * Nula hasta que llega el primer evento de etiquetas de ese contacto.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Contacts", "ghlTagsSnapshot", {
      type: DataTypes.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Contacts", "ghlTagsSnapshot");
  }
};
