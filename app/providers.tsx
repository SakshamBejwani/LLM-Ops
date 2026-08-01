"use client";

import { useEffect } from "react";
import { useObservabilityStore } from "@/lib/stores/observability-store";
import type { BusEvent, RequestRecord, ToolCallDisplay, ToolCallRecord } from "@/lib/types";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const handleBusEvent = useObservabilityStore((s) => s.handleBusEvent);
  const seedHistory = useObservabilityStore((s) => s.seedHistory);
  const setConnectionStatus = useObservabilityStore((s) => s.setConnectionStatus);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/requests?limit=100")
      .then((res) => res.json())
      .then((data: { requests: RequestRecord[]; toolCalls: ToolCallRecord[] }) => {
        if (cancelled) return;
        const toolCallsByRequest = new Map<string, ToolCallDisplay[]>();
        for (const tc of data.toolCalls ?? []) {
          const list = toolCallsByRequest.get(tc.request_id) ?? [];
          list.push({
            id: tc.id,
            toolName: tc.tool_name,
            input: tc.input,
            output: tc.output,
            durationMs: tc.duration_ms,
          });
          toolCallsByRequest.set(tc.request_id, list);
        }
        const withToolCalls = (data.requests ?? []).map((r) => ({
          ...r,
          tool_calls: toolCallsByRequest.get(r.id) ?? [],
        }));
        seedHistory(withToolCalls);
      })
      .catch(() => {});

    const source = new EventSource("/api/events/stream");
    source.onopen = () => setConnectionStatus("open");
    source.onerror = () => setConnectionStatus("closed");
    source.onmessage = (message) => {
      try {
        handleBusEvent(JSON.parse(message.data) as BusEvent);
      } catch {
        // comment/keep-alive frames aren't JSON - ignore them
      }
    };

    return () => {
      cancelled = true;
      source.close();
    };
  }, [handleBusEvent, seedHistory, setConnectionStatus]);

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
