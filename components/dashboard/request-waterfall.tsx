"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useObservabilityStore } from "@/lib/stores/observability-store";
import type { RequestDetailsView } from "@/lib/types";
import { historyRecordToDetails } from "@/lib/request-details";

function fmtMs(ms: number | null) {
  if (ms === null) return "–";
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function RequestWaterfall({
  onSelect,
}: {
  onSelect?: (view: RequestDetailsView) => void;
}) {
  const history = useObservabilityStore((s) => s.history);

  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No completed requests yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bot</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Depth</TableHead>
          <TableHead>Latency</TableHead>
          <TableHead>TTFT</TableHead>
          <TableHead>Tokens (in/out)</TableHead>
          <TableHead>Prompt / error</TableHead>
          <TableHead>When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {history.map((req) => (
          <TableRow
            key={req.id}
            className="cursor-pointer"
            onClick={() => onSelect?.(historyRecordToDetails(req))}
          >
            <TableCell>{req.bot_name ?? req.bot_id ?? "–"}</TableCell>
            <TableCell>
              <Badge variant={req.status === "error" ? "destructive" : "outline"}>{req.status}</Badge>
            </TableCell>
            <TableCell>{req.depth}</TableCell>
            <TableCell>{fmtMs(req.latency_ms)}</TableCell>
            <TableCell>{fmtMs(req.ttft_ms)}</TableCell>
            <TableCell>
              {req.tokens_in ?? "–"} / {req.tokens_out ?? "–"}
            </TableCell>
            <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
              {req.error ?? req.prompt_preview ?? ""}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {new Date(req.created_at).toLocaleTimeString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
