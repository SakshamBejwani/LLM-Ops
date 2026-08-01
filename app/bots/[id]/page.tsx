import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { BotEditPanel } from "@/components/bots/bot-edit-panel";
import { ChatPanel } from "@/components/chat/chat-panel";
import type { Bot } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { data: bot } = await supabase.from("bots").select("*").eq("id", id).single();

  if (!bot) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{(bot as Bot).name}</h1>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">Configuration</h2>
          <BotEditPanel bot={bot as Bot} />
        </div>
        <div>
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">Test chat</h2>
          <ChatPanel botId={(bot as Bot).id} />
        </div>
      </div>
    </div>
  );
}
