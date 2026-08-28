import { runtimeConfig, type WorkerEnv } from "$lib/server/runtime";
import type { Database } from "$lib/server/db";

export type AiProvider = "gemini" | "openrouter";
export type AiMode = "off" | "rules" | "agent";

export type AiConfig = {
  mode: AiMode;
  provider: AiProvider;
  model: string;
  geminiModel: string;
  openrouterModel: string;
  geminiKeyConfigured: boolean;
  openrouterKeyConfigured: boolean;
  updatedAt: string | null;
};

type SettingRow = { key: string; value: string; updatedAt: string };

const KEYS = ["ai.mode", "ai.provider", "ai.geminiModel", "ai.openrouterModel"] as const;

function provider(value: unknown, fallback: AiProvider): AiProvider {
  return value === "openrouter" || value === "gemini" ? value : fallback;
}

function mode(value: unknown, fallback: AiMode): AiMode {
  return value === "off" || value === "rules" || value === "agent" ? value : fallback;
}

function cleanModel(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= 200 && !/[\r\n]/.test(trimmed) ? trimmed : fallback;
}

export async function getAiConfig(platform: App.Platform | undefined, database?: Database): Promise<AiConfig> {
  const env = runtimeConfig(platform);
  const defaults = {
    mode: mode(env.aiMode, "off"),
    provider: provider(env.aiProvider, "gemini"),
    geminiModel: cleanModel(env.geminiModel, "gemini-2.5-flash"),
    openrouterModel: cleanModel(env.openrouterModel, "deepseek/deepseek-v4-flash-0731")
  };
  const values = new Map<string, string>();
  let updatedAt: string | null = null;
  if (database) {
    try {
      const result = await database
        .prepare("SELECT key, value, updatedAt FROM SystemSetting WHERE key IN (?, ?, ?, ?)")
        .bind(...KEYS)
        .all<SettingRow>();
      for (const row of result.results ?? []) {
        values.set(row.key, row.value);
        if (!updatedAt || row.updatedAt > updatedAt) updatedAt = row.updatedAt;
      }
    } catch {
      // Older databases fall back to Wrangler variables until migration 0006 is applied.
    }
  }
  const selectedProvider = provider(values.get("ai.provider"), defaults.provider);
  const geminiModel = cleanModel(values.get("ai.geminiModel"), defaults.geminiModel);
  const openrouterModel = cleanModel(values.get("ai.openrouterModel"), defaults.openrouterModel);
  return {
    mode: mode(values.get("ai.mode"), defaults.mode),
    provider: selectedProvider,
    model: selectedProvider === "gemini" ? geminiModel : openrouterModel,
    geminiModel,
    openrouterModel,
    geminiKeyConfigured: Boolean(env.geminiApiKey.trim()),
    openrouterKeyConfigured: Boolean(env.openrouterApiKey.trim()),
    updatedAt
  };
}

export type AiConfigInput = Pick<AiConfig, "mode" | "provider" | "geminiModel" | "openrouterModel">;

export async function saveAiConfig(database: Database, input: AiConfigInput, updatedBy: string): Promise<void> {
  const now = new Date().toISOString();
  const statements = Object.entries({
    "ai.mode": input.mode,
    "ai.provider": input.provider,
    "ai.geminiModel": input.geminiModel,
    "ai.openrouterModel": input.openrouterModel
  }).map(([key, value]) => database
    .prepare("INSERT INTO SystemSetting (key, value, updatedAt, updatedBy) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt, updatedBy = excluded.updatedBy")
    .bind(key, value, now, updatedBy));
  await database.batch(statements);
}

export function apiKeyFor(config: AiProvider, env: WorkerEnv): string {
  return config === "gemini" ? env.GEMINI_API_KEY ?? "" : env.OPENROUTER_API_KEY ?? "";
}
