import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { login, readTokenAuth } from "$lib/server/auth";
import { addTicketMessage } from "$lib/server/tickets";
import { transitionTicket } from "$lib/server/ticket-service";

function platform(database: D1Database, jwtSecret = "test-jwt-secret") {
  return {
    env: { DB: database, JWT_SECRET: jwtSecret, JWT_EXPIRES_IN: "1h" }
  } as unknown as App.Platform;
}

function requestEvent(database: D1Database, request: Request) {
  return { request, platform: platform(database) } as Parameters<typeof login>[0];
}

describe("authentication", () => {
  it("issues a token that can be read back as the authenticated agent", async () => {
    const password = "test-password";
    const database = {
      prepare() {
        return {
          bind() {
            return {
              async first() {
                return {
                  id: "agent-1",
                  email: "AGENT@EXAMPLE.COM",
                  name: "Test Agent",
                  passwordHash: await bcrypt.hash(password, 4),
                  role: "AGENT",
                  active: 1,
                  createdAt: "2026-01-01T00:00:00.000Z"
                };
              }
            };
          }
        };
      }
    } as unknown as D1Database;

    const result = await login(
      requestEvent(database, new Request("https://example.test/api/auth/login")),
      "agent@example.com",
      password
    );
    const auth = await readTokenAuth(
      new Request("https://example.test/api/auth/me", {
        headers: { authorization: `Bearer ${result.token}` }
      }),
      platform(database)
    );

    expect(result.agent).toMatchObject({ id: "agent-1", email: "AGENT@EXAMPLE.COM", role: "AGENT" });
    expect(auth).toEqual({ agentId: "agent-1", email: "AGENT@EXAMPLE.COM", name: "Test Agent", role: "AGENT" });
  });

  it("rejects an invalid password and malformed bearer token", async () => {
    const hash = await bcrypt.hash("correct-password", 4);
    const database = {
      prepare() {
        return {
          bind() {
            return { async first() { return { id: "agent-1", email: "agent@example.com", name: "Agent", passwordHash: hash, role: "AGENT", active: 1, createdAt: "2026-01-01T00:00:00.000Z" }; } };
          }
        };
      }
    } as unknown as D1Database;

    await expect(login(requestEvent(database, new Request("https://example.test")), "agent@example.com", "wrong-password"))
      .rejects.toMatchObject({ status: 401 });
    await expect(readTokenAuth(new Request("https://example.test"), platform(database)))
      .rejects.toMatchObject({ status: 401 });
  });
});

type FakeTicket = {
  id: string;
  code: string;
  title: string;
  description: string;
  priority: "LOW";
  status: "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  source: "MANUAL";
  createdAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  slaFirstResponseDueAt: string | null;
  slaResolutionDueAt: string | null;
  slaFirstResponseBreached: number;
  slaResolutionBreached: number;
  rating: null;
  ratingComment: null;
  categoryId: string;
  userId: string;
  agentId: string;
  categoryName: string;
  userName: string;
  userDepartment: null;
  agentName: string;
  agentEmail: string;
};

