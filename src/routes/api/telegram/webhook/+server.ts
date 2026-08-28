import { json } from "@sveltejs/kit";
import { processTelegramUpdate, type TelegramUpdate } from "$lib/server/telegram-service";
import { runtimeConfig } from "$lib/server/runtime";
import type { RequestHandler } from "./$types";

function secretsMatch(expected: string, provided: string): boolean {
  const expectedBytes = new TextEncoder().encode(expected);
  const providedBytes = new TextEncoder().encode(provided);
  let difference = expectedBytes.length ^ providedBytes.length;
  const length = Math.max(expectedBytes.length, providedBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (expectedBytes[index] ?? 0) ^ (providedBytes[index] ?? 0);
  }
  return difference === 0;
}

export const POST: RequestHandler = async ({ request, platform }) => {
  const expectedSecret = platform?.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const providedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (!expectedSecret || !secretsMatch(expectedSecret, providedSecret)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = platform?.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const database = platform?.env.DB;
  if (!token || !database) {
    return json({ error: "Telegram integration is not configured" }, { status: 503 });
  }

  try {
    const update = (await request.json()) as TelegramUpdate;
    const config = runtimeConfig(platform);
    await processTelegramUpdate(database, token, update, {
      mode: config.aiMode,
      provider: config.aiProvider,
      apiKey: config.aiProvider === "openrouter" ? config.openrouterApiKey : config.geminiApiKey,
      model: config.aiProvider === "openrouter" ? config.openrouterModel : config.geminiModel,
      environment: config.telegramEnvironment
    });
    return json({ ok: true });
  } catch (cause) {
    console.error(
      JSON.stringify({
        type: "telegram_webhook_error",
        error: cause instanceof Error ? cause.message : String(cause)
      })
    );
    return json({ error: "Telegram update failed" }, { status: 500 });
  }
};
