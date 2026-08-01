"use client";

import { useEffect, useMemo, useRef } from "react";
import { useObservabilityStore } from "@/lib/stores/observability-store";
import { eventsToLines, type LogTone } from "@/lib/terminal-log";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<LogTone, string> = {
  info: "text-emerald-400",
  success: "text-teal-300",
  error: "text-red-400",
  warn: "text-yellow-400",
  muted: "text-zinc-500",
};

export function TerminalLog() {
  const rawEvents = useObservabilityStore((s) => s.rawEvents);
  const lines = useMemo(() => eventsToLines(rawEvents), [rawEvents]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastLine = lines[lines.length - 1];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, lastLine?.text]);

  return (
    <div className="flex h-full min-h-[32rem] max-h-[50rem] flex-col overflow-hidden rounded-lg border bg-zinc-950">
      <div className="flex items-center gap-1.5 border-b border-zinc-800 px-3 py-2">
        <span className="size-2.5 rounded-full bg-red-500/70" />
        <span className="size-2.5 rounded-full bg-yellow-500/70" />
        <span className="size-2.5 rounded-full bg-green-500/70" />
        <span className="ml-2 text-xs text-zinc-500">llm-logs — all bot activity, live</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-zinc-600">Waiting for activity…</p>
        ) : (
          lines.map((line) => (
            <p key={line.key} className={cn("whitespace-pre-wrap break-all", TONE_CLASSES[line.tone])}>
              {line.text}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
