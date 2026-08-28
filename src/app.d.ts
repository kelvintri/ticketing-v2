import type { D1Database, Fetcher } from "@cloudflare/workers-types";

declare global {
  namespace App {
    interface Locals {
      auth: import("$lib/server/auth").AuthContext | null;
    }

    interface Platform {
      env: {
        ASSETS: Fetcher;
        DB?: D1Database;
        JWT_SECRET?: string;
        JWT_EXPIRES_IN?: string;
        GEMINI_API_KEY?: string;
        GEMINI_MODEL?: string;
        AI_PROVIDER?: "gemini" | "openrouter";
        OPENROUTER_API_KEY?: string;
        OPENROUTER_MODEL?: string;
        AI_MODE?: "off" | "rules" | "agent";
        TELEGRAM_BOT_TOKEN?: string;
        TELEGRAM_WEBHOOK_SECRET?: string;
        TELEGRAM_ENV_LABEL?: "STAGING" | "PRODUCTION";
      };
      ctx: ExecutionContext;
      caches: CacheStorage;
      cf?: IncomingRequestCfProperties;
    }
  }
}

export {};
