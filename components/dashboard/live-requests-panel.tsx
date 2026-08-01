"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useObservabilityStore, type LiveRequest } from "@/lib/stores/observability-store";
import { ToolCallFlow } from "@/components/dashboard/tool-call-flow";
import type { RequestDetailsView } from "@/lib/types";
import { liveRequestToDetails } from "@/lib/request-details";

export function useNow(intervalMs = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function LiveRequestsPanel({
  onSelect,
}: {
  onSelect?: (view: RequestDetailsView) => void;
}) {
  const liveRequests = useObservabilityStore((s) => s.liveRequests);
  const retryBadges = useObservabilityStore((s) => s.retryBadges);
  const now = useNow();

  const requests = Object.values(liveRequests).sort((a, b) => a.startedAt - b.startedAt);

  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No requests in flight. Chat with a bot or run the playground to see live activity here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <LiveRequestCard
          key={req.requestId}
          req={req}
          now={now}
          retryAttempt={retryBadges[req.requestId]}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export function LiveRequestCard({
  req,
  now,
  retryAttempt,
  onSelect,
}: {
  req: LiveRequest;
  now: number;
  retryAttempt?: number;
  onSelect?: (view: RequestDetailsView) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [req.text, req.reasoning]);

  return (
    <Card
      className="cursor-pointer"
      style={{ marginLeft: req.depth * 24 }}
      onClick={() => onSelect?.(liveRequestToDetails(req))}
    >
      <CardContent className="py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {req.depth > 0 && <Badge variant="outline">nested</Badge>}
            <span className="font-medium">{req.botName}</span>
            <Badge variant={req.status === "queued" ? "secondary" : "default"}>{req.status}</Badge>
            {retryAttempt && <Badge variant="destructive">retry {retryAttempt}</Badge>}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {((now - req.startedAt) / 1000).toFixed(1)}s
            {req.ttftMs ? ` · TTFT ${req.ttftMs}ms` : ""}
          </span>
        </div>
        {req.promptPreview && (
          <p className="mt-1 truncate text-xs text-muted-foreground">{req.promptPreview}</p>
        )}

        {(req.reasoning || req.text) && (
          <div
            ref={scrollRef}
            className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-md bg-muted/50 p-2 text-xs"
          >
            {req.reasoning && (
              <p className="whitespace-pre-wrap italic text-muted-foreground">{req.reasoning}</p>
            )}
            {req.text && <p className="whitespace-pre-wrap">{req.text}</p>}
          </div>
        )}

        <ToolCallFlow toolCalls={req.toolCalls} />
      </CardContent>
    </Card>
  );
}
