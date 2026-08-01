import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { validateGraph } from "@/lib/workflow/graph";
import { runWorkflow } from "@/lib/workflow/run";
import type { Workflow } from "@/lib/types";

const runSchema = z.object({
  message: z.string().min(1),
  attachment: z.object({ name: z.string(), content: z.string() }).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json();
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: workflow, error } = await supabase.from("workflows").select("*").eq("id", id).single();
  if (error || !workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  try {
    validateGraph(workflow.nodes, workflow.edges);
  } catch (validationError) {
    const message = validationError instanceof Error ? validationError.message : String(validationError);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const workflowRunId = randomUUID();
  const { error: insertError } = await supabase.from("workflow_runs").insert({
    id: workflowRunId,
    workflow_id: id,
    trigger_message: parsed.data.message,
    status: "running",
  });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Fire-and-forget: this app runs as a long-lived Node process (next dev /
  // next start), not a serverless function, so the detached promise keeps
  // running after this response is sent. Progress streams over the existing
  // SSE bus, same as every other execution path in this app.
  runWorkflow({
    workflow: workflow as Workflow,
    workflowRunId,
    triggerMessage: parsed.data.message,
    attachment: parsed.data.attachment,
  }).catch((err) => console.error("Workflow run crashed:", err));

  return NextResponse.json({ workflowRunId }, { status: 202 });
}
