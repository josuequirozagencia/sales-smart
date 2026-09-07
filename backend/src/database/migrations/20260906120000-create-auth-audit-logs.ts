import { QueryInterface, DataTypes } from "sequelize";

/**
 * Registro de auditoria del acceso.
 *
 * Guarda QUE paso, QUIEN lo hizo y CUANDO en el camino de registro,
 * aprobacion y contrasenas. Existe para poder responder meses despues por
 * que una empresa quedo fuera o quien la aprobo, que es justo lo que se
 * pregunta cuando alguien reclama y ya nadie se acuerda.
 *
 * Es una tabla NUEVA y no un uso de LogTickets: aquella cuelga de un
 * ticket —columna obligatoria— y no puede describir algo que ocurre antes
 * de que exista ninguno.
 *
 * NO se guarda aqui ninguna contrasena, token ni secreto. Un registro de
 * auditoria se conserva mucho tiempo y suele leerse con menos cuidado que
 * el resto: es el ultimo sitio donde debe caer algo sensible.
 *
 * Las claves ajenas van con SET NULL a proposito. Si se borra la empresa o
 * el usuario, la linea del registro se queda: perder el rastro al borrar
 * lo que se auditaba vaciaria la tabla en el unico momento en que importa.
 */

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AuthAuditLogs", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      // REGISTRATION_CREATED, REGISTRATION_APPROVED, ...
      event: {
        type: DataTypes.STRING,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      // A quien afecta.
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      // Quien lo provoco, cuando no es el mismo. Al aprobar una empresa,
      // el superadministrador que decidio.
      actorUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      // Correo tal y como llego. Sirve cuando aun no hay usuario detras,
      // por ejemplo al pedir una contrasena para una cuenta inexistente.
      email: {
        type: DataTypes.STRING,
        allowNull: true
      },
      // Texto libre: el motivo de un rechazo, el estado anterior.
      detail: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      ip: {
        type: DataTypes.STRING,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Las dos preguntas que se hacen sobre esta tabla: que paso con esta
    // empresa, y que ha pasado ultimamente de este tipo.
    await queryInterface.addIndex("AuthAuditLogs", ["companyId"], {
      name: "auth_audit_logs_company"
    });
    await queryInterface.addIndex("AuthAuditLogs", ["event", "createdAt"], {
      name: "auth_audit_logs_event_date"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AuthAuditLogs");
  }
};
