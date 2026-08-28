import { error } from "@sveltejs/kit";
import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import type { SenderType, TicketMessageInput, TicketMessageRecord } from "$lib/server/tickets";
import { addTicketMessage } from "$lib/server/tickets";

export type TicketStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketSource = "MANUAL" | "TELEGRAM";

export interface TicketFilter {
  status?: TicketStatus;
  agentId?: string;
  categoryId?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  categoryId: string;
  priority: TicketPriority;
  userId?: string;
  source?: TicketSource;
}

export interface TicketMessageResult {
  message: TicketMessageRecord;
  firstResponseAt: string | null;
}

type TicketSummaryRow = {
  id: string;
  code: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  source: TicketSource;
  createdAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  slaFirstResponseDueAt: string | null;
  slaResolutionDueAt: string | null;
  slaFirstResponseBreached: number | boolean;
  slaResolutionBreached: number | boolean;
  rating: number | null;
  ratingComment: string | null;
  categoryId: string;
  userId: string;
  agentId: string | null;
  categoryName: string;
  userName: string;
  userDepartment: string | null;
  agentName: string | null;
  agentEmail: string | null;
};

type TicketEventRow = {
  id: string;
  ticketId: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorType: string;
  actorId: string | null;
  note: string | null;
  createdAt: string;
};

type TicketMessageRow = TicketMessageRecord;

type TicketBaseRow = Pick<TicketSummaryRow, "id" | "status" | "firstResponseAt" | "agentId" | "userId" | "categoryId">;

const validTransitions: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED", "ASSIGNED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: []
};

function asBoolean(value: number | boolean): boolean {
  return value === true || value === 1;
}

function mapTicket(row: TicketSummaryRow) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    source: row.source,
    createdAt: row.createdAt,
    firstResponseAt: row.firstResponseAt,
    resolvedAt: row.resolvedAt,
    closedAt: row.closedAt,
    slaFirstResponseDueAt: row.slaFirstResponseDueAt,
    slaResolutionDueAt: row.slaResolutionDueAt,
    slaFirstResponseBreached: asBoolean(row.slaFirstResponseBreached),
    slaResolutionBreached: asBoolean(row.slaResolutionBreached),
    rating: row.rating,
    ratingComment: row.ratingComment,
    category: { id: row.categoryId, name: row.categoryName },
    user: { id: row.userId, name: row.userName, department: row.userDepartment },
    agent: row.agentId
      ? { id: row.agentId, name: row.agentName, email: row.agentEmail }
      : null
  };
}

async function getTicketBase(database: D1Database, ticketId: string): Promise<TicketBaseRow> {
  const ticket = await database
    .prepare(
      "SELECT id, status, firstResponseAt, agentId, userId, categoryId FROM Ticket WHERE id = ? LIMIT 1"
    )
    .bind(ticketId)
    .first<TicketBaseRow>();
  if (!ticket) throw error(404, "Ticket tidak ditemukan");
  return ticket;
}

export async function getTicket(database: D1Database, ticketId: string) {
  const row = await database
    .prepare(
      `SELECT t.*, c.name AS categoryName, u.name AS userName, u.department AS userDepartment,
              a.name AS agentName, a.email AS agentEmail
       FROM Ticket t
       JOIN Category c ON c.id = t.categoryId
       JOIN User u ON u.id = t.userId
       LEFT JOIN Agent a ON a.id = t.agentId
       WHERE t.id = ? LIMIT 1`
    )
    .bind(ticketId)
    .first<TicketSummaryRow>();
  if (!row) throw error(404, "Ticket tidak ditemukan");

  const [events, messages] = await Promise.all([
    database
      .prepare("SELECT * FROM TicketEvent WHERE ticketId = ? ORDER BY createdAt ASC")
      .bind(ticketId)
      .all<TicketEventRow>(),
    database
      .prepare("SELECT * FROM TicketMessage WHERE ticketId = ? ORDER BY createdAt ASC")
      .bind(ticketId)
      .all<TicketMessageRow>()
  ]);

  return {
    ...mapTicket(row),
    events: events.results,
    messages: messages.results
  };
}

