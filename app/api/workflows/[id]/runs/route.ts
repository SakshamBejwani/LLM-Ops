import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 20), 100);
  const supabase = getSupabaseServerClient();

  const { data: runs, error } = await supabase
    .from("workflow_runs")
    .select("*")
    .eq("workflow_id", id)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const runIds = (runs ?? []).map((r) => r.id as string);
  const { data: nodeRuns } = runIds.length
    ? await supabase
        .from("workflow_node_runs")
        .select("*, bots(name)")
        .in("workflow_run_id", runIds)
        .order("step_index", { ascending: true })
    : { data: [] };

  const requestIds = (nodeRuns ?? [])
    .map((r) => r.request_id as string | null)
    .filter((id): id is string => id !== null);
  const { data: toolCalls } = requestIds.length
    ? await supabase.from("tool_calls").select("*").in("request_id", requestIds)
    : { data: [] };

  const toolCallsByRequestId = new Map<string, unknown[]>();
  for (const call of toolCalls ?? []) {
    const requestId = call.request_id as string;
    const display = {
      id: call.id,
      toolName: call.tool_name,
      input: call.input,
      output: call.output,
      durationMs: call.duration_ms,
    };
    const existing = toolCallsByRequestId.get(requestId);
    if (existing) existing.push(display);
    else toolCallsByRequestId.set(requestId, [display]);
  }

  const normalizedNodeRuns = (nodeRuns ?? []).map((r) => {
    const { bots, ...rest } = r as typeof r & { bots?: { name: string } | null; request_id: string | null };
    return {
      ...rest,
      bot_name: bots?.name ?? null,
      tool_calls: rest.request_id ? (toolCallsByRequestId.get(rest.request_id) ?? []) : [],
    };
  });

  return NextResponse.json({ runs: runs ?? [], nodeRuns: normalizedNodeRuns });
}
