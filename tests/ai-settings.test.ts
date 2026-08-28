import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { getAiConfig, saveAiConfig } from "$lib/server/ai-config";
import { checkAiModel } from "$lib/server/ai-health";

function platform() {
  return {
    env: {
      JWT_SECRET: "jwt",
      AI_MODE: "agent",
      AI_PROVIDER: "openrouter",
      GEMINI_MODEL: "gemini-2.5-flash",
      OPENROUTER_MODEL: "deepseek/deepseek-v4-flash-0731",
      GEMINI_API_KEY: "gemini-secret",
      OPENROUTER_API_KEY: "openrouter-secret"
    }
  } as unknown as App.Platform;
}

function database(rows: Record<string, string> = {}) {
  const writes: unknown[][] = [];
  const db = {
    prepare() {
      return {
        bind(...values: unknown[]) {
          return {
            async all() {
              return { results: Object.entries(rows).map(([key, value]) => ({ key, value, updatedAt: "2026-01-01T00:00:00.000Z" })) };
            },
            async first() { return null; },
            __values: values
          };
        }
      };
    },
    async batch(statements: Array<{ __values?: unknown[] }>) {
      for (const statement of statements) writes.push(statement.__values ?? []);
      return { results: [] };
    }
  } as unknown as D1Database;
  return { db, writes };
}

describe("AI settings", () => {
  it("merges persisted settings while reporting only key presence", async () => {
    const { db } = database({ "ai.provider": "gemini", "ai.geminiModel": "gemini-2.0-flash" });
    const config = await getAiConfig(platform(), db);
    expect(config).toMatchObject({ provider: "gemini", model: "gemini-2.0-flash", geminiKeyConfigured: true, openrouterKeyConfigured: true });
    expect(config).not.toHaveProperty("geminiApiKey");
    expect(config).not.toHaveProperty("openrouterApiKey");
  });

  it("writes only non-secret settings", async () => {
    const { db, writes } = database();
    await saveAiConfig(db, { mode: "agent", provider: "openrouter", geminiModel: "gemini-2.5-flash", openrouterModel: "openai/gpt-4o-mini" }, "admin-1");
    expect(writes).toHaveLength(4);
    expect(writes.flat()).not.toContain("openrouter-secret");
  });
});

describe("AI model health", () => {
  it("measures a successful provider response without exposing the key", async () => {
    let request: Request | string | URL = "";
    const result = await checkAiModel({
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      apiKey: "secret-value",
      fetcher: async (input, init) => {
        request = input;
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret-value");
        return new Response(JSON.stringify({ choices: [{ message: { content: "HEALTH_OK" } }] }), { status: 200 });
      }
    });
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(result)).not.toContain("secret-value");
    expect(String(request)).toContain("openrouter.ai");
  });

  it("returns a safe missing-key result", async () => {
    const result = await checkAiModel({ provider: "gemini", model: "gemini-2.5-flash", apiKey: "" });
    expect(result).toMatchObject({ ok: false, status: null });
    expect(result.message).toContain("Cloudflare");
  });
});

