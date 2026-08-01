import { WorkflowCard } from "@/components/workflows/workflow-card";
import { NewWorkflowButton } from "@/components/workflows/new-workflow-button";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Workflow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const supabase = getSupabaseServerClient();
  const { data: workflows } = await supabase
    .from("workflows")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Chain bots together on a canvas - each bot&apos;s structured output feeds the next.
          </p>
        </div>
        <NewWorkflowButton />
      </div>

      {!workflows || workflows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workflows yet - create your first one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(workflows as Workflow[]).map((workflow) => (
            <WorkflowCard key={workflow.id} workflow={workflow} />
          ))}
        </div>
      )}
    </div>
  );
}
