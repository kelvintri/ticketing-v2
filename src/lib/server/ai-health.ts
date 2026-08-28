import type { AiProvider } from "$lib/server/ai-config";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type HealthResult = {
  ok: boolean;
  provider: AiProvider;
  model: string;
  latencyMs: number;
  status: number | null;
  message: string;
};

export async function checkAiModel(options: {
  provider: AiProvider;
  model: string;
  apiKey: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<HealthResult> {
  const started = performance.now();
  const fetcher = options.fetcher ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!options.apiKey.trim()) {
    return { ok: false, provider: options.provider, model: options.model, latencyMs: 0, status: null, message: "API key belum dikonfigurasi di Cloudflare." };
  }
  if (!options.model.trim()) {
    return { ok: false, provider: options.provider, model: options.model, latencyMs: 0, status: null, message: "Model belum diisi." };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = options.provider === "gemini"
      ? await fetcher(GEMINI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": options.apiKey.trim() },
          body: JSON.stringify({ model: options.model.trim(), input: "Respond with exactly: HEALTH_OK", generation_config: { temperature: 0, max_output_tokens: 8 }, store: false }),
          signal: controller.signal
        })
      : await fetcher(OPENROUTER_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${options.apiKey.trim()}`, "Content-Type": "application/json", "HTTP-Referer": "https://helpdesk-ticketing-sveltekit.kelvintriyansyah.workers.dev", "X-OpenRouter-Title": "Ticket.Ops model health check" },
          body: JSON.stringify({ model: options.model.trim(), messages: [{ role: "user", content: "Respond with exactly: HEALTH_OK" }], temperature: 0, max_tokens: 8 }),
          signal: controller.signal
        });
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) return { ok: false, provider: options.provider, model: options.model, latencyMs, status: response.status, message: `${options.provider === "gemini" ? "Gemini" : "OpenRouter"} mengembalikan HTTP ${response.status}.` };
    return { ok: true, provider: options.provider, model: options.model, latencyMs, status: response.status, message: "Model merespons dengan baik." };
  } catch (cause) {
    const latencyMs = Math.round(performance.now() - started);
    if (cause instanceof DOMException && cause.name === "AbortError") return { ok: false, provider: options.provider, model: options.model, latencyMs, status: null, message: `Timeout setelah ${timeoutMs} ms.` };
    return { ok: false, provider: options.provider, model: options.model, latencyMs, status: null, message: cause instanceof Error ? cause.message.slice(0, 160) : "Request gagal." };
  } finally {
    clearTimeout(timeout);
  }
}
