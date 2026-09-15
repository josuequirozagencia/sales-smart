import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  HasMany
} from "sequelize-typescript";
import AiAgentChannel from "./AiAgentChannel";

export type ProveedorIa = "openai" | "gemini" | "openrouter";

export interface HorarioDia {
  /** 0 = domingo ... 6 = sabado */
  day: number;
  enabled: boolean;
  /** "HH:MM" en la zona horaria del negocio */
  start: string;
  end: string;
}

export interface HorarioAgente {
  mode: "24/7" | "custom";
  days?: HorarioDia[];
}

export interface PasoSeguimiento {
  when: { amount: number; unit: "minutes" | "hours" | "days" };
  mode: "ia" | "manual";
  content: string;
}

/**
 * Agente IA reutilizable de una empresa. Ver la migracion 20260916120000 y
 * AiAgentService. apiKey y voiceKey van cifradas y nunca salen por la API.
 */
@Table({ tableName: "AiAgents" })
class AiAgent extends Model<AiAgent> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  companyId: number;

  @Column
  name: string;

  @Column
  provider: ProveedorIa;

  @Column
  model: string;

  /** Cifrada con SecretBox. */
  @Column(DataType.TEXT)
  apiKey: string;

  @Column
  apiKeyLast4: string;

  @Column(DataType.TEXT)
  systemPrompt: string;

  @Column(DataType.FLOAT)
  temperature: number;

  @Column
  maxTokens: number;

  @Column
  maxCharacters: number;

  @Column
  maxMessages: number;

  @Column
  voice: string;

  /** Cifrada con SecretBox. */
  @Column(DataType.TEXT)
  voiceKey: string;

  @Column
  voiceKeyLast4: string;

  @Column
  voiceRegion: string;

  @Column
  escuchaAudio: boolean;

  @Column
  leeImagenes: boolean;

  @Column
  dividirRespuestas: boolean;

  @Column
  cantidadBloques: number;

  @Column(DataType.TEXT)
  knowledgeText: string;

  @Column
  knowledgeFileName: string;

  @Column(DataType.JSONB)
  schedule: HorarioAgente;

  @Column(DataType.JSONB)
  followUps: PasoSeguimiento[];

  @Column
  transferQueueId: number;

  @Column
  disponibleEnFlujos: boolean;

  @Column
  isActive: boolean;

  @HasMany(() => AiAgentChannel)
  channels: AiAgentChannel[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgent;
