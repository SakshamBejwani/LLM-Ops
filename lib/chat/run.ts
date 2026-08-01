import { randomUUID } from "node:crypto";
import { generateText, streamText, stepCountIs, type ModelMessage } from "ai";
import { ollama } from "@/lib/ollama/provider";
import { ollamaSemaphore } from "@/lib/ollama/queue";
import { withRetry } from "@/lib/ollama/retry";
import { emitEvent } from "@/lib/events/bus";
import { resolveTools } from "@/lib/tools";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Bot, RunBotCompletion } from "@/lib/types";

const MAX_STEPS = 5;

// `convertToModelMessages` always turns UIMessage parts into ModelMessage
// content, which for user messages is either a plain string or an array of
// TextPart/ImagePart/FilePart - never assume it's a string.
function extractTextContent(content: ModelMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ");
}

export type PendingToolCallRow = {
  request_id: string;
  tool_name: string;
  input: unknown;
  output: unknown;
  duration_ms: number;
};

type ToolExecutionStartEvent = {
  toolCall: { toolCallId: string; toolName: string; input: unknown };
};

type ToolExecutionEndEvent = {
  toolCall: { toolCallId: string; toolName: string; input: unknown };
  toolExecutionMs: number;
  toolOutput: { type: string; output?: unknown; error?: unknown };
};

export function buildToolInstrumentation(requestId: string, toolCallRows: PendingToolCallRow[]) {
  return {
    onToolExecutionStart: (event: ToolExecutionStartEvent) => {
      emitEvent({
        type: "tool.start",
        requestId,
        toolCallId: event.toolCall.toolCallId,
        toolName: event.toolCall.toolName,
        input: event.toolCall.input,
        timestamp: Date.now(),
      });
    },
    onToolExecutionEnd: (event: ToolExecutionEndEvent) => {
      const output =
        event.toolOutput.type === "tool-result"
          ? event.toolOutput.output
          : { error: String(event.toolOutput.error) };
      const durationMs = Math.round(event.toolExecutionMs);
      emitEvent({
        type: "tool.end",
        requestId,
        toolCallId: event.toolCall.toolCallId,
        output,
        durationMs,
        timestamp: Date.now(),
      });
      toolCallRows.push({
        request_id: requestId,
        tool_name: event.toolCall.toolName,
        input: event.toolCall.input,
        output,
        duration_ms: durationMs,
      });
    },
  };
}

export type PersistedRequestRow = {
  id: string;
  bot_id: string;
  conversation_id: string | null;
  depth: number;
  parent_request_id: string | null;
  prompt_preview: string;
  latency_ms: number;
  ttft_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  status: "success" | "error";
  error: string | null;
};

export async function persistRequest(row: PersistedRequestRow, toolCallRows: PendingToolCallRow[]) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("requests").insert(row);
  if (error) console.error("Failed to persist request row:", error.message);

  if (toolCallRows.length > 0) {
    const { error: toolCallsError } = await supabase.from("tool_calls").insert(toolCallRows);
    if (toolCallsError) console.error("Failed to persist tool_calls rows:", toolCallsError.message);
  }
}

export async function fetchAllBots(): Promise<Bot[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("bots").select("*");
  if (error) throw error;
  return data as Bot[];
}

/**
 * Nested "bot as tool" completion. Runs to full completion (no token
 * streaming to the browser - its output is a tool result consumed by a
 * *different* bot's run) using `generateText` + our own instrumented
 * `withRetry`, since here we can cleanly retry the whole promise on failure.
 */
export const runBotCompletion: RunBotCompletion = async ({ bot, input, depth, parentRequestId }) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const toolCallRows: PendingToolCallRow[] = [];
  const promptPreview = input.slice(0, 200);

  // Nested calls (depth > 0) skip the semaphore entirely. The parent request
  // is single-threaded-blocked awaiting this exact call (that's how JS async
  // tool execution works), so it already represents the chain's one in-flight
  // Ollama request; making the child acquire its own permit while the parent
  // still holds one would deadlock a MAX_CONCURRENT=1 queue.
  const usesSemaphore = depth === 0;
  const willQueue = usesSemaphore && !ollamaSemaphore.isFree;
  if (willQueue) {
    emitEvent({
      type: "request.queued",
      requestId,
      botId: bot.id,
      botName: bot.name,
      depth,
      parentRequestId,
      promptPreview,
      timestamp: Date.now(),
    });
  }
  const release = usesSemaphore ? await ollamaSemaphore.acquire() : () => {};

  try {
    emitEvent({
      type: "request.start",
      requestId,
      botId: bot.id,
      botName: bot.name,
      depth,
      parentRequestId,
      promptPreview,
      timestamp: Date.now(),
    });

    // Depth guard in resolveTools means depth >= 1 never resolves `bot:*`
    // tools, so there's no need to fetch other bots here.
    const tools = resolveTools({
      toolIds: bot.tool_ids,
      allBots: [],
      depth,
      runBotCompletion,
      requestId,
    });
    const instrumentation = buildToolInstrumentation(requestId, toolCallRows);

    const result = await withRetry(
      () =>
        generateText({
          model: ollama(bot.model),
          system: bot.system_prompt,
          prompt: input,
          temperature: bot.temperature,
          tools,
          stopWhen: stepCountIs(MAX_STEPS),
          ...instrumentation,
        }),
      {
        onRetry: (attempt, error) =>
          emitEvent({
            type: "request.retry",
            requestId,
            attempt,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
          }),
      },
    );

    const latencyMs = Date.now() - startedAt;
    emitEvent({
      type: "request.end",
      requestId,
      latencyMs,
      ttftMs: null,
      tokensIn: result.usage.inputTokens ?? null,
      tokensOut: result.usage.outputTokens ?? null,
      status: "success",
      timestamp: Date.now(),
    });

    await persistRequest(
      {
        id: requestId,
        bot_id: bot.id,
        conversation_id: null,
        depth,
        parent_request_id: parentRequestId,
        prompt_preview: promptPreview,
        latency_ms: latencyMs,
        ttft_ms: null,
        tokens_in: result.usage.inputTokens ?? null,
        tokens_out: result.usage.outputTokens ?? null,
        status: "success",
        error: null,
      },
      toolCallRows,
    );

    return result.text;
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    emitEvent({ type: "request.error", requestId, latencyMs, error: message, timestamp: Date.now() });
    await persistRequest(
      {
        id: requestId,
        bot_id: bot.id,
        conversation_id: null,
        depth,
        parent_request_id: parentRequestId,
        prompt_preview: promptPreview,
        latency_ms: latencyMs,
        ttft_ms: null,
        tokens_in: null,
        tokens_out: null,
        status: "error",
        error: message,
      },
      toolCallRows,
    );
    throw error;
  } finally {
    release();
  }
};

