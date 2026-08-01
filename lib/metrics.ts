import type { RequestRecord } from "@/lib/types";

export function percentile(sortedValues: number[], p: number): number | null {
  if (sortedValues.length === 0) return null;
  const index = Math.min(sortedValues.length - 1, Math.floor((p / 100) * sortedValues.length));
  return sortedValues[index];
}

export type Metrics = {
  totalRequests: number;
  errorRate: number;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  avgLatencyMs: number | null;
  requestsPerMinute: number;
};

export function computeMetrics(history: RequestRecord[]): Metrics {
  const completed = history.filter((r) => r.status !== "running");
  const latencies = completed
    .map((r) => r.latency_ms)
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => a - b);

  const errorCount = completed.filter((r) => r.status === "error").length;
  const oneMinuteAgo = Date.now() - 60_000;
  const requestsPerMinute = completed.filter(
    (r) => new Date(r.created_at).getTime() >= oneMinuteAgo,
  ).length;

  return {
    totalRequests: completed.length,
    errorRate: completed.length > 0 ? errorCount / completed.length : 0,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    avgLatencyMs:
      latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null,
    requestsPerMinute,
  };
}
