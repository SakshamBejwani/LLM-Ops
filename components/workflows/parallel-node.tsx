"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkflowView } from "@/components/workflows/workflow-view-context";
import { branchDisplayLabel, type ParallelNode as ParallelNodeType } from "@/lib/workflow/canvas";

const RING_CLASS: Record<string, string> = {
  running: "ring-2 ring-blue-500 animate-pulse",
  success: "ring-2 ring-emerald-500",
  error: "ring-2 ring-destructive",
};

export function ParallelNode({ id, data, selected }: NodeProps<ParallelNodeType>) {
  const { nodeViews, onRequestConnect, onAddParallelBranch } = useWorkflowView();
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

      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{data.label}</span>
        {data.isRoot && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Start
          </Badge>
        )}
      </div>
      <p className="mt-0.5 truncate text-xs text-sky-600 dark:text-sky-400">
        Fans out into {data.branchIds.length} branch{data.branchIds.length === 1 ? "" : "es"} - all run at once
      </p>
      {view && view.status !== "idle" && (
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {view.status === "running" ? "Running…" : view.status === "error" ? `Error: ${view.error ?? "failed"}` : "Done"}
        </p>
      )}

      <div className="mt-2.5 space-y-2 border-t pt-2">
        {data.branchIds.map((branchId) => (
          <div key={branchId} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] text-sky-600 dark:text-sky-400">
              <span className="size-1.5 rounded-full bg-sky-500" />
              {branchDisplayLabel(branchId)}
            </span>
            <div className="relative">
              <Handle
                type="source"
                position={Position.Right}
                id={branchId}
                className="!static !inline-block !size-2 !translate-x-0 !bg-sky-500"
              />
              {onRequestConnect && (
                <button
                  type="button"
                  aria-label={`Connect ${branchDisplayLabel(branchId)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRequestConnect(id, branchId);
                  }}
                  className="absolute top-1/2 -right-8 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:border-foreground/50 hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {onAddParallelBranch && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddParallelBranch(id);
            }}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed py-1 text-[11px] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          >
            <Plus className="size-3" /> Add branch
          </button>
        )}
      </div>
    </div>
  );
}
