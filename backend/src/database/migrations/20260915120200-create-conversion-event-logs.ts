import { QueryInterface, DataTypes } from "sequelize";

/**
 * Registro de cada evento de conversion: la deduplicacion y el diagnostico.
 *
 * (companyId, eventId) es unico. eventId es deterministico por hecho real
 * (lead_<contactId>, schedule_<appointmentId>, purchase_<saleId>), asi que
 * el mismo hecho no puede encolarse dos veces aunque el disparador se
 * repita. Hace falta de verdad: Meta NO deduplica los eventos de
 * mensajeria de negocios.
 *
 * status:
 *   pending  encolado, sin enviar todavia
 *   sent     Meta lo acepto
 *   skipped  no se envia por regla (sin datos para identificar al contacto,
 *            origen borrado...). lastError dice por que
 *   blocked  la empresa tiene las credenciales con error; se reencola al
 *            corregirlas si sigue dentro de los 7 dias
 *   failed   Meta rechazo el contenido, o se agotaron los reintentos
 *   expired  paso de los 7 dias que Meta admite sin llegar a enviarse
 *
 * No se guarda ningun dato personal del contacto: telefono y email se
 * leen y se cifran en el momento de enviar.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("ConversionEventLogs", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      eventId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // Lead | Schedule | Purchase: el hecho del CRM, no el nombre enviado.
      eventType: {
        type: DataTypes.STRING,
        allowNull: false
      },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      // contact | appointment | sale
      sourceType: {
        type: DataTypes.STRING,
        allowNull: false
      },
      sourceId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      occurredAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "pending"
      },
      // business_messaging | standard
      route: {
        type: DataTypes.STRING,
        allowNull: true
      },
      // Nombre con el que se envio: LeadSubmitted, Lead, Schedule, Purchase.
      sentEventName: {
        type: DataTypes.STRING,
        allowNull: true
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      lastError: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      fbtraceId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    await queryInterface.addIndex("ConversionEventLogs", ["companyId", "eventId"], {
      name: "conversion_event_logs_evento",
      unique: true
    });

    await queryInterface.addIndex("ConversionEventLogs", ["companyId", "status"], {
      name: "conversion_event_logs_estado"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("ConversionEventLogs");
  }
};
