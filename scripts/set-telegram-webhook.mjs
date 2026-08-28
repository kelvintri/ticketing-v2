import { readFileSync } from "node:fs";

function readDevVars(fileName) {
  try {
    const lines = readFileSync(new URL(`../${fileName}`, import.meta.url), "utf8").split(/\r?\n/);
    const entries = lines
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 1) return null;
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      })
      .filter((entry) => entry !== null);
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

const argumentIndex = process.argv.indexOf("--env");
const argumentEnvironment = argumentIndex >= 0 ? process.argv[argumentIndex + 1] : undefined;
const requestedEnvironment = process.env.TELEGRAM_TARGET_ENV ?? argumentEnvironment ?? "production";
const environment = requestedEnvironment === "prod" ? "production" : requestedEnvironment;
if (environment !== "staging" && environment !== "production") {
  throw new Error("Webhook environment must be staging or production.");
}

const defaultVarsFile = environment === "staging" ? ".dev.vars.staging" : ".dev.vars.production";
const defaultWebhookUrl = environment === "staging"
  ? "https://helpdesk-ticketing-staging.kelvintriyansyah.workers.dev/api/telegram/webhook"
  : "https://helpdesk-ticketing-sveltekit.kelvintriyansyah.workers.dev/api/telegram/webhook";
const varsFile = process.env.TELEGRAM_VARS_FILE ?? defaultVarsFile;
const devVars = readDevVars(varsFile);
const token = (process.env.TELEGRAM_BOT_TOKEN ?? devVars.TELEGRAM_BOT_TOKEN)?.trim();
const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? devVars.TELEGRAM_WEBHOOK_SECRET)?.trim();
const url = (process.env.TELEGRAM_WEBHOOK_URL ?? devVars.TELEGRAM_WEBHOOK_URL ?? defaultWebhookUrl)?.trim();

if (!token || !secret || !url) {
  throw new Error(`Telegram ${environment} requires TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET.`);
}

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false
  })
});

const result = await response.json();
if (!response.ok || !result.ok) {
  throw new Error(result.description ?? `Telegram setWebhook failed with HTTP ${response.status}`);
}

console.log(`Telegram webhook registered: ${url}`);
