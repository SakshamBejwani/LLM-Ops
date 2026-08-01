import type { RequestDetailsView, RequestRecord } from "@/lib/types";
import type { LiveRequest } from "@/lib/stores/observability-store";

export function liveRequestToDetails(req: LiveRequest): RequestDetailsView {
  return {
    requestId: req.requestId,
    botName: req.botName,
    status: req.status,
    depth: req.depth,
    parentRequestId: req.parentRequestId,
    promptPreview: req.promptPreview ?? null,
    latencyMs: null,
    ttftMs: req.ttftMs ?? null,
    tokensIn: null,
    tokensOut: null,
    error: null,
    text: req.text,
    reasoning: req.reasoning,
    toolCalls: req.toolCalls.map((call) => ({
      id: call.toolCallId,
      toolName: call.toolName,
      input: call.input,
      output: call.output,
      durationMs: call.durationMs ?? null,
    })),
  };
}

export function historyRecordToDetails(record: RequestRecord): RequestDetailsView {
  return {
    requestId: record.id,
    botName: record.bot_name ?? record.bot_id,
    status: record.status,
    depth: record.depth,
    parentRequestId: record.parent_request_id,
    promptPreview: record.prompt_preview,
    latencyMs: record.latency_ms,
    ttftMs: record.ttft_ms,
    tokensIn: record.tokens_in,
    tokensOut: record.tokens_out,
    error: record.error,
    text: record.text,
    reasoning: record.reasoning,
    createdAt: record.created_at,
    toolCalls: record.tool_calls ?? [],
  };
}
