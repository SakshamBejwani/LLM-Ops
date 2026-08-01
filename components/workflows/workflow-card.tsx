"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkflowDetailDialog } from "@/components/workflows/workflow-detail-dialog";
import type { Workflow } from "@/lib/types";

export function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleDelete = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm(`Delete workflow "${workflow.name}"?`)) return;
    setDeleting(true);
    await fetch(`/api/workflows/${workflow.id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setDetailOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDetailOpen(true);
          }
        }}
        className="cursor-pointer transition-colors hover:border-foreground/30"
      >
        <CardHeader>
          <CardTitle>{workflow.name}</CardTitle>
          <CardDescription className="line-clamp-2">
            {workflow.description || "No description."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{workflow.nodes.length} bots</Badge>
            <Badge variant="outline">{workflow.edges.length} connections</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </CardContent>
      </Card>

      <WorkflowDetailDialog workflow={workflow} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}
