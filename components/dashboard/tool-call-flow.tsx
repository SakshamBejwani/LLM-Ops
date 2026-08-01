"use client";

import { Badge } from "@/components/ui/badge";
import type { LiveToolCall } from "@/lib/stores/observability-store";

export function ToolCallFlow({ toolCalls }: { toolCalls: LiveToolCall[] }) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 border-l-2 pl-3">
      {toolCalls.map((call) => (
        <div key={call.toolCallId} className="flex items-center gap-2 text-xs">
          <Badge variant={call.status === "running" ? "secondary" : "outline"}>{call.toolName}</Badge>
          <span className="text-muted-foreground">
            {call.status === "running" ? "running…" : `${call.durationMs}ms`}
          </span>
        </div>
      ))}
    </div>
  );
}
