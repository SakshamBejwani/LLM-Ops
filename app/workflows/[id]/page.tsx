import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { WorkflowEditor } from "@/components/workflows/workflow-editor";
import type { Bot, Workflow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const [{ data: workflow }, { data: bots }] = await Promise.all([
    supabase.from("workflows").select("*").eq("id", id).single(),
    supabase.from("bots").select("*").order("created_at", { ascending: false }),
  ]);

  if (!workflow) notFound();

  return (
    <div className="fixed inset-x-0 top-14 bottom-0">
      <WorkflowEditor workflow={workflow as Workflow} bots={(bots as Bot[]) ?? []} />
    </div>
  );
}
