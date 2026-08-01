"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolValue } from "@/components/shared/tool-value";
import { useObservabilityStore } from "@/lib/stores/observability-store";
import { eventsToLines, type LogTone } from "@/lib/terminal-log";
import { fmtMs } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BusEvent } from "@/lib/types";

const TONE_CLASSES: Record<LogTone, string> = {
  info: "text-emerald-400",
  success: "text-teal-300",
  error: "text-red-400",
  warn: "text-yellow-400",
  muted: "text-zinc-500",
};

type ToolCallEntry = {
  toolCallId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  durationMs?: number;
  status: "running" | "done";
};

function belongsToRun(event: BusEvent, workflowRunId: string, requestIds: Set<string>): boolean {
  if ("workflowRunId" in event) return event.workflowRunId === workflowRunId;
  if ("requestId" in event) return requestIds.has(event.requestId);
  return false;
}

function collectToolCalls(events: BusEvent[]): ToolCallEntry[] {
  const map = new Map<string, ToolCallEntry>();
  for (const event of events) {
    if (event.type === "tool.start") {
      map.set(event.toolCallId, {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        input: event.input,
        status: "running",
      });
    } else if (event.type === "tool.end") {
      const existing = map.get(event.toolCallId);
      if (existing) {
        map.set(event.toolCallId, {
          ...existing,
          output: event.output,
          durationMs: event.durationMs,
          status: "done",
        });
      }
    }
  }
  return Array.from(map.values());
}

export function WorkflowSidePanel({
  workflowRunId,
  onClose,
}: {
  workflowRunId: string | null;
  onClose: () => void;
}) {
  const rawEvents = useObservabilityStore((s) => s.rawEvents);
  const nodeStatuses = useObservabilityStore((s) => s.workflowNodeStatuses);

  const requestIds = useMemo(() => {
    const ids = new Set<string>();
    if (!workflowRunId) return ids;
    for (const [key, status] of Object.entries(nodeStatuses)) {
      if (key.startsWith(`${workflowRunId}:`) && status.requestId) ids.add(status.requestId);
    }
    return ids;
  }, [nodeStatuses, workflowRunId]);

  const runEvents = useMemo(
    () => (workflowRunId ? rawEvents.filter((e) => belongsToRun(e, workflowRunId, requestIds)) : []),
    [rawEvents, workflowRunId, requestIds],
  );

  const lines = useMemo(() => eventsToLines(runEvents), [runEvents]);
  const toolCalls = useMemo(() => collectToolCalls(runEvents), [runEvents]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background/95 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Run activity</span>
        <Button variant="ghost" size="icon-sm" aria-label="Close logs" onClick={onClose}>
          ×
        </Button>
      </div>

      {!workflowRunId ? (
        <p className="p-3 text-sm text-muted-foreground">Run the workflow to see live activity here.</p>
      ) : (
        <Tabs defaultValue="logs" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-3 mt-2">
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="tools">Tool calls{toolCalls.length > 0 ? ` (${toolCalls.length})` : ""}</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="min-h-0 flex-1 overflow-y-auto p-3">
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Waiting for activity…</p>
            ) : (
              <div className="rounded-md bg-zinc-950 p-2 font-mono text-xs leading-relaxed">
                {lines.map((line) => (
                  <p key={line.key} className={cn("whitespace-pre-wrap break-all", TONE_CLASSES[line.tone])}>
                    {line.text}
                  </p>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tools" className="min-h-0 flex-1 overflow-y-auto p-3">
            {toolCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tool calls in this run yet.</p>
            ) : (
              <div className="space-y-2">
                {toolCalls.map((call) => (
                  <div key={call.toolCallId} className="rounded-md border p-2 text-xs">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant={call.status === "running" ? "secondary" : "outline"}>{call.toolName}</Badge>
                      <span className="text-muted-foreground">
                        {call.status === "running" ? "running…" : fmtMs(call.durationMs)}
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 font-medium text-muted-foreground">Input</p>
                        <div className="rounded bg-muted/50 p-1.5">
                          <ToolValue value={call.input} />
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 font-medium text-muted-foreground">Output</p>
                        <div className="rounded bg-muted/50 p-1.5">
                          <ToolValue value={call.output} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
