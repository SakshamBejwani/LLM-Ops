"use client";

import { Button } from "@/components/ui/button";
import type { Bot } from "@/lib/types";

export type ConnectPickerExistingNode = {
  id: string;
  label: string;
  botName: string;
};

export function NodeConnectPicker({
  bots,
  existingNodes,
  onClose,
  onSelectBot,
  onSelectExisting,
  onSelectCondition,
}: {
  bots: Bot[];
  existingNodes: ConnectPickerExistingNode[];
  onClose: () => void;
  onSelectBot: (bot: Bot) => void;
  onSelectExisting: (nodeId: string) => void;
  /** Undefined when opened from a condition node's own If/Else handle - a
   * condition node feeding directly into another one is possible but not the
   * primary flow, so it's left out of the picker in that case. */
  onSelectCondition?: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background/95 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Connect to</span>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          ×
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {onSelectCondition && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Actions</p>
            <button
              type="button"
              onClick={onSelectCondition}
              className="flex w-full flex-col rounded-md border border-amber-500/40 p-2 text-left text-sm hover:bg-muted/50"
            >
              <span className="font-medium">Condition</span>
              <span className="text-xs text-muted-foreground">
                Route to two outputs (if/else) based on N conditions - no bot call.
              </span>
            </button>
          </div>
        )}

        {existingNodes.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Existing nodes</p>
            <div className="space-y-1">
              {existingNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectExisting(node.id)}
                  className="flex w-full flex-col rounded-md border p-2 text-left text-sm hover:bg-muted/50"
                >
                  <span className="font-medium">{node.label}</span>
                  <span className="text-xs text-muted-foreground">{node.botName}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Bots</p>
          {bots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bots yet - create one first.</p>
          ) : (
            <div className="space-y-1">
              {bots.map((bot) => (
                <button
                  key={bot.id}
                  type="button"
                  onClick={() => onSelectBot(bot)}
                  className="flex w-full flex-col rounded-md border p-2 text-left text-sm hover:bg-muted/50"
                >
                  <span className="font-medium">{bot.name}</span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    {bot.system_prompt || "No system prompt set."}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
