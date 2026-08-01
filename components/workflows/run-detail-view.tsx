import { NodeRunCard } from "@/components/workflows/node-run-card";
import type { WorkflowNodeRunRecord } from "@/lib/types";

export function RunDetailView({ nodeRuns }: { nodeRuns: WorkflowNodeRunRecord[] }) {
  if (nodeRuns.length === 0) {
    return <p className="text-sm text-muted-foreground">No node activity recorded for this run.</p>;
  }

  return (
    <div className="space-y-3">
      {nodeRuns.map((nodeRun) => (
        <NodeRunCard
          key={nodeRun.id}
          botName={nodeRun.bot_name ?? "Unknown bot"}
          status={nodeRun.status}
          latencyMs={nodeRun.latency_ms}
          input={nodeRun.input}
          output={nodeRun.output}
          error={nodeRun.error}
          toolCalls={nodeRun.tool_calls ?? []}
        />
      ))}
    </div>
  );
}
