import { error, json } from "@sveltejs/kit";
import { z } from "zod";
import { authenticate } from "$lib/server/auth";
import { getAiConfig, apiKeyFor } from "$lib/server/ai-config";
import { parseJson } from "$lib/server/http";
import { checkAiModel } from "$lib/server/ai-health";
import { requireWorkerEnv } from "$lib/server/runtime";
import type { RequestHandler } from "./$types";

const HealthSchema = z.object({
  provider: z.enum(["gemini", "openrouter"]).optional(),
  model: z.string().trim().max(200).regex(/^[^\r\n]*$/).optional()
});

export const POST: RequestHandler = async (event) => {
  const { db, auth } = await authenticate(event);
  if (auth.role !== "ADMIN") throw error(403, "Akses admin diperlukan");
  const input = await parseJson(event.request, HealthSchema);
  const config = await getAiConfig(event.platform, db);
  const provider = input.provider ?? config.provider;
  const model = input.model?.trim() || config.model;
  const env = requireWorkerEnv(event.platform);
  const result = await checkAiModel({ provider, model, apiKey: apiKeyFor(provider, env) });
  return json(result);
};

