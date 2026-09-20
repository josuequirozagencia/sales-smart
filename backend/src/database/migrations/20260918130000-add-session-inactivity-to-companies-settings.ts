import { QueryInterface, DataTypes } from "sequelize";

/**
 * Minutos sin actividad tras los que se cierra la sesion de los usuarios de
 * la empresa (el frontend avisa un minuto antes). Lo ajusta el administrador
 * de cada empresa; 300 = 5 horas.
 *
 * Con DEFAULT en la columna, las empresas existentes y las que se creen
 * despues quedan con 5 horas sin tocar nada mas.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("CompaniesSettings", "sessionInactivityMinutes", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 300
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("CompaniesSettings", "sessionInactivityMinutes");
  }
};
