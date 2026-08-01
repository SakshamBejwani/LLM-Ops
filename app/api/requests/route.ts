import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 100), 500);
  const supabase = getSupabaseServerClient();

  const { data: requests, error } = await supabase
    .from("requests")
    .select("*, bots(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const requestIds = (requests ?? []).map((r) => r.id as string);
  const { data: toolCalls } =
    requestIds.length > 0
      ? await supabase.from("tool_calls").select("*").in("request_id", requestIds)
      : { data: [] };

  const normalized = (requests ?? []).map((r) => {
    const { bots, ...rest } = r as typeof r & { bots?: { name: string } | null };
    return { ...rest, bot_name: bots?.name ?? null };
  });

  return NextResponse.json({ requests: normalized, toolCalls: toolCalls ?? [] });
}
