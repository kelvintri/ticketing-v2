import { AGENT_TOOL_DEFINITIONS } from "$lib/server/agent-tools";
import type {
  AgentClient,
  FunctionResultInput,
  InteractionInput,
  InteractionResponse,
  InteractionStep
} from "$lib/server/gemini-service";
import { GeminiError } from "$lib/server/gemini-service";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_RESPONSE_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

type ChatToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
};
type MessageContent = string | Array<{ type?: string; text?: string }> | null | undefined;
type OpenRouterResponse = {
  id?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: { role?: string; content?: MessageContent; tool_calls?: ChatToolCall[] };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

function normalizeApiKey(value: string): string {
  return value.trim().replace(/^(['"])(.*)\1$/, "$2").replace(/\s/g, "");
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new GeminiError("protocol", "OpenRouter response is too large");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        text += decoder.decode();
        break;
      }
      text += decoder.decode(chunk.value, { stream: true });
      if (text.length > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new GeminiError("protocol", "OpenRouter response is too large");
      }
    }
  } finally {
    reader.releaseLock();
  }
  return text;
}

function toolDefinitions() {
  return AGENT_TOOL_DEFINITIONS.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

function contentText(content: MessageContent): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n");
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function parseDsmlToolCalls(content: string): ChatToolCall[] {
  const block = content.match(/<｜DSML｜tool_calls>([\s\S]*?)<\/｜DSML｜tool_calls>/);
  if (!block) return [];

  const calls: ChatToolCall[] = [];
  const invokePattern = /<｜DSML｜invoke\s+name="([^"]+)"\s*>([\s\S]*?)<\/｜DSML｜invoke>/g;
  for (const invoke of block[1].matchAll(invokePattern)) {
    const argumentsJson: Record<string, string> = {};
    const parameterPattern = /<｜DSML｜parameter\s+name="([^"]+)"(?:\s+string="true")?\s*>([\s\S]*?)<\/｜DSML｜parameter>/g;
    for (const parameter of invoke[2].matchAll(parameterPattern)) {
      argumentsJson[parameter[1]] = decodeXmlText(parameter[2]);
    }
    calls.push({
      id: `dsml_${crypto.randomUUID()}`,
      type: "function",
      function: { name: invoke[1], arguments: JSON.stringify(argumentsJson) }
    });
  }
  return calls;
}

export type OpenRouterClientOptions = {
  apiKey: string;
  model: string;
  systemInstruction: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

export class OpenRouterClient implements AgentClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly systemInstruction: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly messages: ChatMessage[];
  private lastAssistantMessage: ChatMessage | null = null;

  constructor(options: OpenRouterClientOptions) {
    const apiKey = normalizeApiKey(options.apiKey);
    const model = options.model.trim();
    if (!apiKey) throw new GeminiError("configuration", "OpenRouter API key is missing");
    if (!model) throw new GeminiError("configuration", "OpenRouter model is missing");
    this.apiKey = apiKey;
    this.model = model;
    this.systemInstruction = options.systemInstruction;
    this.fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.messages = [{ role: "system", content: this.systemInstruction }];
  }

  async createInteraction(input: InteractionInput, _previousInteractionId?: string): Promise<InteractionResponse> {
    if (typeof input === "string") {
      this.messages.push({ role: "user", content: input });
    } else {
      if (!this.lastAssistantMessage) throw new GeminiError("protocol", "OpenRouter tool continuation has no assistant call");
      this.messages.push(this.lastAssistantMessage);
      for (const result of input as FunctionResultInput[]) {
        this.messages.push({
          role: "tool",
          tool_call_id: result.call_id,
          content: result.result.map((part) => part.text).join("\n")
        });
      }
    }

    const payload = {
      model: this.model,
      messages: this.messages,
      tools: toolDefinitions(),
      temperature: 0.2,
      max_tokens: 700
    };

    let lastError: GeminiError | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://helpdesk-ticketing-sveltekit.kelvintriyansyah.workers.dev",
            "X-OpenRouter-Title": "Ticket.Ops Helpdesk"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        if (!response.ok) {
          const error = new GeminiError(
            response.status === 408 || response.status === 429 || response.status >= 500 ? "upstream" : "protocol",
            `OpenRouter upstream returned HTTP ${response.status}`,
            response.status
          );
          lastError = error;
          if (attempt === 0 && error.kind === "upstream") continue;
          throw error;
        }
        const body = await readLimitedText(response);
        let result: OpenRouterResponse;
        try {
          result = JSON.parse(body) as OpenRouterResponse;
        } catch {
          throw new GeminiError("protocol", "OpenRouter returned invalid JSON");
        }

        const message = result.choices?.[0]?.message;
        if (!message) throw new GeminiError("protocol", "OpenRouter returned no message");
        const interactionId = result.id ?? crypto.randomUUID();
        const content = contentText(message.content);
        const toolCalls = message.tool_calls?.length ? message.tool_calls : parseDsmlToolCalls(content);
        if (content.includes("<｜DSML｜tool_calls>") && !toolCalls.length) {
          throw new GeminiError("protocol", "OpenRouter returned malformed DSML tool calls");
        }
        if (toolCalls.length) {
          this.lastAssistantMessage = {
            role: "assistant",
            content: null,
            tool_calls: toolCalls
          };
          const steps: InteractionStep[] = toolCalls.map((call) => {
            try {
              return {
                type: "function_call",
                id: call.id,
                name: call.function.name,
                arguments: JSON.parse(call.function.arguments)
              };
            } catch {
              throw new GeminiError("protocol", "OpenRouter returned malformed tool arguments");
            }
          });
          return {
            id: interactionId,
            status: "requires_action",
            steps,
            usage: {
              total_input_tokens: result.usage?.prompt_tokens,
              total_output_tokens: result.usage?.completion_tokens
            }
          };
        }

        this.lastAssistantMessage = {
          role: "assistant",
          content
        };
        return {
          id: interactionId,
          status: "completed",
          output_text: content,
          usage: {
            total_input_tokens: result.usage?.prompt_tokens,
            total_output_tokens: result.usage?.completion_tokens
          }
        };
      } catch (cause) {
        if (cause instanceof GeminiError) {
          lastError = cause;
          if (attempt === 0 && cause.kind === "upstream") continue;
          throw cause;
        }
        if (cause instanceof DOMException && cause.name === "AbortError") {
          throw new GeminiError("timeout", "OpenRouter request timed out");
        }
        throw new GeminiError(
          "upstream",
          "OpenRouter request failed",
          undefined,
          cause instanceof Error ? `${cause.name}:${cause.message.replace(/[\r\n]+/g, " ").slice(0, 120)}` : typeof cause
        );
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError ?? new GeminiError("upstream", "OpenRouter request failed");
  }
}
