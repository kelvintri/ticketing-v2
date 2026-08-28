import type { D1Database } from "@cloudflare/workers-types";

export type AgentConversation = {
  previousInteractionId: string | null;
};

type ConversationRow = { previousInteractionId: string | null };

export async function loadAgentConversation(database: D1Database, channel: string, externalId: string): Promise<AgentConversation> {
  const row = await database
    .prepare("SELECT previousInteractionId FROM AgentConversation WHERE channel = ? AND externalId = ? LIMIT 1")
    .bind(channel, externalId)
    .first<ConversationRow>();
  return { previousInteractionId: row?.previousInteractionId ?? null };
}

export async function saveAgentConversation(
  database: D1Database,
  channel: string,
  externalId: string,
  previousInteractionId: string
) {
  await database
    .prepare(
      `INSERT INTO AgentConversation (channel, externalId, previousInteractionId, updatedAt)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(channel, externalId) DO UPDATE SET previousInteractionId = excluded.previousInteractionId, updatedAt = excluded.updatedAt`
    )
    .bind(channel, externalId, previousInteractionId, new Date().toISOString())
    .run();
}

export async function resetAgentConversation(database: D1Database, channel: string, externalId: string) {
  await database.prepare("DELETE FROM AgentConversation WHERE channel = ? AND externalId = ?").bind(channel, externalId).run();
}

export async function claimTelegramUpdate(database: D1Database, updateId: number): Promise<boolean> {
  const result = await database
    .prepare("INSERT OR IGNORE INTO TelegramUpdate (updateId, receivedAt) VALUES (?, ?)")
    .bind(updateId, new Date().toISOString())
    .run();
  return result.meta.changes === 1;
}

export async function completeTelegramUpdate(database: D1Database, updateId: number) {
  await database
    .prepare("UPDATE TelegramUpdate SET processedAt = ? WHERE updateId = ?")
    .bind(new Date().toISOString(), updateId)
    .run();
  await database.prepare("DELETE FROM TelegramUpdate WHERE receivedAt < datetime('now', '-7 days')").run();
}

export async function releaseTelegramUpdate(database: D1Database, updateId: number) {
  await database.prepare("DELETE FROM TelegramUpdate WHERE updateId = ? AND processedAt IS NULL").bind(updateId).run();
}

export async function recordAgentLog(
  database: D1Database,
  details: {
    provider: "gemini" | "openrouter";
    model: string;
    chatId: string;
    latencyMs: number;
    tokensIn: number | null;
    tokensOut: number | null;
    toolsCalled: string[];
    outcome: "success" | "fallback";
    error?: string;
  }
) {
  await database
    .prepare(
      `INSERT INTO AgentLog (id, provider, model, chatId, latencyMs, tokensIn, tokensOut, toolsCalled, outcome, error, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      details.provider,
      details.model,
      details.chatId,
      details.latencyMs,
      details.tokensIn,
      details.tokensOut,
      JSON.stringify(details.toolsCalled),
      details.outcome,
      details.error ?? null,
      new Date().toISOString()
    )
    .run();
}