function ticketDatabase() {
  const ticket: FakeTicket = {
    id: "ticket-1", code: "TKT-TEST", title: "Lifecycle test", description: "Test", priority: "LOW",
    status: "ASSIGNED", source: "MANUAL", createdAt: "2026-01-01T00:00:00.000Z", firstResponseAt: null,
    resolvedAt: null, closedAt: null, slaFirstResponseDueAt: null, slaResolutionDueAt: null,
    slaFirstResponseBreached: 0, slaResolutionBreached: 0, rating: null, ratingComment: null,
    categoryId: "category-1", userId: "user-1", agentId: "agent-1", categoryName: "Account & Access",
    userName: "Requester", userDepartment: null, agentName: "Agent", agentEmail: "agent@example.com"
  };
  const events: Record<string, unknown>[] = [];
  const messages: Record<string, unknown>[] = [];

  function statement(sql: string, values: unknown[] = []) {
    return {
      __sql: sql,
      __values: values,
      bind(...nextValues: unknown[]) { return statement(sql, nextValues); },
      async first() {
        if (sql.includes("SELECT id, status, firstResponseAt, agentId, userId, categoryId")) {
          return { id: ticket.id, status: ticket.status, firstResponseAt: ticket.firstResponseAt, agentId: ticket.agentId, userId: ticket.userId, categoryId: ticket.categoryId };
        }
        if (sql.includes("SELECT status, firstResponseAt FROM Ticket")) return { status: ticket.status, firstResponseAt: ticket.firstResponseAt };
        if (sql.includes("SELECT t.*, c.name AS categoryName")) return ticket;
        return null;
      },
      async all() {
        if (sql.includes("FROM TicketEvent")) return { results: events };
        if (sql.includes("FROM TicketMessage")) return { results: messages };
        return { results: [] };
      }
    };
  }

  const database = {
    prepare(sql: string) { return statement(sql); },
    async batch(statements: Array<{ __sql?: string; __values?: unknown[] }>) {
      for (const current of statements) {
        const sql = current.__sql ?? "";
        const values = current.__values ?? [];
        if (sql.startsWith("UPDATE Ticket SET") && sql.includes("firstResponseAt = ?")) {
          ticket.firstResponseAt = values[0] as string;
        } else if (sql.startsWith("UPDATE Ticket SET")) {
          ticket.status = values[0] as FakeTicket["status"];
          if (sql.includes("resolvedAt = ?")) ticket.resolvedAt = values[1] as string;
          if (sql.includes("closedAt = ?")) ticket.closedAt = values[sql.includes("resolvedAt = ?") ? 2 : 1] as string;
          if (sql.includes("resolvedAt = NULL")) ticket.resolvedAt = null;
        } else if (sql.startsWith("INSERT INTO TicketEvent")) {
          events.push({ id: values[0], ticketId: values[1], type: values[2], fromStatus: values[3] ?? null, toStatus: values[4] ?? null, actorType: values[5] === "agent-1" ? "AGENT" : "SYSTEM", actorId: values[5], note: values[6] ?? null, createdAt: values[7] });
        } else if (sql.startsWith("INSERT INTO TicketMessage")) {
          messages.push({ id: values[0], ticketId: values[1], senderType: values[2], senderId: values[3], body: values[4], createdAt: values[5] });
        }
      }
      return { results: [] };
    }
  } as unknown as D1Database;

  return { database, ticket, events, messages };
}

describe("ticket lifecycle", () => {
  it("records an agent response and completes valid status transitions", async () => {
    const { database, ticket, events, messages } = ticketDatabase();
    const inProgress = await transitionTicket(database, ticket.id, "IN_PROGRESS", "Started", "agent-1");
    const message = await addTicketMessage(database, { ticketId: ticket.id, senderType: "AGENT", senderId: "agent-1", body: "We are working on this." });
    const resolved = await transitionTicket(database, ticket.id, "RESOLVED", "Fixed", "agent-1");
    const closed = await transitionTicket(database, ticket.id, "CLOSED", "Confirmed", "agent-1");

    expect(inProgress.status).toBe("IN_PROGRESS");
    expect(message.senderType).toBe("AGENT");
    expect(ticket.firstResponseAt).not.toBeNull();
    expect(resolved.resolvedAt).not.toBeNull();
    expect(closed.closedAt).not.toBeNull();
    expect(ticket.status).toBe("CLOSED");
    expect(events).toHaveLength(3);
    expect(messages).toHaveLength(1);
  });

  it("rejects an invalid transition", async () => {
    const { database, ticket } = ticketDatabase();
    await expect(transitionTicket(database, ticket.id, "CLOSED", undefined, "agent-1"))
      .rejects.toMatchObject({ status: 400 });
  });
});
