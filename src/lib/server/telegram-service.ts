import type { D1Database } from "@cloudflare/workers-types";
import { addMessageForTicket, createTicket } from "$lib/server/ticket-service";
import { GeminiClient, GeminiError, runGeminiAgent } from "$lib/server/gemini-service";
import { buildAgentSystemInstruction, ensureTicketOffer } from "$lib/server/agent-policy";
import { OpenRouterClient } from "$lib/server/openrouter-service";
import type { PreparedTicketDraft } from "$lib/server/agent-tools";
import {
  claimTelegramUpdate,
  completeTelegramUpdate,
  loadAgentConversation,
  recordAgentLog,
  releaseTelegramUpdate,
  saveAgentConversation
} from "$lib/server/agent-state";

type FlowStep = "kategori" | "prioritas" | "deskripsi" | "konfirmasi";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type IntakeDraft = {
  categoryId?: string;
  categoryName?: string;
  priority?: Priority;
  description?: string;
  title?: string;
};

type TelegramSession = {
  awaitingJoinCode?: boolean;
  step?: FlowStep;
  draft?: IntakeDraft;
  replyTicketId?: string;
  aiIntake?: { context: string };
  aiDraft?: PreparedTicketDraft;
};

export type TelegramUpdate = {
  update_id?: number;
  message?: {
    chat: { id: number | string };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number | string } };
  };
};

export type TelegramAiConfig = {
  mode: "off" | "rules" | "agent";
  provider: "gemini" | "openrouter";
  apiKey: string;
  model: string;
  environment: "staging" | "production";
};

type CategoryRow = { id: string; name: string };
type UserRow = { id: string; name: string; telegramChatId: string | null; joinCode: string | null };
type SessionRow = { state: string };
type TicketStatusRow = { code: string; title: string; status: string; categoryName: string };

const priorityLabels: Record<Priority, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
  URGENT: "Urgent"
};
const statusLabels: Record<string, string> = {
  OPEN: "Baru",
  ASSIGNED: "Ditugaskan",
  IN_PROGRESS: "Dikerjakan",
  RESOLVED: "Terselesaikan",
  CLOSED: "Ditutup"
};

