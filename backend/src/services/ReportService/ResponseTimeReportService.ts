import sequelize from "../../database";
import { QueryTypes } from "sequelize";

// Tempo de resposta por atendente.
//
// O dashboard já trazia duas medidas de tempo, mas nenhuma responde
// "quanto o cliente esperou para ser respondido":
//
//   supportTime  closedAt − startedAt   quanto durou o atendimento
//   waitTime     startedAt − queuedAt   quanto demorou até ALGUÉM ABRIR
//
// Abrir não é responder: dá para abrir o ticket e só escrever vinte minutos
// depois. Este serviço mede o que o cliente sente — do primeiro recado dele
// até a primeira resposta de gente — e quebra por atendente, que é o que
// falta para acompanhar a equipe (o avgWaitTime do dashboard é da empresa
// inteira).
//
// Mensagens do bot são excluídas. A convenção do projeto é prefixá-las com
// ‎ (LEFT-TO-RIGHT MARK); o próprio código usa isso para reconhecê-las,
// como em facebookMessageListener: `if (/‎/.test(bodyMessage)) return;`.
// Sem esse filtro a saudação automática contaria como resposta e o relatório
// mostraria segundos em vez do tempo real.

export interface ResponseTimeRow {
  userId: number | null;
  userName: string;
  tickets: number;
  answeredTickets: number;
  avgFirstResponseSeconds: number | null;
  medianFirstResponseSeconds: number | null;
  maxFirstResponseSeconds: number | null;
  avgWaitSeconds: number | null;
  avgSupportSeconds: number | null;
}

interface Request {
  companyId: number;
  initialDate: string;
  finalDate: string;
}

interface Response {
  rows: ResponseTimeRow[];
  totals: {
    tickets: number;
    answeredTickets: number;
    avgFirstResponseSeconds: number | null;
    medianFirstResponseSeconds: number | null;
  };
}

const query = `
  with periodo as (
    select
      tt."ticketId",
      tt."userId",
      tt."queuedAt",
      tt."startedAt",
      coalesce(tt."closedAt", tt."finishedAt") as "endedAt"
    from "TicketTraking" tt
    where tt."companyId" = :companyId
      and tt."createdAt" >= :initialDate
      and tt."createdAt" < (date :finalDate + interval '1 day')
  ),
  -- Primeiro recado do cliente em cada ticket.
  primeiro_contato as (
    select m."ticketId", min(m."createdAt") as "at"
    from "Messages" m
    join periodo p on p."ticketId" = m."ticketId"
    where m."fromMe" = false
    group by m."ticketId"
  ),
  -- Primeira resposta humana depois desse recado. O filtro do ‎ tira as
  -- mensagens automáticas; isPrivate tira as notas internas, que o cliente
  -- nunca vê.
  primeira_resposta as (
    select m."ticketId", min(m."createdAt") as "at"
    from "Messages" m
    join primeiro_contato pc on pc."ticketId" = m."ticketId"
    where m."fromMe" = true
      and m."createdAt" > pc."at"
      and coalesce(m."isPrivate", false) = false
      and position(chr(8206) in coalesce(m.body, '')) = 0
    group by m."ticketId"
  ),
  medidas as (
    select
      p."userId",
      p."ticketId",
      case
        when pr."at" is not null and pc."at" is not null
        then extract(epoch from (pr."at" - pc."at"))
      end as "firstResponse",
      case
        when p."startedAt" is not null and p."queuedAt" is not null
        then extract(epoch from (p."startedAt" - p."queuedAt"))
      end as "wait",
      case
        when p."endedAt" is not null and p."startedAt" is not null
        then extract(epoch from (p."endedAt" - p."startedAt"))
      end as "support"
    from periodo p
      left join primeiro_contato pc on pc."ticketId" = p."ticketId"
      left join primeira_resposta pr on pr."ticketId" = p."ticketId"
  )
  select
    u.id as "userId",
    coalesce(u.name, 'Sem atendente') as "userName",
    count(m."ticketId")::int as "tickets",
    count(m."firstResponse")::int as "answeredTickets",
    round(avg(m."firstResponse"))::int as "avgFirstResponseSeconds",
    round(
      percentile_cont(0.5) within group (order by m."firstResponse")
    )::int as "medianFirstResponseSeconds",
    round(max(m."firstResponse"))::int as "maxFirstResponseSeconds",
    round(avg(m."wait"))::int as "avgWaitSeconds",
    round(avg(m."support"))::int as "avgSupportSeconds"
  from medidas m
    left join "Users" u on u.id = m."userId"
  group by u.id, u.name
  order by "avgFirstResponseSeconds" desc nulls last, "userName"
`;

const ResponseTimeReportService = async ({
  companyId,
  initialDate,
  finalDate
}: Request): Promise<Response> => {
  const rows: ResponseTimeRow[] = await sequelize.query(query, {
    replacements: { companyId, initialDate, finalDate },
    type: QueryTypes.SELECT
  });

  const tickets = rows.reduce((sum, r) => sum + r.tickets, 0);
  const answeredTickets = rows.reduce((sum, r) => sum + r.answeredTickets, 0);

  // A média geral é ponderada pelo número de tickets respondidos: tirar a
  // média das médias daria o mesmo peso a quem atendeu 2 e a quem atendeu 200.
  const weighted = rows.reduce(
    (sum, r) =>
      r.avgFirstResponseSeconds === null
        ? sum
        : sum + r.avgFirstResponseSeconds * r.answeredTickets,
    0
  );

  const medians = rows
    .map(r => r.medianFirstResponseSeconds)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  const medianOfMedians =
    medians.length === 0
      ? null
      : medians.length % 2 === 1
      ? medians[(medians.length - 1) / 2]
      : Math.round(
          (medians[medians.length / 2 - 1] + medians[medians.length / 2]) / 2
        );

  return {
    rows,
    totals: {
      tickets,
      answeredTickets,
      avgFirstResponseSeconds:
        answeredTickets === 0 ? null : Math.round(weighted / answeredTickets),
      medianFirstResponseSeconds: medianOfMedians
    }
  };
};

export default ResponseTimeReportService;
