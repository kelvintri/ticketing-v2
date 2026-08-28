import type { D1Database } from "@cloudflare/workers-types";

export interface AgentNotification {
  ticketId: string;
  code: string;
  title: string;
  status: string;
  requester: string;
  unreadCount: number;
  lastMessageBody: string;
  lastMessageAt: string;
}

type NotificationRow = {
  ticketId: string;
  code: string;
  title: string;
  status: string;
  requester: string;
  messageBody: string;
  messageAt: string;
};

export async function getAgentNotifications(database: D1Database, agentId: string) {
  const result = await database
    .prepare(
      `SELECT t.id AS ticketId, t.code, t.title, t.status, u.name AS requester,
              m.body AS messageBody, m.createdAt AS messageAt
       FROM Ticket t
       JOIN User u ON u.id = t.userId
       JOIN TicketMessage m ON m.ticketId = t.id AND m.senderType = 'USER'
       LEFT JOIN TicketRead r ON r.ticketId = t.id AND r.agentId = ?
       WHERE t.agentId = ? AND t.status <> 'CLOSED'
         AND m.createdAt > COALESCE(r.lastReadAt, '1970-01-01T00:00:00.000Z')
       ORDER BY m.createdAt DESC`
    )
    .bind(agentId, agentId)
    .all<NotificationRow>();

  const grouped = new Map<string, AgentNotification>();
  for (const row of result.results) {
    const current = grouped.get(row.ticketId);
    if (current) {
      current.unreadCount += 1;
      continue;
    }
    grouped.set(row.ticketId, {
      ticketId: row.ticketId,
      code: row.code,
      title: row.title,
      status: row.status,
      requester: row.requester,
      unreadCount: 1,
      lastMessageBody: row.messageBody,
      lastMessageAt: row.messageAt
    });
  }
  return Array.from(grouped.values()).slice(0, 20);
}
