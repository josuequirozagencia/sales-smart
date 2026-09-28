import { QueryInterface, DataTypes } from "sequelize";

/**
 * Separa la prueba gratuita de la suscripcion.
 *
 * Hasta ahora una sola columna, dueDate, hacia los dos trabajos: fin de
 * prueba para las empresas con un plan marcado como trial, y fecha de cobro
 * para las demas. De ahi venia que la fecha de alta acabara usandose como
 * fecha de cobro, cuando darse de alta no es contratar.
 *
 * Las cinco columnas nacen ANULABLES y sin valor por defecto, a proposito:
 * las empresas que ya existen se quedan en NULL y el codigo las trata como
 * regimen anterior, exactamente igual que hoy. No hay relleno retroactivo.
 *
 * billingDayOfMonth no es redundante con dueDate: guarda el dia PRETENDIDO.
 * Sin el, una suscripcion del dia 31 pasa por el 28 de febrero y se queda
 * en 28 para siempre, en vez de volver al 31 en marzo.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Companies", "trialStartAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await queryInterface.addColumn("Companies", "trialEndsAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await queryInterface.addColumn("Companies", "subscribedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await queryInterface.addColumn("Companies", "subscriptionStatus", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("Companies", "billingDayOfMonth", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Companies", "billingDayOfMonth");
    await queryInterface.removeColumn("Companies", "subscriptionStatus");
    await queryInterface.removeColumn("Companies", "subscribedAt");
    await queryInterface.removeColumn("Companies", "trialEndsAt");
    await queryInterface.removeColumn("Companies", "trialStartAt");
  }
};
