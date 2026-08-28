import type { D1Database } from "@cloudflare/workers-types";

export interface KpiRange {
  from?: string;
  to?: string;
}

type KpiTicket = {
  status: string;
  createdAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  slaResolutionDueAt: string | null;
  rating: number | null;
  categoryId: string;
  agentId: string | null;
};

type NamedRow = { id: string; name: string };

export async function getOverview(database: D1Database, range: KpiRange = {}) {
  const clauses: string[] = [];
  const values: string[] = [];
  if (range.from) {
    clauses.push("createdAt >= ?");
    values.push(range.from);
  }
  if (range.to) {
    clauses.push("createdAt <= ?");
    values.push(range.to);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const tickets = await database
    .prepare(
      `SELECT status, createdAt, firstResponseAt, resolvedAt, slaResolutionDueAt,
              rating, categoryId, agentId FROM Ticket ${where}`
    )
    .bind(...values)
    .all<KpiTicket>();
  const rows = tickets.results;
  const totalTickets = rows.length;
  const openTickets = rows.filter((ticket) => ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(ticket.status)).length;
  const withFirstResponse = rows.filter((ticket) => ticket.firstResponseAt);
  const resolved = rows.filter((ticket) => ticket.resolvedAt);
  const rated = rows.filter((ticket) => ticket.rating !== null);
  const round = (value: number) => Math.round(value * 10) / 10;
  const minutesBetween = (later: string, earlier: string) =>
    (Date.parse(later) - Date.parse(earlier)) / 60_000;

  const avgFirstResponseMinutes = withFirstResponse.length
    ? round(
        withFirstResponse.reduce(
          (sum, ticket) => sum + minutesBetween(ticket.firstResponseAt as string, ticket.createdAt),
          0
        ) / withFirstResponse.length
      )
    : null;
  const avgResolutionMinutes = resolved.length
    ? round(
        resolved.reduce(
          (sum, ticket) => sum + minutesBetween(ticket.resolvedAt as string, ticket.createdAt),
          0
        ) / resolved.length
      )
    : null;
  const resolvedOnTime = resolved.filter(
    (ticket) => ticket.slaResolutionDueAt && Date.parse(ticket.resolvedAt as string) <= Date.parse(ticket.slaResolutionDueAt)
  ).length;
  const slaCompliancePercent = resolved.length ? round((resolvedOnTime / resolved.length) * 100) : null;
  const avgRating = rated.length
    ? round(rated.reduce((sum, ticket) => sum + (ticket.rating as number), 0) / rated.length)
    : null;

  const categories = await database.prepare("SELECT id, name FROM Category ORDER BY name ASC").all<NamedRow>();
  const byCategory = categories.results
    .map((category) => ({ name: category.name, count: rows.filter((ticket) => ticket.categoryId === category.id).length }))
    .filter((category) => category.count > 0)
    .sort((a, b) => b.count - a.count);
  const statuses = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  const byStatus = statuses.map((status) => ({ status, count: rows.filter((ticket) => ticket.status === status).length }));

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return { month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, count: 0 };
  });
  const monthIndex = new Map(months.map((month, index) => [month.month, index]));
  for (const ticket of rows) {
    const date = new Date(ticket.createdAt);
    const index = monthIndex.get(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    if (index !== undefined) months[index].count += 1;
  }

  const agents = await database.prepare("SELECT id, name FROM Agent ORDER BY createdAt ASC").all<NamedRow>();
  const perAgent = agents.results.map((agent) => {
    const agentTickets = rows.filter((ticket) => ticket.agentId === agent.id);
    const agentResolved = agentTickets.filter((ticket) => ticket.resolvedAt);
    return {
      agentId: agent.id,
      name: agent.name,
      tickets: agentTickets.length,
      resolved: agentResolved.length,
      avgResolutionMinutes: agentResolved.length
        ? round(
            agentResolved.reduce(
              (sum, ticket) => sum + minutesBetween(ticket.resolvedAt as string, ticket.createdAt),
              0
            ) / agentResolved.length
          )
        : null
    };
  });

  return {
    totalTickets,
    openTickets,
    avgFirstResponseMinutes,
    avgResolutionMinutes,
    slaCompliancePercent,
    avgRating,
    byCategory,
    byStatus,
    monthly: months,
    perAgent
  };
}
