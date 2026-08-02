import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConnectorCard } from "@/components/connectors/connector-card";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Connector } from "@/lib/connectors/types";

export const dynamic = "force-dynamic";

export default async function ConnectorsPage() {
  const supabase = getSupabaseServerClient();
  const { data: connectors } = await supabase
    .from("connectors")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Connectors</h1>
          <p className="text-sm text-muted-foreground">
            Third-party tools (search, weather, GitHub, Slack, email, MCP servers) bots can call.
          </p>
        </div>
        <Button render={<Link href="/connectors/new" />} nativeButton={false}>
          New connector
        </Button>
      </div>

      {!connectors || connectors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No connectors yet - create your first one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(connectors as Connector[]).map((connector) => (
            <ConnectorCard key={connector.id} connector={connector} />
          ))}
        </div>
      )}
    </div>
  );
}
