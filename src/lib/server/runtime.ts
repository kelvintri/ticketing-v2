import { error } from "@sveltejs/kit";

export type WorkerEnv = NonNullable<App.Platform["env"]>;

export function requireWorkerEnv(platform: App.Platform | undefined): WorkerEnv {
  if (!platform?.env) {
    throw error(503, "Cloudflare Worker environment is unavailable");
  }

  return platform.env;
}

export function runtimeConfig(platform: App.Platform | undefined) {
  const env = requireWorkerEnv(platform);

  return {
    jwtSecret: env.JWT_SECRET ?? "",
    jwtExpiresIn: env.JWT_EXPIRES_IN ?? "8h",
    geminiApiKey: env.GEMINI_API_KEY ?? "",
    geminiModel: env.GEMINI_MODEL ?? "gemini-2.5-flash",
    aiProvider: env.AI_PROVIDER ?? "gemini",
    openrouterApiKey: env.OPENROUTER_API_KEY ?? "",
    openrouterModel: env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash-0731",
    aiMode: env.AI_MODE ?? "off",
    telegramWebhookSecret: env.TELEGRAM_WEBHOOK_SECRET ?? "",
    telegramEnvironment: env.TELEGRAM_ENV_LABEL === "STAGING" ? ("staging" as const) : ("production" as const)
  };
}
