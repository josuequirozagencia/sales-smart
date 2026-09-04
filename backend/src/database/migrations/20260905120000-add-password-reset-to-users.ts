import { QueryInterface, DataTypes } from "sequelize";

/**
 * Recuperacion de contrasena.
 *
 * Se guarda el HASH del token, no el token.
 *
 * Si se guardara en claro, cualquiera con lectura sobre la base —una copia
 * de seguridad, un volcado, un empleado con acceso— podria tomar el token
 * vigente de cualquier usuario y cambiarle la contrasena. Guardando solo su
 * hash, la base no contiene nada aprovechable: el token real existe
 * unicamente en el correo del destinatario.
 *
 * Se usa SHA-256 y no bcrypt a proposito. bcrypt es lento adrede para
 * resistir fuerza bruta sobre contrasenas humanas, que tienen poca
 * entropia; aqui el token son 256 bits aleatorios y no hay nada que
 * adivinar, asi que ralentizar la comprobacion solo perjudicaria al
 * usuario legitimo.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Users", "passwordResetTokenHash", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("Users", "passwordResetExpiresAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    // La busqueda se hace POR el hash del token, no por el correo: es lo
    // que permite validar el enlace sin que este tenga que revelar de quien
    // es la cuenta.
    await queryInterface.addIndex("Users", ["passwordResetTokenHash"], {
      name: "users_password_reset_token"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Users", "users_password_reset_token");
    await queryInterface.removeColumn("Users", "passwordResetExpiresAt");
    await queryInterface.removeColumn("Users", "passwordResetTokenHash");
  }
};