export async function listTickets(database: D1Database, filter: TicketFilter) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filter.status) {
    clauses.push("t.status = ?");
    values.push(filter.status);
  }
  if (filter.agentId) {
    clauses.push("t.agentId = ?");
    values.push(filter.agentId);
  }
  if (filter.categoryId) {
    clauses.push("t.categoryId = ?");
    values.push(filter.categoryId);
  }
  if (filter.search) {
    clauses.push("(t.title LIKE ? OR t.description LIKE ? OR t.code LIKE ?)");
    const search = `%${filter.search}%`;
    values.push(search, search, search);
  }
  if (filter.from) {
    clauses.push("t.createdAt >= ?");
    values.push(filter.from);
  }
  if (filter.to) {
    clauses.push("t.createdAt <= ?");
    values.push(filter.to);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const statement = database.prepare(
    `SELECT t.*, c.name AS categoryName, u.name AS userName, u.department AS userDepartment,
            a.name AS agentName, a.email AS agentEmail
     FROM Ticket t
     JOIN Category c ON c.id = t.categoryId
     JOIN User u ON u.id = t.userId
     LEFT JOIN Agent a ON a.id = t.agentId
     ${where}
     ORDER BY t.createdAt DESC`
  );
  const result = await statement.bind(...values).all<TicketSummaryRow>();
  return result.results.map(mapTicket);
}

async function nextTicketCode(database: D1Database): Promise<string> {
  const last = await database
    .prepare("SELECT code FROM Ticket ORDER BY code DESC LIMIT 1")
    .first<{ code: string }>();
  const nextNumber = last ? Number.parseInt(last.code.replace("TKT-", ""), 10) + 1 : 1;
  return `TKT-${nextNumber.toString().padStart(4, "0")}`;
}

async function pickLeastLoadedAgent(database: D1Database) {
  return database
    .prepare(
      `SELECT a.id, a.name
       FROM Agent a
       LEFT JOIN Ticket t ON t.agentId = a.id AND t.status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS')
       WHERE a.active = 1
       GROUP BY a.id, a.name, a.createdAt
       ORDER BY COUNT(t.id) ASC, a.createdAt ASC
       LIMIT 1`
    )
    .first<{ id: string; name: string }>();
}

export async function createTicket(database: D1Database, input: CreateTicketInput) {
  const category = await database
    .prepare("SELECT id FROM Category WHERE id = ? LIMIT 1")
    .bind(input.categoryId)
    .first<{ id: string }>();
  if (!category) throw error(400, "Category tidak ditemukan");

  let userId = input.userId;
  if (userId) {
    const user = await database.prepare("SELECT id FROM User WHERE id = ? LIMIT 1").bind(userId).first<{ id: string }>();
    if (!user) throw error(400, "User tidak ditemukan");
  } else {
    const fallback = await database.prepare("SELECT id FROM User ORDER BY createdAt ASC LIMIT 1").first<{ id: string }>();
    if (!fallback) throw error(400, "Belum ada user pemohon di sistem");
    userId = fallback.id;
  }

  const rule = await database
    .prepare("SELECT firstResponseMinutes, resolutionMinutes FROM SlaRule WHERE priority = ? LIMIT 1")
    .bind(input.priority)
    .first<{ firstResponseMinutes: number; resolutionMinutes: number }>();
  const now = new Date();
  const createdAt = now.toISOString();
  const firstResponseDueAt = rule
    ? new Date(now.getTime() + rule.firstResponseMinutes * 60_000).toISOString()
    : null;
  const resolutionDueAt = rule
    ? new Date(now.getTime() + rule.resolutionMinutes * 60_000).toISOString()
    : null;
  const id = crypto.randomUUID();
  const code = await nextTicketCode(database);
  const statements: D1PreparedStatement[] = [
    database
      .prepare(
        `INSERT INTO Ticket (id, code, title, description, priority, status, source, createdAt,
         slaFirstResponseDueAt, slaResolutionDueAt, categoryId, userId)
         VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        code,
        input.title,
        input.description,
        input.priority,
        input.source ?? "MANUAL",
        createdAt,
        firstResponseDueAt,
        resolutionDueAt,
        input.categoryId,
        userId
      ),
    database
      .prepare(
        `INSERT INTO TicketEvent (id, ticketId, type, toStatus, actorType, note, createdAt)
         VALUES (?, ?, 'CREATED', 'OPEN', 'AGENT', ?, ?)`
      )
      .bind(crypto.randomUUID(), id, `Tiket ${code} dibuat`, createdAt)
  ];

  const assigned = await pickLeastLoadedAgent(database);
  if (assigned) {
    statements.push(
      database
        .prepare("UPDATE Ticket SET agentId = ?, status = 'ASSIGNED' WHERE id = ?")
        .bind(assigned.id, id),
      database
        .prepare(
          `INSERT INTO TicketEvent (id, ticketId, type, fromStatus, toStatus, actorType, actorId, note, createdAt)
           VALUES (?, ?, 'ASSIGNED', 'OPEN', 'ASSIGNED', 'SYSTEM', ?, ?, ?)`
        )
        .bind(crypto.randomUUID(), id, assigned.id, `Ditugaskan ke ${assigned.name}`, createdAt)
    );
  }

  await database.batch(statements);
  return getTicket(database, id);
}

export async function assignTicket(database: D1Database, ticketId: string, agentId: string | undefined, actorId: string) {
  const ticket = await getTicketBase(database, ticketId);
  if (!["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(ticket.status)) {
    throw error(400, `Tiket berstatus ${ticket.status} tidak dapat di-assign`);
  }

  const target = agentId
    ? await database.prepare("SELECT id, name FROM Agent WHERE id = ? AND active = 1 LIMIT 1").bind(agentId).first<{ id: string; name: string }>()
    : await pickLeastLoadedAgent(database);
  if (!target) throw error(400, "Agent tidak ditemukan atau tidak aktif");

  const now = new Date().toISOString();
  await database.batch([
    database.prepare("UPDATE Ticket SET agentId = ?, status = 'ASSIGNED' WHERE id = ?").bind(target.id, ticketId),
    database
      .prepare(
        `INSERT INTO TicketEvent (id, ticketId, type, fromStatus, toStatus, actorType, actorId, note, createdAt)
         VALUES (?, ?, 'ASSIGNED', ?, 'ASSIGNED', 'AGENT', ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), ticketId, ticket.status, actorId, `Ditugaskan ke ${target.name}`, now)
  ]);
  return getTicket(database, ticketId);
}

