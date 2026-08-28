import { error } from "@sveltejs/kit";
import type { D1Database } from "@cloudflare/workers-types";

export type SenderType = "USER" | "AGENT" | "AI";

type TicketState = {
  status: string;
  firstResponseAt: string | null;
};

export interface TicketMessageInput {
  ticketId: string;
  senderType: SenderType;
  body: string;
  senderId?: string;
}

export interface TicketMessageRecord {
  id: string;
  ticketId: string;
  senderType: SenderType;
  senderId: string | null;
  body: string;
  createdAt: string;
}

export async function addTicketMessage(
  database: D1Database,
  input: TicketMessageInput
): Promise<TicketMessageRecord> {
  const ticket = await database
    .prepare("SELECT status, firstResponseAt FROM Ticket WHERE id = ? LIMIT 1")
    .bind(input.ticketId)
    .first<TicketState>();

  if (!ticket) throw error(404, "Ticket tidak ditemukan");
  if (ticket.status === "CLOSED") {
    throw error(400, "Tiket sudah ditutup, tidak dapat menambah pesan");
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const statements = [
    database
      .prepare(
        "INSERT INTO TicketMessage (id, ticketId, senderType, senderId, body, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(id, input.ticketId, input.senderType, input.senderId ?? null, input.body, createdAt)
  ];

  const countsAsFirstResponse =
    input.senderType === "AGENT" &&
    ticket.firstResponseAt === null &&
    ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(ticket.status);

  if (countsAsFirstResponse) {
    statements.push(
      database
        .prepare(
          "UPDATE Ticket SET firstResponseAt = ? WHERE id = ? AND firstResponseAt IS NULL AND status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS')"
        )
        .bind(createdAt, input.ticketId)
    );
  }

  await database.batch(statements);
  return {
    id,
    ticketId: input.ticketId,
    senderType: input.senderType,
    senderId: input.senderId ?? null,
    body: input.body,
    createdAt
  };
}
