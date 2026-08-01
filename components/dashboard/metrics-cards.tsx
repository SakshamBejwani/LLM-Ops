"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useObservabilityStore } from "@/lib/stores/observability-store";
import { computeMetrics } from "@/lib/metrics";

function fmtMs(ms: number | null) {
  if (ms === null) return "–";
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function MetricsCards() {
  const history = useObservabilityStore((s) => s.history);
  const liveRequests = useObservabilityStore((s) => s.liveRequests);
  const metrics = computeMetrics(history);

  const live = Object.values(liveRequests);
  const inFlight = live.filter((r) => r.status === "running").length;
  const queued = live.filter((r) => r.status === "queued").length;

  const cards = [
    { label: "In flight", value: String(inFlight) },
    { label: "Queued", value: String(queued) },
    { label: "Requests", value: String(metrics.totalRequests) },
    { label: "Error rate", value: `${(metrics.errorRate * 100).toFixed(0)}%` },
    { label: "p50 latency", value: fmtMs(metrics.p50LatencyMs) },
    { label: "p95 latency", value: fmtMs(metrics.p95LatencyMs) },
    { label: "Req/min", value: String(metrics.requestsPerMinute) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{card.value}</CardContent>
        </Card>
      ))}
    </div>
  );
}
