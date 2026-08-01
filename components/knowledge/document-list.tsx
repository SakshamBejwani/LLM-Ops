"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type DocumentRow = {
  id: string;
  name: string;
  source: "upload" | "chat-attachment";
  created_at: string;
  chunkCount: number;
};

export function DocumentList({ documents }: { documents: DocumentRow[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (doc: DocumentRow) => {
    if (!confirm(`Delete document "${doc.name}"? This removes it from the knowledge base.`)) return;
    setDeletingId(doc.id);
    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    router.refresh();
    setDeletingId(null);
  };

  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground">No documents yet - upload one to seed the knowledge base.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {documents.map((doc) => (
        <Card key={doc.id}>
          <CardHeader>
            <CardTitle className="line-clamp-1">{doc.name}</CardTitle>
            <CardDescription>{new Date(doc.created_at).toLocaleString()}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{doc.chunkCount} chunks</Badge>
              <Badge variant="outline">{doc.source === "chat-attachment" ? "chat attachment" : "upload"}</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(doc)}
              disabled={deletingId === doc.id}
            >
              {deletingId === doc.id ? "Deleting…" : "Delete"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
