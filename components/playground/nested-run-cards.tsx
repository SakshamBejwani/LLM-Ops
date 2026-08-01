"use client";

import { useObservabilityStore } from "@/lib/stores/observability-store";
import { LiveRequestCard, useNow } from "@/components/dashboard/live-requests-panel";
import type { RequestDetailsView } from "@/lib/types";

/**
 * Cards for bots currently running as a *nested* tool call (depth > 0) -
 * e.g. a delegator bot invoking another bot as a tool. These never went
 * through a `useChat` instance of their own (that only exists for the
 * top-level bots the user explicitly selected), so the live observability
 * store is the only place their activity is visible.
 */
export function NestedRunCards({
  onSelect,
}: {
  onSelect?: (view: RequestDetailsView) => void;
}) {
  const liveRequests = useObservabilityStore((s) => s.liveRequests);
  const retryBadges = useObservabilityStore((s) => s.retryBadges);
  const now = useNow();

  const nested = Object.values(liveRequests)
    .filter((req) => req.depth > 0)
    .sort((a, b) => a.startedAt - b.startedAt);

  if (nested.length === 0) return null;

  return (
    <>
      {nested.map((req) => (
        <LiveRequestCard
          key={req.requestId}
          req={req}
          now={now}
          retryAttempt={retryBadges[req.requestId]}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}
