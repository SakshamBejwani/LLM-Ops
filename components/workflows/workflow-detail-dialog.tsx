"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RunDetailView } from "@/components/workflows/run-detail-view";
import { fmtMs } from "@/lib/format";
import type { Workflow, WorkflowNodeRunRecord, WorkflowRunRecord } from "@/lib/types";

export function WorkflowDetailDialog({
  workflow,
  open,
  onOpenChange,
}: {
  workflow: Workflow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([]);
  const [nodeRuns, setNodeRuns] = useState<WorkflowNodeRunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedRunId(null);
      return;
    }
    setLoading(true);
    fetch(`/api/workflows/${workflow.id}/runs`)
      .then((res) => res.json())
      .then((data: { runs: WorkflowRunRecord[]; nodeRuns: WorkflowNodeRunRecord[] }) => {
        setRuns(data.runs ?? []);
        setNodeRuns(data.nodeRuns ?? []);
      })
      .finally(() => setLoading(false));
  }, [open, workflow.id]);

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] !max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <span>{workflow.name}</span>
            <Button size="sm" render={<Link href={`/workflows/${workflow.id}`} />} nativeButton={false}>
              Editor
            </Button>
          </DialogTitle>
          <DialogDescription>{workflow.description || "No description."}</DialogDescription>
        </DialogHeader>

        <div className="min-w-0">
          {selectedRun ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedRunId(null)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back to runs
                </button>
                <div className="flex items-center gap-2">
                  <Badge variant={selectedRun.status === "error" ? "destructive" : "outline"}>
                    {selectedRun.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    render={<Link href={`/workflows/${workflow.id}?run=${selectedRun.id}`} />}
                    nativeButton={false}
                  >
                    View on canvas
                  </Button>
                </div>
              </div>
              <p className="rounded-md bg-muted/50 p-2 text-sm whitespace-pre-wrap">{selectedRun.trigger_message}</p>
              <RunDetailView nodeRuns={nodeRuns.filter((nr) => nr.workflow_run_id === selectedRun.id)} />
            </div>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Loading runs…</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet - open the editor and hit Run.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedRunId(run.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border p-2 text-left text-sm hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1 truncate">{run.trigger_message}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">{fmtMs(run.latency_ms)}</span>
                    <Badge variant={run.status === "error" ? "destructive" : "outline"}>{run.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(run.started_at).toLocaleString()}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
