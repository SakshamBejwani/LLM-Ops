import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ConnectorEditPanel } from "@/components/connectors/connector-edit-panel";
import type { Connector } from "@/lib/connectors/types";

export const dynamic = "force-dynamic";

export default async function ConnectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { data: connector } = await supabase.from("connectors").select("*").eq("id", id).single();

  if (!connector) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{(connector as Connector).name}</h1>
      <ConnectorEditPanel connector={connector as Connector} />
    </div>
  );
}
