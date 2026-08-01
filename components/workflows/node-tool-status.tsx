"use client";

import { CircleDashed, Loader2, CheckCircle2 } from "lucide-react";
import { BUILTIN_TOOLS, botToolKey } from "@/lib/tools";
import { cn } from "@/lib/utils";
import type { Bot } from "@/lib/types";
import type { LiveToolCall } from "@/lib/stores/observability-store";

type ToolChipState = "idle" | "running" | "done";

function resolveTool(toolId: string, allBots: Bot[]): { label: string; matchKey: string } | null {
  if (toolId.startsWith("bot:")) {
    const botId = toolId.slice("bot:".length);
    const bot = allBots.find((b) => b.id === botId);
    if (!bot) return null;
    return { label: bot.name, matchKey: botToolKey(botId) };
  }
  const builtin = BUILTIN_TOOLS[toolId];
  if (!builtin) return null;
  return { label: builtin.name, matchKey: toolId };
}

function stateFor(matchKey: string, toolCalls: LiveToolCall[]): ToolChipState {
  const calls = toolCalls.filter((c) => c.toolName === matchKey);
  if (calls.length === 0) return "idle";
  if (calls.some((c) => c.status === "running")) return "running";
  return "done";
}

export function NodeToolStatus({
  toolIds,
  allBots,
  toolCalls,
}: {
  toolIds: string[];
  allBots: Bot[];
  toolCalls: LiveToolCall[];
}) {
  const items = toolIds
    .map((id) => resolveTool(id, allBots))
    .filter((item): item is { label: string; matchKey: string } => item !== null);

  if (items.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {items.map((item) => {
        const state = stateFor(item.matchKey, toolCalls);
        return (
          <span
            key={item.matchKey}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] leading-none",
              state === "done" && "border-emerald-500/40 text-emerald-500",
              state === "running" && "border-blue-500/40 text-blue-500",
              state === "idle" && "border-border text-muted-foreground",
            )}
          >
            {state === "idle" && <CircleDashed className="size-2.5" />}
            {state === "running" && <Loader2 className="size-2.5 animate-spin" />}
            {state === "done" && <CheckCircle2 className="size-2.5" />}
            {item.label}
          </span>
        );
      })}
    </div>
  );
}
