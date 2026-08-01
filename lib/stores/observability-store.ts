import { create } from "zustand";
import type { BusEvent, RequestRecord, ToolCallDisplay } from "@/lib/types";

export type LiveToolCall = {
  toolCallId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  durationMs?: number;
  status: "running" | "done";
};

export type LiveRequest = {
  requestId: string;
  botId: string;
  botName: string;
  depth: number;
  parentRequestId: string | null;
  status: "queued" | "running";
  promptPreview?: string;
  startedAt: number;
  ttftMs?: number;
  toolCalls: LiveToolCall[];
  text: string;
  reasoning: string;
};

export type WorkflowNodeStatus = {
  status: "running" | "success" | "error";
  requestId?: string;
  output?: unknown;
  error?: string;
};

export type WorkflowRunStatus = {
  status: "running" | "success" | "error";
  startedAt: number;
  error?: string;
};

const HISTORY_LIMIT = 200;
const RAW_EVENT_LIMIT = 2000;

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([id]) => id !== key));
}

export function workflowNodeKey(workflowRunId: string, nodeId: string): string {
  return `${workflowRunId}:${nodeId}`;
}

function toToolCallDisplays(live: LiveRequest | undefined): ToolCallDisplay[] {
  return (live?.toolCalls ?? []).map((call) => ({
    id: call.toolCallId,
    toolName: call.toolName,
    input: call.input,
    output: call.output,
    durationMs: call.durationMs ?? null,
  }));
}

type ObservabilityState = {
  connectionStatus: "connecting" | "open" | "closed";
  liveRequests: Record<string, LiveRequest>;
  history: RequestRecord[];
  retryBadges: Record<string, number>;
  /** Every bus event seen so far, capped - raw feed for the terminal-style log view. */
  rawEvents: BusEvent[];
  workflowRuns: Record<string, WorkflowRunStatus>;
  workflowNodeStatuses: Record<string, WorkflowNodeStatus>;
  setConnectionStatus: (status: ObservabilityState["connectionStatus"]) => void;
  seedHistory: (requests: RequestRecord[]) => void;
  handleBusEvent: (event: BusEvent) => void;
  clearRawEvents: () => void;
};

