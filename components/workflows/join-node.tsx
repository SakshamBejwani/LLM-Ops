"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkflowView } from "@/components/workflows/workflow-view-context";
import type { JoinNode as JoinNodeType } from "@/lib/workflow/canvas";

const RING_CLASS: Record<string, string> = {
  running: "ring-2 ring-blue-500 animate-pulse",
  success: "ring-2 ring-emerald-500",
  error: "ring-2 ring-destructive",
};

export function JoinNode({ id, data, selected }: NodeProps<JoinNodeType>) {
  const { nodeViews, onRequestConnect } = useWorkflowView();
  const view = nodeViews[id];

  return (
    <div
      className={cn(
        "relative w-56 rounded-lg border border-sky-500/50 bg-card p-3 text-card-foreground shadow-sm",
        view && RING_CLASS[view.status],
        selected && "border-foreground/50",
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      {onRequestConnect && (
        <button
          type="button"
          aria-label="Connect to next bot"
          onClick={(event) => {
            event.stopPropagation();
            onRequestConnect(id);
          }}
          className="absolute top-1/2 -right-3 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:border-foreground/50 hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{data.label}</span>
        {data.isRoot && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Start
          </Badge>
        )}
      </div>
      <p className="mt-0.5 truncate text-xs text-sky-600 dark:text-sky-400">
        Waits for every branch, then merges them
      </p>
      {view && view.status !== "idle" && (
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {view.status === "running" ? "Running…" : view.status === "error" ? `Error: ${view.error ?? "failed"}` : "Done"}
        </p>
      )}

      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </div>
  );
}
