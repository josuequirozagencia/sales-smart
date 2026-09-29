import { QueryInterface, DataTypes } from "sequelize";

/**
 * Credito prepago para los Agentes IA.
 *
 * Un agente puede correr con la clave de OpenAI del propio cliente —la que
 * ya guarda AiAgent.apiKey— o con una clave compartida de la agencia. En el
 * primer caso el gasto es suyo y aqui no se anota nada. En el segundo el
 * gasto es de la agencia, y estas tablas son las que lo miden y lo cobran.
 *
 * Nada de floats para dinero: el saldo y los movimientos van en centavos
 * enteros. El unico decimal es el precio por unidad, que tiene que serlo:
 * un token de gpt-4o-mini cuesta 0,000015 centavos, y guardado como entero
 * se redondearia a cero y el margen dejaria de existir.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // El saldo, una fila por empresa.
    await queryInterface.createTable("AiCreditAccounts", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      // Puede quedar en negativo: una respuesta ya pedida se paga aunque
      // deje el saldo por debajo de cero. Lo que no se hace es empezar otra.
      balanceCents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      // La parte de centavo que aun no se ha cobrado, en millonesimas.
      //
      // Hace falta: una respuesta de gpt-4o cuesta unas 0,3 centesimas de
      // centavo. Redondeando cada mensaje a centavo entero saldria a cero, y
      // TODOS los modelos de texto serian gratis. Aqui se acumula el resto y
      // se cobra un centavo cuando se junta, que es lo que de verdad pasa.
      pendingMicroCents: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
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

    // El historial. Solo se anaden filas: nunca se edita ni se borra una.
    await queryInterface.createTable("AiCreditLedger", {
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
      /** grant_admin | consumption | purchase | adjustment */
      type: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // Negativo cuando se gasta, positivo cuando se recarga.
      amountCents: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      balanceAfterCents: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      aiAgentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "AiAgents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      // Sin clave ajena a proposito: es un registro contable. Si manana se
      // borra el mensaje, el cobro que se hizo por el sigue siendo cierto y
      // su identificador tiene que seguir ahi para que no se cobre dos veces.
      messageId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
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

    // El historial se lee por empresa y por fecha.
    await queryInterface.addIndex("AiCreditLedger", ["companyId", "createdAt"], {
      name: "ai_credit_ledger_company_fecha"
    });

    // Un mensaje se cobra UNA vez. Si el proveedor de WhatsApp reintenta, o
    // se reintenta la respuesta por un fallo de red, el segundo descuento
    // choca aqui en vez de cobrarse dos veces. Parcial a proposito: solo
    // aplica al consumo, porque una recarga y un ajuste no llevan mensaje.
    await queryInterface.addIndex("AiCreditLedger", ["companyId", "messageId"], {
      name: "ai_credit_ledger_consumo_unico",
      unique: true,
      where: { type: "consumption" }
    } as any);

    // La tabla de precios, editable desde el panel.
    await queryInterface.createTable("AiModelPricing", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: false
      },
      model: {
        type: DataTypes.STRING,
        allowNull: false
      },
      /** tokens_input | tokens_output | audio_minute */
      unit: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // Centavos por UNIDAD (un token, o un minuto de audio), al costo real
      // del proveedor y sin margen. Ocho decimales porque un token de los
      // modelos baratos vale una millonesima de centavo.
      pricePerUnitCents: {
        type: DataTypes.DECIMAL(16, 8),
        allowNull: false,
        defaultValue: 0
      },
      // Si esta, manda sobre el margen global.
      marginPercentOverride: {
        type: DataTypes.DECIMAL(6, 2),
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

    await queryInterface.addIndex("AiModelPricing", ["provider", "model", "unit"], {
      name: "ai_model_pricing_unico",
      unique: true
    });

    // Ajustes generales. Una sola fila.
    await queryInterface.createTable("AiCreditSettings", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      // Cifrada con SecretBox, igual que AiAgent.apiKey. Nunca sale del
      // backend: la pantalla solo ve los ultimos 4 caracteres.
      sharedOpenAiApiKey: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      sharedOpenAiApiKeyLast4: {
        type: DataTypes.STRING,
        allowNull: true
      },
      // Porcentaje que se suma al costo real antes de descontarlo.
      defaultMarginPercent: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 20
      },
      // Recarga minima, para que la comision fija de la pasarela no se coma
      // una recarga pequena el dia que se conecte una de verdad.
      minPurchaseCents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1000
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
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiCreditSettings");
    await queryInterface.dropTable("AiModelPricing");
    await queryInterface.dropTable("AiCreditLedger");
    await queryInterface.dropTable("AiCreditAccounts");
  }
};
