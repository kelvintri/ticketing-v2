import { error, json } from "@sveltejs/kit";
import { z } from "zod";
import { authenticate } from "$lib/server/auth";
import { createDatabase } from "$lib/server/db";
import { getAiConfig, saveAiConfig } from "$lib/server/ai-config";
import { parseJson } from "$lib/server/http";
import type { RequestHandler } from "./$types";

const AiConfigSchema = z.object({
  mode: z.enum(["off", "rules", "agent"]),
  provider: z.enum(["gemini", "openrouter"]),
  geminiModel: z.string().trim().min(1).max(200).regex(/^[^\r\n]+$/),
  openrouterModel: z.string().trim().min(1).max(200).regex(/^[^\r\n]+$/)
});

async function admin(event: Parameters<RequestHandler>[0]) {
  const result = await authenticate(event);
  if (result.auth.role !== "ADMIN") throw error(403, "Akses admin diperlukan");
  return result;
}

export const GET: RequestHandler = async (event) => {
  const { db } = await admin(event);
  return json(await getAiConfig(event.platform, db));
};

export const PATCH: RequestHandler = async (event) => {
  const { db, auth } = await admin(event);
  const input = await parseJson(event.request, AiConfigSchema);
  await saveAiConfig(db, input, auth.agentId);
  return json(await getAiConfig(event.platform, db));
};

