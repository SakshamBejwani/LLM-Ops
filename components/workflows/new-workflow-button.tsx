"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function NewWorkflowButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled workflow", nodes: [], edges: [] }),
      });
      if (!res.ok) throw new Error("Failed to create workflow");
      const data = await res.json();
      router.push(`/workflows/${data.workflow.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Button onClick={handleCreate} disabled={creating}>
      {creating ? "Creating…" : "New workflow"}
    </Button>
  );
}
