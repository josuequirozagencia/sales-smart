import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  BelongsToMany,
  ForeignKey,
  BelongsTo,
  HasMany
} from "sequelize-typescript";
import Company from "./Company";
import Ticket from "./Ticket";
import TicketTag from "./TicketTag";
import Contact from "./Contact";
import ContactTag from "./ContactTag";
import KanbanPipeline from "./KanbanPipeline";

@Table
class Tag extends Model<Tag> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column
  color: string;

  @Column
  kanban: number;

  @HasMany(() => TicketTag)
  ticketTags: TicketTag[];

  @BelongsToMany(() => Ticket, () => TicketTag)
  tickets: Ticket[];

  @BelongsToMany(() => Contact, () => ContactTag)
  contacts: Array<Contact & { ContactTag: ContactTag }>;

  @HasMany(() => ContactTag)
  contactTags: ContactTag[];

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  // Embudo del Kanban al que pertenece esta etapa. Nulo en las etiquetas
  // normales (kanban = 0), que no son columnas de ningun tablero.
  @ForeignKey(() => KanbanPipeline)
  @Column
  pipelineId: number;

  @BelongsTo(() => KanbanPipeline)
  pipeline: KanbanPipeline;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @Column
  timeLane: number;

	@Column
  nextLaneId: number;
	
  @Column
  greetingMessageLane: string;

  @Column
  rollbackLaneId: number;
}

export default Tag;
