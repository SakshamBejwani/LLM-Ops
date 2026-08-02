"use client";

import type { NodeProps } from "@xyflow/react";
import { ShieldHalf } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupervisorScopeNode as SupervisorScopeNodeType } from "@/lib/workflow/canvas";

/**
 * A "master LLM" watch zone - not a chain node, just a resizable box other
 * nodes are dragged into (membership is computed by position containment in
 * workflow-editor.tsx, not React Flow's parent/child machinery). Rendered
 * behind everything else (`zIndex: -1` set in lib/workflow/canvas.ts) so it
 * reads as a backdrop, not a node you'd click by accident.
 */
export function SupervisorScopeNode({ data, selected }: NodeProps<SupervisorScopeNodeType>) {
  return (
    <div
      className={cn(
        "h-full w-full rounded-xl border-2 border-dashed border-violet-500/40 bg-violet-500/[0.03]",
        selected && "border-violet-500/70",
      )}
    >
      <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-violet-600 dark:text-violet-400">
        <ShieldHalf className="size-3.5" />
        <span className="truncate">{data.label}</span>
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
          {data.memberNodeIds.length} bot{data.memberNodeIds.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