async function telegramRequest(token: string, method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Telegram ${method} failed with HTTP ${response.status}`);
  const result = (await response.json()) as { ok: boolean; description?: string };
  if (!result.ok) throw new Error(result.description ?? `Telegram ${method} failed`);
  return result;
}

async function reply(token: string, chatId: string, text: string, replyMarkup?: Record<string, unknown>) {
  const payload: Record<string, unknown> = { chat_id: chatId, text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  await telegramRequest(token, "sendMessage", payload);
}

async function editReply(token: string, chatId: string, messageId: number, text: string, replyMarkup?: Record<string, unknown>) {
  const payload: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  await telegramRequest(token, "editMessageText", payload);
}

async function answerCallback(token: string, callbackId: string, text?: string) {
  const payload: Record<string, unknown> = { callback_query_id: callbackId };
  if (text) payload.text = text;
  await telegramRequest(token, "answerCallbackQuery", payload);
}

async function loadSession(database: D1Database, chatId: string): Promise<TelegramSession> {
  const row = await database.prepare("SELECT state FROM TelegramSession WHERE chatId = ? LIMIT 1").bind(chatId).first<SessionRow>();
  if (!row) return {};
  try { return JSON.parse(row.state) as TelegramSession; }
  catch { return {}; }
}

async function saveSession(database: D1Database, chatId: string, state: TelegramSession) {
  await database
    .prepare(
      `INSERT INTO TelegramSession (chatId, state, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(chatId) DO UPDATE SET state = excluded.state, updatedAt = excluded.updatedAt`
    )
    .bind(chatId, JSON.stringify(state), new Date().toISOString())
    .run();
}

async function clearSession(database: D1Database, chatId: string) {
  await database.prepare("DELETE FROM TelegramSession WHERE chatId = ?").bind(chatId).run();
}

async function linkedUser(database: D1Database, chatId: string) {
  return database.prepare("SELECT id, name, telegramChatId, joinCode FROM User WHERE telegramChatId = ? LIMIT 1").bind(chatId).first<UserRow>();
}

async function categories(database: D1Database) {
  const result = await database.prepare("SELECT id, name FROM Category ORDER BY name ASC").all<CategoryRow>();
  return result.results;
}

function priorityKeyboard() {
  return {
    inline_keyboard: (Object.keys(priorityLabels) as Priority[]).map((priority) => [
      { text: `${priorityLabels[priority]} (${priority})`, callback_data: `pri:${priority}` }
    ])
  };
}

async function categoryKeyboard(database: D1Database) {
  return {
    inline_keyboard: (await categories(database)).map((category) => [
      { text: category.name, callback_data: `cat:${category.id}` }
    ])
  };
}

function confirmKeyboard() {
  return { inline_keyboard: [[{ text: "Kirim", callback_data: "confirm:create" }, { text: "Batal", callback_data: "cancel:intake" }]] };
}

function summaryText(draft: IntakeDraft) {
  return [
    "Ringkasan tiket:",
    `Judul: ${draft.title ?? draft.description?.slice(0, 60) ?? "-"}`,
    `Kategori: ${draft.categoryName ?? "-"}`,
    `Prioritas: ${draft.priority ? `${priorityLabels[draft.priority]} (${draft.priority})` : "-"}`,
    `Deskripsi: ${draft.description ?? "-"}`
  ].join("\n");
}

async function startIntake(database: D1Database, token: string, chatId: string, intro?: string) {
  await saveSession(database, chatId, { step: "kategori", draft: {} });
  const prefix = intro ? `${intro}\n\n` : "";
  await reply(token, chatId, `${prefix}Baik, mari kita buat tiket. Pilih kategori masalah:`, await categoryKeyboard(database));
}

async function handleStart(database: D1Database, token: string, chatId: string) {
  const user = await linkedUser(database, chatId);
  if (user) {
    await clearSession(database, chatId);
    await reply(token, chatId, `Halo, ${user.name}! Selamat datang di bot IT Helpdesk.\n\nKirim keluhan untuk membuat tiket atau gunakan /status untuk melihat tiket aktif.\n\n/help — tampilkan bantuan.`);
    return;
  }
  await saveSession(database, chatId, { awaitingJoinCode: true });
  await reply(token, chatId, "Halo! Saya bot IT Helpdesk.\n\nMasukkan kode undangan dari admin IT (6 karakter, contoh: BUD123):");
}

async function handleStatus(database: D1Database, token: string, chatId: string) {
  const user = await linkedUser(database, chatId);
  if (!user) { await reply(token, chatId, "Akun Anda belum terhubung. Kirim /start terlebih dahulu."); return; }
  const tickets = await database
    .prepare(
      `SELECT t.code, t.title, t.status, c.name AS categoryName
       FROM Ticket t JOIN Category c ON c.id = t.categoryId
       WHERE t.userId = ? AND t.status <> 'CLOSED'

       ORDER BY t.createdAt DESC`
    )
    .bind(user.id)
    .all<TicketStatusRow>();
  if (!tickets.results.length) { await reply(token, chatId, `Anda tidak punya tiket aktif. Kirim pesan keluhan untuk membuat tiket baru.`); return; }
  const lines = [`Tiket aktif Anda (${tickets.results.length}):`, ""];
  for (const ticket of tickets.results) lines.push(`• ${ticket.code} — ${ticket.title}\n  Status: ${statusLabels[ticket.status] ?? ticket.status} · Kategori: ${ticket.categoryName}`);
  await reply(token, chatId, lines.join("\n"));
}
const agentFallback = "Asisten AI tidak tersedia. Saya lanjutkan dengan formulir tiket.";

async function recordAgentEvent(
  database: D1Database,
  details: Parameters<typeof recordAgentLog>[1]
) {
  try {
    await recordAgentLog(database, details);
  } catch {
    console.error(JSON.stringify({ type: "agent_log_error" }));
  }
}

function isPreparedTicketDraft(value: unknown): value is PreparedTicketDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<PreparedTicketDraft>;
  return typeof draft.title === "string"
    && typeof draft.location === "string"
    && typeof draft.problem === "string"
    && typeof draft.categoryId === "string"
    && typeof draft.categoryName === "string"
    && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(draft.priority ?? "");
}

function ticketDraftConfirmation(draft: PreparedTicketDraft): string {
  return [
    "Saya sudah menyiapkan tiket untuk tim IT:",
    `Judul: ${draft.title}`,
    `Lokasi: ${draft.location}`,
    `Masalah: ${draft.problem}`,
    `Kategori: ${draft.categoryName}`,
    `Prioritas: ${draft.priority}`,
    "",
    "Balas \"ya\" untuk mengirim tiket, atau \"batal\" untuk membatalkan."
  ].join("\n");
}

function appendIntakeContext(previous: string | undefined, text: string, answer: string): string {
  return [
    previous,
    `USER: ${text.slice(0, 1_500)}`,
    `ASSISTANT: ${answer.slice(0, 1_500)}`
  ].filter(Boolean).join("\n").slice(-3_500);
}

async function submitAiDraft(database: D1Database, token: string, chatId: string, userId: string, draft: PreparedTicketDraft) {
  const ticket = await createTicket(database, {
    title: draft.title,
    description: `Lokasi: ${draft.location}\n\nMasalah: ${draft.problem}`,
    categoryId: draft.categoryId,
    priority: draft.priority,
    userId,
    source: "TELEGRAM"
  });
  await clearSession(database, chatId);
  await reply(
    token,
    chatId,
    `Tiket berhasil dibuat!\nKode: ${ticket.code}\nJudul: ${ticket.title}\nKategori: ${ticket.category.name} · Prioritas: ${priorityLabels[ticket.priority as Priority]}\nStatus: ${statusLabels[ticket.status] ?? ticket.status}\n\nTim IT akan membantu menindaklanjuti. Pantau lewat /status.`
  );
}
async function handleAgentMessage(
  database: D1Database,
  token: string,
  chatId: string,
  userId: string,
  text: string,
  config: TelegramAiConfig,
  conversationContext?: string
) {
  const startedAt = Date.now();
  if (!config.apiKey) {
    await recordAgentEvent(database, {
      provider: config.provider,
      model: config.model,
      chatId,
      latencyMs: Date.now() - startedAt,
      tokensIn: null,
      tokensOut: null,
      toolsCalled: [],
      outcome: "fallback",
      error: "configuration"
    });
    await startIntake(database, token, chatId, agentFallback);
    return;
  }

  try {
    const conversation = await loadAgentConversation(database, "telegram", chatId);
    const client = config.provider === "openrouter"
      ? new OpenRouterClient({
          apiKey: config.apiKey,
          model: config.model,
          systemInstruction: buildAgentSystemInstruction(config.environment)
        })
      : new GeminiClient({
          apiKey: config.apiKey,
          model: config.model,
          systemInstruction: buildAgentSystemInstruction(config.environment)
        });
    const result = await runGeminiAgent(
      client,
      { database, userId },
      text,
      conversation.previousInteractionId ?? undefined,
      conversationContext
    );
    await saveAgentConversation(database, "telegram", chatId, result.interactionId);
    await recordAgentEvent(database, {
      provider: config.provider,
      model: config.model,
      chatId,
      latencyMs: Date.now() - startedAt,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      toolsCalled: result.toolsCalled,
      outcome: "success"
    });

    const preparedResult = [...result.toolResults]
      .reverse()
      .find((toolResult) => toolResult.name === "prepare_ticket_draft" && isPreparedTicketDraft(toolResult.result));
    if (preparedResult && isPreparedTicketDraft(preparedResult.result)) {
      await saveSession(database, chatId, { aiDraft: preparedResult.result });
      await reply(token, chatId, ticketDraftConfirmation(preparedResult.result));
      return;
    }

    const answer = ensureTicketOffer(result.text);
    await saveSession(database, chatId, {
      aiIntake: { context: appendIntakeContext(conversationContext, text, answer) }
    });
    await reply(token, chatId, answer);
  } catch (cause) {
    const errorKind = cause instanceof GeminiError
      ? `${cause.kind}${cause.status ? `:${cause.status}` : ""}${cause.detail ? `:${cause.detail}` : ""}`
      : cause instanceof Error ? `upstream:${cause.name}` : "unknown";
    await recordAgentEvent(database, {
      provider: config.provider,
      model: config.model,
      chatId,
      latencyMs: Date.now() - startedAt,
      tokensIn: null,
      tokensOut: null,
      toolsCalled: [],
      outcome: "fallback",
      error: errorKind
    });
    await startIntake(database, token, chatId, agentFallback);
  }
}

async function handleMessage(database: D1Database, token: string, chatId: string, text: string, config: TelegramAiConfig) {
  const session = await loadSession(database, chatId);
  if (session.awaitingJoinCode) {
    const match = await database
      .prepare("SELECT id, name, telegramChatId, joinCode FROM User WHERE joinCode IS NOT NULL AND UPPER(joinCode) = ? LIMIT 1")
      .bind(text.toUpperCase())
      .first<UserRow>();
    if (!match) { await reply(token, chatId, "Kode undangan tidak dikenali. Periksa kembali dengan admin IT."); return; }
    await database.prepare("UPDATE User SET telegramChatId = ?, joinCode = NULL WHERE id = ?").bind(chatId, match.id).run();
    await clearSession(database, chatId);
    await reply(token, chatId, `Berhasil! Halo, ${match.name} — akun Anda sudah terhubung.\n\nKirim keluhan IT untuk membuat tiket atau gunakan /status.`);
    return;
  }

  const user = await linkedUser(database, chatId);
  if (!user) { await reply(token, chatId, "Akun Anda belum terhubung. Kirim /start dan masukkan kode undangan terlebih dahulu."); return; }
  if (session.step === "deskripsi") {
    if (/^batal$/i.test(text)) { await clearSession(database, chatId); await reply(token, chatId, "Pembuatan tiket dibatalkan."); return; }
    if (text.length < 10) { await reply(token, chatId, "Deskripsi terlalu pendek. Jelaskan masalah minimal 10 karakter, atau ketik 'batal'."); return; }
    const draft = { ...session.draft, description: text, title: text.slice(0, 60) };
    await saveSession(database, chatId, { step: "konfirmasi", draft });
    await reply(token, chatId, `${summaryText(draft)}\n\nApakah data sudah benar?`, confirmKeyboard());
    return;
  }
  if (session.replyTicketId) {
    if (/^batal$/i.test(text)) { await saveSession(database, chatId, {}); await reply(token, chatId, "Balasan dibatalkan."); return; }
    await addMessageForTicket(database, { ticketId: session.replyTicketId, senderType: "USER", body: text, senderId: user.id });
    await saveSession(database, chatId, {});
    await reply(token, chatId, "Balasan Anda terkirim dan tercatat di percakapan tiket.");
    return;
  }
  if (session.step) { await reply(token, chatId, "Pengisian tiket masih berjalan. Gunakan tombol yang tersedia, atau ketik 'batal'."); return; }
  if (session.aiDraft) {
    if (/^(ya|iya|yes|kirim|setuju|konfirmasi)$/i.test(text)) {
      await submitAiDraft(database, token, chatId, user.id, session.aiDraft);
      return;
    }
    if (/^(batal|tidak|cancel)$/i.test(text)) {
      await clearSession(database, chatId);
      await reply(token, chatId, "Pembuatan tiket dibatalkan.");
      return;
    }
    await reply(token, chatId, 'Balas "ya" untuk mengirim tiket atau "batal" untuk membatalkan.');
    return;
  }
  if (/\b(?:buat|bikin|ajukan|create|open)\s+(?:kan\s+)?tiket\b/i.test(text)) {
    if (config.mode === "agent") {
      await handleAgentMessage(database, token, chatId, user.id, text, config, session.aiIntake?.context);
    } else {
      await startIntake(database, token, chatId);
    }
    return;
  }
  if (config.mode === "agent") {
    await handleAgentMessage(database, token, chatId, user.id, text, config, session.aiIntake?.context);
    return;
  }
  await startIntake(database, token, chatId);
}

async function submitTicket(database: D1Database, token: string, chatId: string, callbackId: string, messageId: number) {
  const session = await loadSession(database, chatId);
  const draft = session.draft;
  if (!draft?.categoryId || !draft.priority || !draft.description) { await answerCallback(token, callbackId, "Data tiket belum lengkap."); return; }
  const user = await linkedUser(database, chatId);
  if (!user) { await clearSession(database, chatId); await answerCallback(token, callbackId, "Akun belum terhubung."); return; }
  const ticket = await createTicket(database, { title: draft.title ?? draft.description.slice(0, 60), description: draft.description, categoryId: draft.categoryId, priority: draft.priority, userId: user.id, source: "TELEGRAM" });
  await clearSession(database, chatId);
  await editReply(token, chatId, messageId, `Tiket berhasil dibuat!\nKode: ${ticket.code}\nJudul: ${ticket.title}\nKategori: ${ticket.category.name} · Prioritas: ${priorityLabels[ticket.priority as Priority]}\nStatus: ${statusLabels[ticket.status] ?? ticket.status}\n\nTim IT akan segera menangani. Pantau lewat /status.`);
  await answerCallback(token, callbackId);
}

async function handleCallback(database: D1Database, token: string, callback: NonNullable<TelegramUpdate["callback_query"]>) {
  const chatId = String(callback.message?.chat.id ?? "");
  const data = callback.data ?? "";
  if (!chatId || !callback.message) return;
  if (data.startsWith("cat:")) {
    const categoryId = data.slice(4);
    const category = await database.prepare("SELECT id, name FROM Category WHERE id = ? LIMIT 1").bind(categoryId).first<CategoryRow>();
    if (!category) { await answerCallback(token, callback.id, "Kategori tidak ditemukan."); return; }
    const session = await loadSession(database, chatId);
    await saveSession(database, chatId, { step: "prioritas", draft: { ...session.draft, categoryId: category.id, categoryName: category.name } });
    await editReply(token, chatId, callback.message.message_id, `Kategori: ${category.name}\nSekarang pilih prioritas:`, priorityKeyboard());
    await answerCallback(token, callback.id);
    return;
  }
  if (data.startsWith("pri:")) {
    const priority = data.slice(4) as Priority;
    if (!(priority in priorityLabels)) { await answerCallback(token, callback.id, "Prioritas tidak valid."); return; }
    const session = await loadSession(database, chatId);
    await saveSession(database, chatId, { step: "deskripsi", draft: { ...session.draft, priority } });
    await editReply(token, chatId, callback.message.message_id, `Prioritas: ${priorityLabels[priority]}\nTerakhir, jelaskan masalahnya dalam satu pesan:`);
    await answerCallback(token, callback.id);
    return;
  }
  if (data === "confirm:create") { await submitTicket(database, token, chatId, callback.id, callback.message.message_id); return; }
  if (data === "cancel:intake") { await clearSession(database, chatId); await editReply(token, chatId, callback.message.message_id, "Pembuatan tiket dibatalkan."); await answerCallback(token, callback.id); return; }
  if (data.startsWith("reply:")) {
    const ticketId = data.slice(6);
    const user = await linkedUser(database, chatId);
    const ticket = await database.prepare("SELECT id, userId, status, code FROM Ticket WHERE id = ? LIMIT 1").bind(ticketId).first<{ id: string; userId: string; status: string; code: string }>();
    if (!user || !ticket || ticket.userId !== user.id || ticket.status === "CLOSED") { await answerCallback(token, callback.id, "Tiket tidak dapat dibalas."); return; }
    await saveSession(database, chatId, { replyTicketId: ticket.id });
    await reply(token, chatId, `Ketik balasan untuk tiket ${ticket.code}, atau ketik 'batal'.`);
    await answerCallback(token, callback.id);
  }
}

export async function processTelegramUpdate(
  database: D1Database,
  token: string,
  update: TelegramUpdate,
  config: TelegramAiConfig = { mode: "off", provider: "gemini", apiKey: "", model: "gemini-2.5-flash", environment: "production" }
) {
  const candidateUpdateId = update.update_id;
  const updateId: number | null = typeof candidateUpdateId === "number" && Number.isInteger(candidateUpdateId) ? candidateUpdateId : null;
  const claimed = updateId !== null ? await claimTelegramUpdate(database, updateId) : false;
  if (updateId !== null && !claimed) return;

  try {
    if (update.callback_query) {
      await handleCallback(database, token, update.callback_query);
    } else {
      const message = update.message;
      if (message?.text) {
        const chatId = String(message.chat.id);
        const text = message.text.trim();
        if (text === "/start" || text.startsWith("/start ")) await handleStart(database, token, chatId);
        else if (text === "/help") await reply(token, chatId, "Bantuan IT Helpdesk:\n/start — hubungkan akun\n/status — lihat tiket aktif\n/help — tampilkan bantuan");
        else if (text === "/status") await handleStatus(database, token, chatId);
        else await handleMessage(database, token, chatId, text, config);
      }
    }
    if (claimed && updateId !== null) await completeTelegramUpdate(database, updateId);
  } catch (cause) {
    if (claimed && updateId !== null) await releaseTelegramUpdate(database, updateId);
    throw cause;
  }
}
