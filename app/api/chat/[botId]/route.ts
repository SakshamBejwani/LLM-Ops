import { NextRequest, NextResponse } from "next/server";
import { convertToModelMessages, type UIMessage } from "ai";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { streamBotChat } from "@/lib/chat/run";
import type { Bot } from "@/lib/types";

type RouteParams = { params: Promise<{ botId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { botId } = await params;
  const body = (await request.json()) as { messages: UIMessage[]; conversationId?: string };

  const supabase = getSupabaseServerClient();
  const { data: bot, error: botError } = await supabase
    .from("bots")
    .select("*")
    .eq("id", botId)
    .single();
  if (botError || !bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  const conversationId = body.conversationId ?? null;
  if (conversationId) {
    await supabase
      .from("conversations")
      .upsert({ id: conversationId, bot_id: botId }, { onConflict: "id", ignoreDuplicates: true });
  }

  const modelMessages = await convertToModelMessages(body.messages);
  const result = await streamBotChat({ bot: bot as Bot, messages: modelMessages, conversationId });
  return result.toUIMessageStreamResponse();
}
