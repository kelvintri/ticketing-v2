import { error } from "@sveltejs/kit";
import type { D1Database } from "@cloudflare/workers-types";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

type ReportRow = {
  code: string;
  title: string;
  categoryName: string;
  priority: string;
  status: string;
  userName: string;
  agentName: string | null;
  createdAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  slaFirstResponseBreached: number | boolean;
  slaResolutionBreached: number | boolean;
  rating: number | null;
  ratingComment: string | null;
};

export async function monthlyCsv(database: D1Database, month: string): Promise<string> {
  if (!/^\d{4}-\d{2}$/.test(month)) throw error(400, "Parameter month harus berformat YYYY-MM");
  const [yearText, monthText] = month.split("-");
  const monthNumber = Number(monthText);
  if (monthNumber < 1 || monthNumber > 12) throw error(400, "Bulan tidak valid");

  const start = `${yearText}-${monthText}-01T00:00:00.000Z`;
  const endDate = new Date(Date.UTC(Number(yearText), monthNumber, 1));
  const end = endDate.toISOString();
  const result = await database
    .prepare(
      `SELECT t.code, t.title, c.name AS categoryName, t.priority, t.status,
              u.name AS userName, a.name AS agentName, t.createdAt, t.firstResponseAt,
              t.resolvedAt, t.slaFirstResponseBreached, t.slaResolutionBreached,
              t.rating, t.ratingComment
       FROM Ticket t
       JOIN Category c ON c.id = t.categoryId
       JOIN User u ON u.id = t.userId
       LEFT JOIN Agent a ON a.id = t.agentId
       WHERE t.createdAt >= ? AND t.createdAt < ?
       ORDER BY t.createdAt ASC`
    )
    .bind(start, end)
    .all<ReportRow>();

  const header = [
    "code", "title", "category", "priority", "status", "requester", "agent", "createdAt",
    "firstResponseAt", "resolvedAt", "slaFirstResponseBreached", "slaResolutionBreached", "rating", "ratingComment"
  ];
  const rows = result.results.map((ticket) => [
    ticket.code,
    ticket.title,
    ticket.categoryName,
    ticket.priority,
    ticket.status,
    ticket.userName,
    ticket.agentName ?? "",
    ticket.createdAt,
    ticket.firstResponseAt ?? "",
    ticket.resolvedAt ?? "",
    ticket.slaFirstResponseBreached === true || ticket.slaFirstResponseBreached === 1 ? "YES" : "NO",
    ticket.slaResolutionBreached === true || ticket.slaResolutionBreached === 1 ? "YES" : "NO",
    ticket.rating ?? "",
    ticket.ratingComment ?? ""
  ]);

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
