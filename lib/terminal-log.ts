import type { BusEvent } from "@/lib/types";

export type LogTone = "info" | "success" | "error" | "warn" | "muted";

export type LogLine = {
  key: string;
  tone: LogTone;
  text: string;
};

function ts(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString([], { hour12: false })}.${String(timestamp % 1000).padStart(3, "0")}`;
}

function short(id: string): string {
  return id.slice(0, 8);
}

function json(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Converts the raw bus event feed into terminal-style log lines. Lifecycle
 * and tool events each get their own line; text/reasoning deltas for the
 * same (requestId, kind) pair are coalesced onto one growing line instead of
 * one line per token, so a streaming response reads like a single line
 * filling in rather than a flood of one-word lines.
 */
export function eventsToLines(events: BusEvent[]): LogLine[] {
  const lines: LogLine[] = [];
  const deltaLineIndex = new Map<string, number>();

  for (const event of events) {
    const time = ts(event.timestamp);

    switch (event.type) {
      case "request.queued":
        lines.push({
          key: `${event.requestId}-queued`,
          tone: "warn",
          text: `[${time}] queued     bot=${event.botName} depth=${event.depth} req=${short(event.requestId)} prompt="${event.promptPreview}"`,
        });
        break;

      case "request.start":
        lines.push({
          key: `${event.requestId}-start`,
          tone: "info",
          text: `[${time}] start      bot=${event.botName} depth=${event.depth} req=${short(event.requestId)}`,
        });
        break;

      case "request.ttft":
        lines.push({
          key: `${event.requestId}-ttft`,
          tone: "muted",
          text: `[${time}] ttft       req=${short(event.requestId)} ${event.ttftMs}ms`,
        });
        break;

      case "request.retry":
        lines.push({
          key: `${event.requestId}-retry-${event.attempt}`,
          tone: "warn",
          text: `[${time}] retry      req=${short(event.requestId)} attempt=${event.attempt} error="${event.error}"`,
        });
        break;

      case "tool.start":
        lines.push({
          key: `tool-${event.toolCallId}-start`,
          tone: "info",
          text: `[${time}] tool_call  req=${short(event.requestId)} ${event.toolName}(${json(event.input)})`,
        });
        break;

      case "tool.end":
        lines.push({
          key: `tool-${event.toolCallId}-end`,
          tone: "success",
          text: `[${time}] tool_done  req=${short(event.requestId)} ${event.durationMs}ms -> ${json(event.output)}`,
        });
        break;

      case "request.delta": {
        const dKey = `${event.requestId}:${event.kind}`;
        const existingIndex = deltaLineIndex.get(dKey);
        if (existingIndex !== undefined) {
          lines[existingIndex] = { ...lines[existingIndex], text: lines[existingIndex].text + event.delta };
        } else {
          const label = event.kind === "reasoning" ? "thinking  " : "output    ";
          deltaLineIndex.set(dKey, lines.length);
          lines.push({
            key: `delta-${dKey}`,
            tone: event.kind === "reasoning" ? "muted" : "info",
            text: `[${time}] ${label} req=${short(event.requestId)} ${event.delta}`,
          });
        }
        break;
      }

      case "request.end":
        lines.push({
          key: `${event.requestId}-end`,
          tone: "success",
          text: `[${time}] done       req=${short(event.requestId)} latency=${event.latencyMs}ms tokens=${event.tokensIn ?? "?"}/${event.tokensOut ?? "?"}`,
        });
        break;

      case "request.error":
        lines.push({
          key: `${event.requestId}-error`,
          tone: "error",
          text: `[${time}] error      req=${short(event.requestId)} latency=${event.latencyMs}ms "${event.error}"`,
        });
        break;
    }
  }

  return lines;
}
