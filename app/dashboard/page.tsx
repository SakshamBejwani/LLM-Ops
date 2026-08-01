"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { LiveRequestsPanel } from "@/components/dashboard/live-requests-panel";
import { RequestWaterfall } from "@/components/dashboard/request-waterfall";
import { RequestDetailsDialog } from "@/components/dashboard/request-details-dialog";
import { useObservabilityStore } from "@/lib/stores/observability-store";
import type { RequestDetailsView } from "@/lib/types";

export default function DashboardPage() {
  const connectionStatus = useObservabilityStore((s) => s.connectionStatus);
  const [selected, setSelected] = useState<RequestDetailsView | null>(null);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Observability</h1>
        <Badge variant={connectionStatus === "open" ? "default" : "secondary"}>
          SSE: {connectionStatus}
        </Badge>
      </div>

      <MetricsCards />

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Live requests</h2>
        <p className="mb-3 text-xs text-muted-foreground">Click a request for full details.</p>
        <LiveRequestsPanel onSelect={setSelected} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">History</h2>
        <RequestWaterfall onSelect={setSelected} />
      </div>

      <RequestDetailsDialog
        request={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
