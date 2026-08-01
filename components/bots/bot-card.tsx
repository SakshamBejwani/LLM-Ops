"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Bot } from "@/lib/types";

export function BotCard({ bot }: { bot: Bot }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm(`Delete bot "${bot.name}"?`)) return;
    setDeleting(true);
    await fetch(`/api/bots/${bot.id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <Link href={`/bots/${bot.id}`}>
      <Card className="transition-colors hover:border-foreground/30">
        <CardHeader>
          <CardTitle>{bot.name}</CardTitle>
          <CardDescription className="line-clamp-2">
            {bot.system_prompt || "No system prompt set."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{bot.model}</Badge>
            <Badge variant="outline">temp {bot.temperature.toFixed(1)}</Badge>
            <Badge variant="outline">{bot.tool_ids.length} tools</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
