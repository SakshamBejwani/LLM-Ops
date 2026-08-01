"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkflowView } from "@/components/workflows/workflow-view-context";
import { NodeToolStatus } from "@/components/workflows/node-tool-status";
import type { BotNode as BotNodeType } from "@/lib/workflow/canvas";

const RING_CLASS: Record<string, string> = {
  running: "ring-2 ring-blue-500 animate-pulse",
  success: "ring-2 ring-emerald-500",
  error: "ring-2 ring-destructive",
};

export function BotNode({ id, data, selected }: NodeProps<BotNodeType>) {
  const { bots, nodeViews, onRequestConnect } = useWorkflowView();
  const view = nodeViews[id];
  const bot = bots.find((b) => b.id === data.botId);

  return (
    <div
      className={cn(
        "relative w-56 rounded-lg border bg-card p-3 text-card-foreground shadow-sm",
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
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{data.botName}</p>
      {view && view.status !== "idle" && (
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {view.status === "running"
            ? "Running…"
            : view.status === "error"
              ? `Error: ${view.error ?? "failed"}`
              : "Done"}
        </p>
      )}
      {bot && bot.tool_ids.length > 0 && (
        <NodeToolStatus toolIds={bot.tool_ids} allBots={bots} toolCalls={view?.toolCalls ?? []} />
      )}
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </div>
  );
}
