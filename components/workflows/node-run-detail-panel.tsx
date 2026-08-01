"use client";

import { Button } from "@/components/ui/button";
import { NodeRunCard } from "@/components/workflows/node-run-card";
import type { NodeRunView } from "@/components/workflows/workflow-view-context";

export function NodeRunDetailPanel({
  botName,
  view,
  onClose,
}: {
  botName: string;
  view: NodeRunView | undefined;
  onClose: () => void;
}) {
  const toolCalls = (view?.toolCalls ?? []).map((call) => ({
    id: call.toolCallId,
    toolName: call.toolName,
    input: call.input,
    output: call.output,
    durationMs: call.durationMs,
  }));

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background/95 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Run detail</span>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          ×
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <NodeRunCard
          botName={botName}
          status={view?.status ?? "idle"}
          latencyMs={view?.latencyMs}
          input={view?.input}
          output={view?.output}
          error={view?.error}
          toolCalls={toolCalls}
        />
      </div>
    </div>
  );
}
