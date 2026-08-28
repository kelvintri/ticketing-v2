import { error } from "@sveltejs/kit";
import type { D1Database } from "@cloudflare/workers-types";

export interface KnowledgeInput {
  title: string;
  body: string;
  keywords: string;
  categoryId?: string | null;
  active?: boolean;
}

type KnowledgeRow = {
  id: string;
  title: string;
  body: string;
  keywords: string;
  categoryId: string | null;
  active: number | boolean;
  updatedAt: string;
  categoryName: string | null;
};

function mapArticle(row: KnowledgeRow) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    keywords: row.keywords,
    categoryId: row.categoryId,
    active: row.active === true || row.active === 1,
    updatedAt: row.updatedAt,
    category: row.categoryId && row.categoryName ? { id: row.categoryId, name: row.categoryName } : null
  };
}

const selectArticle = `SELECT k.id, k.title, k.body, k.keywords, k.categoryId, k.active, k.updatedAt,
  c.name AS categoryName FROM KnowledgeArticle k LEFT JOIN Category c ON c.id = k.categoryId`;

export async function listKnowledge(database: D1Database, search?: string) {
  const query = search?.trim();
  const searchClause = query ? " AND (k.title LIKE ? OR k.body LIKE ? OR k.keywords LIKE ?)" : "";
  const statement = database.prepare(`${selectArticle} WHERE k.active = 1${searchClause} ORDER BY k.updatedAt DESC LIMIT 10`);
  const values = query ? [`%${query}%`, `%${query}%`, `%${query}%`] : [];
  const result = await statement.bind(...values).all<KnowledgeRow>();
  return result.results.map(mapArticle);
}

export async function listAllKnowledge(database: D1Database) {
  const result = await database.prepare(`${selectArticle} ORDER BY k.updatedAt DESC`).all<KnowledgeRow>();
  return result.results.map(mapArticle);
}

async function assertCategory(database: D1Database, categoryId: string | null | undefined) {
  if (!categoryId) return;
  const category = await database.prepare("SELECT id FROM Category WHERE id = ? LIMIT 1").bind(categoryId).first<{ id: string }>();
  if (!category) throw error(400, "Category tidak ditemukan");
}

export async function createKnowledge(database: D1Database, input: KnowledgeInput) {
  await assertCategory(database, input.categoryId);
  const id = crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  await database
    .prepare(
      "INSERT INTO KnowledgeArticle (id, title, body, keywords, categoryId, active, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id, input.title, input.body, input.keywords, input.categoryId ?? null, input.active === false ? 0 : 1, updatedAt)
    .run();
  return getKnowledge(database, id);
}

export async function getKnowledge(database: D1Database, id: string) {
  const result = await database.prepare(`${selectArticle} WHERE k.id = ? LIMIT 1`).bind(id).first<KnowledgeRow>();
  if (!result) throw error(404, "Artikel tidak ditemukan");
  return mapArticle(result);
}

export async function updateKnowledge(database: D1Database, id: string, input: Partial<KnowledgeInput>) {
  const existing = await database.prepare("SELECT id FROM KnowledgeArticle WHERE id = ? LIMIT 1").bind(id).first<{ id: string }>();
  if (!existing) throw error(404, "Artikel tidak ditemukan");
  await assertCategory(database, input.categoryId);

  const updates: string[] = [];
  const values: unknown[] = [];
  if (input.title !== undefined) { updates.push("title = ?"); values.push(input.title); }
  if (input.body !== undefined) { updates.push("body = ?"); values.push(input.body); }
  if (input.keywords !== undefined) { updates.push("keywords = ?"); values.push(input.keywords); }
  if (input.categoryId !== undefined) { updates.push("categoryId = ?"); values.push(input.categoryId); }
  if (input.active !== undefined) { updates.push("active = ?"); values.push(input.active ? 1 : 0); }
  if (updates.length) {
    updates.push("updatedAt = ?");
    values.push(new Date().toISOString(), id);
    await database.prepare(`UPDATE KnowledgeArticle SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
  }
  return getKnowledge(database, id);
}

export async function deleteKnowledge(database: D1Database, id: string) {
  const existing = await database.prepare("SELECT id FROM KnowledgeArticle WHERE id = ? LIMIT 1").bind(id).first<{ id: string }>();
  if (!existing) throw error(404, "Artikel tidak ditemukan");
  await database.prepare("DELETE FROM KnowledgeArticle WHERE id = ?").bind(id).run();
  return { ok: true as const };
}