export const useObservabilityStore = create<ObservabilityState>((set) => ({
  connectionStatus: "connecting",
  liveRequests: {},
  history: [],
  retryBadges: {},
  rawEvents: [],
  workflowRuns: {},
  workflowNodeStatuses: {},

  clearRawEvents: () => set({ rawEvents: [] }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  seedHistory: (requests) => set({ history: requests.slice(0, HISTORY_LIMIT) }),

  handleBusEvent: (event) =>
    set((state) => {
      const rawEvents = [...state.rawEvents, event].slice(-RAW_EVENT_LIMIT);

      const partial: Partial<ObservabilityState> = (() => {
        switch (event.type) {
        case "request.queued":
          return {
            liveRequests: {
              ...state.liveRequests,
              [event.requestId]: {
                requestId: event.requestId,
                botId: event.botId,
                botName: event.botName,
                depth: event.depth,
                parentRequestId: event.parentRequestId,
                status: "queued",
                promptPreview: event.promptPreview,
                startedAt: event.timestamp,
                toolCalls: [],
                text: "",
                reasoning: "",
              },
            },
          };

        case "request.start": {
          const existing = state.liveRequests[event.requestId];
          return {
            liveRequests: {
              ...state.liveRequests,
              [event.requestId]: {
                requestId: event.requestId,
                botId: event.botId,
                botName: event.botName,
                depth: event.depth,
                parentRequestId: event.parentRequestId,
                status: "running",
                promptPreview: event.promptPreview,
                startedAt: existing?.startedAt ?? event.timestamp,
                toolCalls: existing?.toolCalls ?? [],
                text: existing?.text ?? "",
                reasoning: existing?.reasoning ?? "",
              },
            },
          };
        }

        case "request.delta": {
          const existing = state.liveRequests[event.requestId];
          if (!existing) return {};
          const key = event.kind === "text" ? "text" : "reasoning";
          return {
            liveRequests: {
              ...state.liveRequests,
              [event.requestId]: { ...existing, [key]: existing[key] + event.delta },
            },
          };
        }

        case "request.ttft": {
          const existing = state.liveRequests[event.requestId];
          if (!existing) return {};
          return {
            liveRequests: {
              ...state.liveRequests,
              [event.requestId]: { ...existing, ttftMs: event.ttftMs },
            },
          };
        }

        case "request.retry":
          return { retryBadges: { ...state.retryBadges, [event.requestId]: event.attempt } };

        case "tool.start": {
          const existing = state.liveRequests[event.requestId];
          if (!existing) return {};
          return {
            liveRequests: {
              ...state.liveRequests,
              [event.requestId]: {
                ...existing,
                toolCalls: [
                  ...existing.toolCalls,
                  {
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    input: event.input,
                    status: "running",
                  },
                ],
              },
            },
          };
        }

        case "tool.end": {
          const existing = state.liveRequests[event.requestId];
          if (!existing) return {};
          return {
            liveRequests: {
              ...state.liveRequests,
              [event.requestId]: {
                ...existing,
                toolCalls: existing.toolCalls.map((call) =>
                  call.toolCallId === event.toolCallId
                    ? { ...call, output: event.output, durationMs: event.durationMs, status: "done" }
                    : call,
                ),
              },
            },
          };
        }

        case "request.end": {
          const live = state.liveRequests[event.requestId];
          const record: RequestRecord = {
            id: event.requestId,
            bot_id: live?.botId ?? null,
            bot_name: live?.botName ?? null,
            conversation_id: null,
            depth: live?.depth ?? 0,
            parent_request_id: live?.parentRequestId ?? null,
            prompt_preview: live?.promptPreview ?? null,
            latency_ms: event.latencyMs,
            ttft_ms: event.ttftMs,
            tokens_in: event.tokensIn,
            tokens_out: event.tokensOut,
            status: "success",
            error: null,
            created_at: new Date(event.timestamp).toISOString(),
            tool_calls: toToolCallDisplays(live),
            text: live?.text,
            reasoning: live?.reasoning,
          };
          return {
            liveRequests: omitKey(state.liveRequests, event.requestId),
            retryBadges: omitKey(state.retryBadges, event.requestId),
            history: [record, ...state.history].slice(0, HISTORY_LIMIT),
          };
        }

        case "request.error": {
          const live = state.liveRequests[event.requestId];
          const record: RequestRecord = {
            id: event.requestId,
            bot_id: live?.botId ?? null,
            bot_name: live?.botName ?? null,
            conversation_id: null,
            depth: live?.depth ?? 0,
            parent_request_id: live?.parentRequestId ?? null,
            prompt_preview: live?.promptPreview ?? null,
            latency_ms: event.latencyMs,
            ttft_ms: null,
            tokens_in: null,
            tokens_out: null,
            status: "error",
            error: event.error,
            created_at: new Date(event.timestamp).toISOString(),
            tool_calls: toToolCallDisplays(live),
            text: live?.text,
            reasoning: live?.reasoning,
          };
          return {
            liveRequests: omitKey(state.liveRequests, event.requestId),
            retryBadges: omitKey(state.retryBadges, event.requestId),
            history: [record, ...state.history].slice(0, HISTORY_LIMIT),
          };
        }

        case "workflow.run.start":
          return {
            workflowRuns: {
              ...state.workflowRuns,
              [event.workflowRunId]: { status: "running", startedAt: event.timestamp },
            },
          };

        case "workflow.run.end":
          return {
            workflowRuns: {
              ...state.workflowRuns,
              [event.workflowRunId]: {
                ...(state.workflowRuns[event.workflowRunId] ?? { startedAt: event.timestamp }),
                status: event.status,
                error: event.error,
              },
            },
          };

        case "workflow.node.start":
          return {
            workflowNodeStatuses: {
              ...state.workflowNodeStatuses,
              [workflowNodeKey(event.workflowRunId, event.nodeId)]: {
                status: "running",
                requestId: event.requestId,
              },
            },
          };

        case "workflow.node.end": {
          const key = workflowNodeKey(event.workflowRunId, event.nodeId);
          return {
            workflowNodeStatuses: {
              ...state.workflowNodeStatuses,
              [key]: {
                status: event.status,
                requestId: state.workflowNodeStatuses[key]?.requestId,
                output: event.output,
                error: event.error,
              },
            },
          };
        }

          default:
            return {};
        }
      })();

      return { ...partial, rawEvents };
    }),
}));
