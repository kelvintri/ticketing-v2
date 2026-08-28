import { error } from "@sveltejs/kit";
import type { D1Database } from "@cloudflare/workers-types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function listCategories(database: D1Database) {
  const result = await database.prepare("SELECT id, name FROM Category ORDER BY name ASC").all();
  return result.results;
}

export async function listUsers(database: D1Database) {
  const result = await database
    .prepare(
      `SELECT u.id, u.telegramChatId, u.name, u.department, u.joinCode, u.createdAt,
              COUNT(t.id) AS ticketCount
       FROM User u
       LEFT JOIN Ticket t ON t.userId = u.id
       GROUP BY u.id
       ORDER BY u.createdAt ASC`
    )
    .all();
  return result.results.map((user) => ({
    ...user,
    _count: { tickets: Number(user.ticketCount) }
  }));
}

export async function createUser(database: D1Database, name: string, department?: string) {
  let joinCode: string | null = null;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const candidate = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
    const existing = await database
      .prepare("SELECT id FROM User WHERE joinCode = ? LIMIT 1")
      .bind(candidate)
      .first<{ id: string }>();
    if (!existing) {
      joinCode = candidate;
      break;
    }
  }
  if (!joinCode) throw error(500, "Gagal membangkitkan join code unik");

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await database
    .prepare("INSERT INTO User (id, name, department, joinCode, createdAt) VALUES (?, ?, ?, ?, ?)")
    .bind(id, name, department ?? null, joinCode, createdAt)
    .run();
  return { id, name, department: department ?? null, joinCode, createdAt };
}

export async function regenerateJoinCode(database: D1Database, userId: string) {
  const user = await database.prepare("SELECT id FROM User WHERE id = ? LIMIT 1").bind(userId).first<{ id: string }>();
  if (!user) throw error(404, "User tidak ditemukan");

  let joinCode: string | null = null;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const candidate = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
    const existing = await database
      .prepare("SELECT id FROM User WHERE joinCode = ? AND id <> ? LIMIT 1")
      .bind(candidate, userId)
      .first<{ id: string }>();
    if (!existing) {
      joinCode = candidate;
      break;
    }
  }
  if (!joinCode) throw error(500, "Gagal membangkitkan join code unik");

  await database.prepare("UPDATE User SET joinCode = ? WHERE id = ?").bind(joinCode, userId).run();
  return { id: userId, joinCode };
}
