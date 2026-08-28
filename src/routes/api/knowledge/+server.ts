import { json } from "@sveltejs/kit";
import { z } from "zod";
import { authenticate } from "$lib/server/auth";
import { parseJson } from "$lib/server/http";
import { createKnowledge, listAllKnowledge, listKnowledge } from "$lib/server/knowledge-service";
import type { RequestHandler } from "./$types";

const KnowledgeSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(20000),
  keywords: z.string().min(1).max(500),
  categoryId: z.string().min(1).nullable().optional(),
  active: z.boolean().optional()
});

export const GET: RequestHandler = async (event) => {
  const { db } = await authenticate(event);
  const search = event.url.searchParams.get("search") ?? undefined;
  return json(search ? await listKnowledge(db, search) : await listAllKnowledge(db));
};

export const POST: RequestHandler = async (event) => {
  const { db } = await authenticate(event);
  const input = await parseJson(event.request, KnowledgeSchema);
  return json(await createKnowledge(db, input), { status: 201 });
};