/**
 * Top-level chat call backing `/api/chat/[botId]`. Uses `streamText` so
 * tokens reach the browser live. Streaming has already committed output to
 * the client by the time a mid-stream error could happen, so instrumented
 * retry (as used in `runBotCompletion`) doesn't apply here - transient
 * pre-first-token failures are instead covered by the AI SDK's own
 * `maxRetries`, and any failure still surfaces as a `request.error` event.
 */
export function streamBotChat(params: {
  bot: Bot;
  messages: ModelMessage[];
  conversationId: string | null;
}) {
  const { bot, messages, conversationId } = params;
  const requestId = randomUUID();
  const startedAt = Date.now();
  const toolCallRows: PendingToolCallRow[] = [];
  let ttftMs: number | null = null;
  let released = false;

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUserMessage ? extractTextContent(lastUserMessage.content) : "";
  const promptPreview = lastUserText.slice(0, 200);

  return (async () => {
    const willQueue = !ollamaSemaphore.isFree;
    if (willQueue) {
      emitEvent({
        type: "request.queued",
        requestId,
        botId: bot.id,
        botName: bot.name,
        depth: 0,
        parentRequestId: null,
        promptPreview,
        timestamp: Date.now(),
      });
    }
    const release = await ollamaSemaphore.acquire();
    const safeRelease = () => {
      if (!released) {
        released = true;
        release();
      }
    };

    emitEvent({
      type: "request.start",
      requestId,
      botId: bot.id,
      botName: bot.name,
      depth: 0,
      parentRequestId: null,
      promptPreview,
      timestamp: Date.now(),
    });

    const allBots = await fetchAllBots();
    const tools = resolveTools({
      toolIds: bot.tool_ids,
      allBots,
      depth: 0,
      runBotCompletion,
      requestId,
    });
    const instrumentation = buildToolInstrumentation(requestId, toolCallRows);

    return streamText({
      model: ollama(bot.model),
      system: bot.system_prompt,
      messages,
      temperature: bot.temperature,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      maxRetries: 2,
      ...instrumentation,
      onChunk: ({ chunk }) => {
        if (ttftMs === null) {
          ttftMs = Date.now() - startedAt;
          emitEvent({ type: "request.ttft", requestId, ttftMs, timestamp: Date.now() });
        }
        if (chunk.type === "text-delta" || chunk.type === "reasoning-delta") {
          emitEvent({
            type: "request.delta",
            requestId,
            kind: chunk.type === "text-delta" ? "text" : "reasoning",
            delta: chunk.text,
            timestamp: Date.now(),
          });
        }
      },
      onFinish: async (event) => {
        const latencyMs = Date.now() - startedAt;
        emitEvent({
          type: "request.end",
          requestId,
          latencyMs,
          ttftMs,
          tokensIn: event.usage.inputTokens ?? null,
          tokensOut: event.usage.outputTokens ?? null,
          status: "success",
          timestamp: Date.now(),
        });
        await persistRequest(
          {
            id: requestId,
            bot_id: bot.id,
            conversation_id: conversationId,
            depth: 0,
            parent_request_id: null,
            prompt_preview: promptPreview,
            latency_ms: latencyMs,
            ttft_ms: ttftMs,
            tokens_in: event.usage.inputTokens ?? null,
            tokens_out: event.usage.outputTokens ?? null,
            status: "success",
            error: null,
          },
          toolCallRows,
        );

        if (conversationId) {
          const rows: Array<{ conversation_id: string; role: "user" | "assistant"; content: string }> = [];
          if (lastUserText.length > 0) {
            rows.push({ conversation_id: conversationId, role: "user", content: lastUserText });
          }
          if (event.text.length > 0) {
            rows.push({ conversation_id: conversationId, role: "assistant", content: event.text });
          }
          if (rows.length > 0) {
            const { error: messagesError } = await getSupabaseServerClient().from("messages").insert(rows);
            if (messagesError) console.error("Failed to persist messages:", messagesError.message);
          }
        }

        safeRelease();
      },
      onError: async (event) => {
        const latencyMs = Date.now() - startedAt;
        const message = event.error instanceof Error ? event.error.message : String(event.error);
        emitEvent({ type: "request.error", requestId, latencyMs, error: message, timestamp: Date.now() });
        await persistRequest(
          {
            id: requestId,
            bot_id: bot.id,
            conversation_id: conversationId,
            depth: 0,
            parent_request_id: null,
            prompt_preview: promptPreview,
            latency_ms: latencyMs,
            ttft_ms: ttftMs,
            tokens_in: null,
            tokens_out: null,
            status: "error",
            error: message,
          },
          toolCallRows,
        );
        safeRelease();
      },
    });
  })();
}
