"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkflowView } from "@/components/workflows/workflow-view-context";
import type { JudgeNode as JudgeNodeType } from "@/lib/workflow/canvas";

const RING_CLASS: Record<string, string> = {
  running: "ring-2 ring-blue-500 animate-pulse",
  success: "ring-2 ring-emerald-500",
  error: "ring-2 ring-destructive",
};

function statusLine(view: { status: string; error?: string; output?: unknown } | undefined): string | null {
  if (!view || view.status === "idle") return null;
  if (view.status === "running") return "Running…";
  if (view.status === "error") return `Error: ${view.error ?? "failed"}`;
  const verdict =
    view.output && typeof view.output === "object" && "verdict" in view.output
      ? String((view.output as { verdict: unknown }).verdict)
      : null;
  return verdict ? `Done - "${verdict}"` : "Done";
}

export function JudgeNode({ id, data, selected }: NodeProps<JudgeNodeType>) {
  const { nodeViews, onRequestConnect } = useWorkflowView();
  const view = nodeViews[id];
  const status = statusLine(view);

  return (
    <div
      className={cn(
        "relative w-56 rounded-lg border border-violet-500/50 bg-card p-3 text-card-foreground shadow-sm",
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
      <p className="mt-0.5 line-clamp-2 text-xs text-violet-600 dark:text-violet-400">
        {data.rubric.trim() || "No rubric set"}
      </p>
      {status && <p className="mt-1 truncate text-[11px] text-muted-foreground">{status}</p>}

      <div className="mt-2.5 space-y-2 border-t pt-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Pass
          </span>
          <div className="relative">
            <Handle
              type="source"
              position={Position.Right}
              id="pass"
              className="!static !inline-block !size-2 !translate-x-0 !bg-emerald-500"
            />
            {onRequestConnect && (
              <button
                type="button"
                aria-label="Connect Pass branch"
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestConnect(id, "pass");
                }}
                className="absolute top-1/2 -right-8 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:border-foreground/50 hover:text-foreground"
              >
                <Plus className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] text-red-500 dark:text-red-400">
            <span className="size-1.5 rounded-full bg-red-500" />
            Fail
          </span>
          <div className="relative">
            <Handle
              type="source"
              position={Position.Right}
              id="fail"
              className="!static !inline-block !size-2 !translate-x-0 !bg-red-500"
            />
            {onRequestConnect && (
              <button
                type="button"
                aria-label="Connect Fail branch"
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestConnect(id, "fail");
                }}
                className="absolute top-1/2 -right-8 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:border-foreground/50 hover:text-foreground"
              >
                <Plus className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
