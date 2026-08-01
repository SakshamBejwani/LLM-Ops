import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BotCard } from "@/components/bots/bot-card";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Bot } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BotsPage() {
  const supabase = getSupabaseServerClient();
  const { data: bots } = await supabase
    .from("bots")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bots</h1>
          <p className="text-sm text-muted-foreground">
            Create bots with their own system prompt, model, temperature and tools.
          </p>
        </div>
        <Button render={<Link href="/bots/new" />} nativeButton={false}>
          New bot
        </Button>
      </div>

      {!bots || bots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bots yet - create your first one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(bots as Bot[]).map((bot) => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      )}
    </div>
  );
}
