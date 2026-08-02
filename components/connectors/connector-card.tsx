"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Connector } from "@/lib/connectors/types";

export function ConnectorCard({ connector }: { connector: Connector }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm(`Delete connector "${connector.name}"?`)) return;
    setDeleting(true);
    await fetch(`/api/connectors/${connector.id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <Link href={`/connectors/${connector.id}`}>
      <Card className="transition-colors hover:border-foreground/30">
        <CardHeader>
          <CardTitle>{connector.name}</CardTitle>
          <CardDescription className="line-clamp-2">
            {connector.description || "No description set."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{connector.type}</Badge>
            <Badge variant={connector.enabled ? "outline" : "destructive"}>
              {connector.enabled ? "enabled" : "disabled"}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