export async function transitionTicket(
  database: D1Database,
  ticketId: string,
  to: TicketStatus,
  note: string | undefined,
  actorId: string
) {
  const ticket = await getTicketBase(database, ticketId);
  if (!validTransitions[ticket.status].includes(to)) {
    throw error(400, `Transisi tidak valid: ${ticket.status} → ${to}`);
  }

  const now = new Date().toISOString();
  const updates = ["status = ?"];
  const values: unknown[] = [to];
  if (to === "RESOLVED") {
    updates.push("resolvedAt = ?");
    values.push(now);
  }
  if (to === "CLOSED") {
    updates.push("closedAt = ?");
    values.push(now);
  }
  if (ticket.status === "RESOLVED" && to === "IN_PROGRESS") {
    updates.push("resolvedAt = NULL");
  }
  values.push(ticketId);

  await database.batch([
    database.prepare(`UPDATE Ticket SET ${updates.join(", ")} WHERE id = ?`).bind(...values),
    database
      .prepare(
        `INSERT INTO TicketEvent (id, ticketId, type, fromStatus, toStatus, actorType, actorId, note, createdAt)
         VALUES (?, ?, 'STATUS_CHANGED', ?, ?, 'AGENT', ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), ticketId, ticket.status, to, actorId, note ?? null, now)
  ]);
  return getTicket(database, ticketId);
}

export async function addMessageForTicket(
  database: D1Database,
  input: TicketMessageInput
): Promise<TicketMessageResult> {
  const message = await addTicketMessage(database, input);
  const ticket = await getTicketBase(database, input.ticketId);
  return { message, firstResponseAt: ticket.firstResponseAt };
}

export async function rateTicket(database: D1Database, ticketId: string, stars: number, comment: string | undefined) {
  const ticket = await getTicketBase(database, ticketId);
  if (!["RESOLVED", "CLOSED"].includes(ticket.status)) {
    throw error(400, `Rating hanya untuk tiket RESOLVED/CLOSED (status saat ini: ${ticket.status})`);
  }
  const now = new Date().toISOString();
  await database.batch([
    database.prepare("UPDATE Ticket SET rating = ?, ratingComment = ? WHERE id = ?").bind(stars, comment ?? null, ticketId),
    database
      .prepare(
        `INSERT INTO TicketEvent (id, ticketId, type, actorType, note, createdAt)
         VALUES (?, ?, 'RATED', 'USER', ?, ?)`
      )
      .bind(crypto.randomUUID(), ticketId, `Rating ${stars}/5${comment ? ` — ${comment}` : ""}`, now)
  ]);
  return getTicket(database, ticketId);
}

export async function markTicketRead(database: D1Database, agentId: string, ticketId: string) {
  await getTicketBase(database, ticketId);
  await database
    .prepare(
      `INSERT INTO TicketRead (agentId, ticketId, lastReadAt) VALUES (?, ?, ?)
       ON CONFLICT(agentId, ticketId) DO UPDATE SET lastReadAt = excluded.lastReadAt`
    )
    .bind(agentId, ticketId, new Date().toISOString())
    .run();
}
