import type { AgentToolContext } from "$lib/server/agent-tools";
import { AGENT_TOOL_DEFINITIONS, executeAgentTool } from "$lib/server/agent-tools";
import { buildAgentSystemInstruction, AgentTextSchema, buildAgentInput } from "$lib/server/agent-policy";

const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_TOOL_ROUNDS = 3;
const MAX_TOOL_CALLS_PER_ROUND = 2;
const REQUEST_TIMEOUT_MS = 10_000;

export type TextContent = { type?: string; text?: string };

export type InteractionStep = {
  type?: string;
  id?: string;
  call_id?: string;
  name?: string;
  arguments?: unknown;
  content?: TextContent[];
};

export type InteractionResponse = {
  id?: string;
  status?: string;
  output_text?: string;
  steps?: InteractionStep[];
  usage?: { total_input_tokens?: number; total_output_tokens?: number; total_tokens?: number };
};

export type FunctionResultInput = {
  type: "function_result";
  name: string;
  call_id: string;
  result: Array<{ type: "text"; text: string }>;
};

export type InteractionInput = string | FunctionResultInput[];

export type AgentToolResult = {
  name: string;
  result: unknown;
};

export type GeminiAgentResult = {
  text: string;
  interactionId: string;
  toolsCalled: string[];
  toolResults: AgentToolResult[];
  tokensIn: number | null;
  tokensOut: number | null;
};

function normalizeApiKey(value: string): string {
  return value.trim().replace(/^(['"])(.*)\1$/, "$2").replace(/\s/g, "");
}

function errorDetail(cause: unknown): string {
  if (!(cause instanceof Error)) return typeof cause;
  return `${cause.name}:${cause.message.replace(/[\r\n]+/g, " ").slice(0, 120)}`;
}

export class GeminiError extends Error {
  readonly kind: "configuration" | "upstream" | "timeout" | "protocol" | "tool";
  readonly status?: number;
  readonly detail?: string;

  constructor(kind: GeminiError["kind"], message: string, status?: number, detail?: string) {
    super(message);
    this.name = "GeminiError";
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_RESPONSE_BYTES) {
    throw new GeminiError("protocol", "Gemini response is too large");
  }

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
        throw new GeminiError("protocol", "Gemini response is too large");
      }
    }
  } finally {
    reader.releaseLock();
  }
  return text;
}

function responseText(interaction: InteractionResponse): string {
  if (interaction.output_text) return interaction.output_text;
  const blocks = (interaction.steps ?? [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((content) => content.type === "text" && typeof content.text === "string")
    .map((content) => content.text as string);
  return blocks.join("\n");
}

function pendingFunctionCalls(interaction: InteractionResponse): InteractionStep[] {
  const completedCallIds = new Set(
    (interaction.steps ?? [])
      .filter((step) => step.type === "function_result" && (step.call_id || step.id))
      .map((step) => step.call_id ?? step.id)
  );
  return (interaction.steps ?? []).filter(
    (step) => step.type === "function_call" && step.id && step.name && !completedCallIds.has(step.id)
  );
}

export interface AgentClient {
  createInteraction(input: InteractionInput, previousInteractionId?: string): Promise<InteractionResponse>;
}
export type GeminiClientOptions = {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

export class GeminiClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly systemInstruction: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  constructor(options: GeminiClientOptions) {
    const apiKey = normalizeApiKey(options.apiKey);
    const model = options.model.trim();
    if (!apiKey) throw new GeminiError("configuration", "Gemini API key is missing");
    if (!model) throw new GeminiError("configuration", "Gemini model is missing");
    this.apiKey = apiKey;
    this.model = model;
    this.systemInstruction = options.systemInstruction ?? buildAgentSystemInstruction("production");
    this.fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  }

  async createInteraction(input: InteractionInput, previousInteractionId?: string): Promise<InteractionResponse> {
    const payload: Record<string, unknown> = {
      model: this.model,
      system_instruction: this.systemInstruction,
      input,
      tools: AGENT_TOOL_DEFINITIONS,
      store: true,
      generation_config: { temperature: 0.2, max_output_tokens: 700 }
    };
    if (previousInteractionId) payload.previous_interaction_id = previousInteractionId;

    let lastError: GeminiError | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(INTERACTIONS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        if (!response.ok) {
          const error = new GeminiError(
            isRetryableStatus(response.status) ? "upstream" : "protocol",
            `Gemini upstream returned HTTP ${response.status}`,
            response.status
          );
          lastError = error;
          if (attempt === 0 && isRetryableStatus(response.status)) continue;
          throw error;
        }
        const body = await readLimitedText(response);
        try {
          return JSON.parse(body) as InteractionResponse;
        } catch {
          throw new GeminiError("protocol", "Gemini returned invalid JSON");
        }
      } catch (cause) {
        if (cause instanceof GeminiError) {
          lastError = cause;
          if (attempt === 0 && cause.kind === "upstream") continue;
          throw cause;
        }
        if (cause instanceof DOMException && cause.name === "AbortError") {
          throw new GeminiError("timeout", "Gemini request timed out");
        }
        throw new GeminiError("upstream", "Gemini request failed", undefined, errorDetail(cause));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError ?? new GeminiError("upstream", "Gemini request failed");
  }
}

export async function runGeminiAgent(
  client: AgentClient,
  context: AgentToolContext,
  text: string,
  previousInteractionId?: string,
  conversationContext?: string
): Promise<GeminiAgentResult> {
  let input: InteractionInput = buildAgentInput(text, conversationContext);
  let previousId = previousInteractionId;
  const toolsCalled: string[] = [];
  const toolResults: AgentToolResult[] = [];
  let lastInteraction: InteractionResponse | null = null;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const interaction = await client.createInteraction(input, previousId);
    lastInteraction = interaction;
    const pendingCalls = pendingFunctionCalls(interaction);
    if (!pendingCalls.length) {
      let output: string;
      try {
        output = AgentTextSchema.parse(responseText(interaction));
      } catch {
        throw new GeminiError("protocol", "Gemini returned no valid text output");
      }
      if (!interaction.id) throw new GeminiError("protocol", "Gemini response has no interaction id");
      return {
        text: output,
        toolResults,
        interactionId: interaction.id,
        toolsCalled,
        tokensIn: interaction.usage?.total_input_tokens ?? null,
        tokensOut: interaction.usage?.total_output_tokens ?? null
      };
    }

    if (round === MAX_TOOL_ROUNDS || pendingCalls.length > MAX_TOOL_CALLS_PER_ROUND) {
      throw new GeminiError("tool", "Gemini tool-call limit exceeded");
    }
    if (!interaction.id) throw new GeminiError("protocol", "Gemini tool response has no interaction id");

    const results: FunctionResultInput[] = [];
    for (const call of pendingCalls) {
      const name = call.name as string;
      if (!AGENT_TOOL_DEFINITIONS.some((tool) => tool.name === name)) {
        throw new GeminiError("tool", "Gemini requested an unauthorized tool");
      }
      try {
        const result = await executeAgentTool(name, call.arguments ?? {}, context);
        results.push({ type: "function_result", name, call_id: call.id as string, result: [{ type: "text", text: JSON.stringify(result) }] });
        toolsCalled.push(name);
        toolResults.push({ name, result });
      } catch {
        throw new GeminiError("tool", "Gemini tool arguments were rejected");
      }
    }
    input = results;
    previousId = interaction.id;
  }

  throw new GeminiError("protocol", lastInteraction ? "Gemini agent did not complete" : "Gemini agent did not start");
}
