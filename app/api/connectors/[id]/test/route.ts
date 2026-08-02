import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { connectorConfigSchemaFor, type Connector } from "@/lib/connectors/types";
import { listMcpToolNames } from "@/lib/connectors/mcp";

type RouteParams = { params: Promise<{ id: string }> };

// Dry-run per connector type. For the write-capable adapters (slack_webhook,
// email) we deliberately avoid actually sending anything - this only checks
// reachability/auth, since a "test" button shouldn't have side effects the
// user didn't ask for.
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("connectors").select("*").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });

  const connector = data as Connector;
  try {
    const result = await testConnector(connector);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 200 },
    );
  }
}

async function testConnector(connector: Connector): Promise<{ message: string; detail?: unknown }> {
  switch (connector.type) {
    case "mcp": {
      const config = connectorConfigSchemaFor("mcp").parse(connector.config);
      const toolNames = await listMcpToolNames(config);
      return { message: `Connected. Discovered ${toolNames.length} tool(s).`, detail: toolNames };
    }
    case "weather": {
      const res = await fetch("https://geocoding-api.open-meteo.com/v1/search?name=London&count=1");
      if (!res.ok) throw new Error(`Open-Meteo geocoding failed: ${res.status}`);
      const data = await res.json();
      if (!data.results?.[0]) throw new Error("Open-Meteo returned no results for a known city");
      return { message: "Open-Meteo is reachable." };
    }
    case "web_search": {
      const config = connectorConfigSchemaFor("web_search").parse(connector.config);
      if (config.provider === "tavily") {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: config.apiKey, query: "test", max_results: 1 }),
        });
        if (!res.ok) throw new Error(`Tavily request failed: ${res.status} ${await res.text()}`);
        return { message: "Tavily API key is valid." };
      }
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": config.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: "test" }),
      });
      if (!res.ok) throw new Error(`Serper request failed: ${res.status} ${await res.text()}`);
      return { message: "Serper API key is valid." };
    }
    case "github": {
      const config = connectorConfigSchemaFor("github").parse(connector.config);
      const res = await fetch("https://api.github.com/rate_limit", {
        headers: { Authorization: `Bearer ${config.token}`, Accept: "application/vnd.github+json" },
      });
      if (!res.ok) throw new Error(`GitHub token check failed: ${res.status} ${await res.text()}`);
      return { message: "GitHub token is valid." };
    }
    case "slack_webhook": {
      const config = connectorConfigSchemaFor("slack_webhook").parse(connector.config);
      // Slack incoming webhooks reject GET with 405, which still confirms
      // the URL is a real, live webhook endpoint without posting a message.
      const res = await fetch(config.webhookUrl, { method: "GET" });
      if (res.status !== 405 && !res.ok) {
        throw new Error(`Slack webhook unreachable: ${res.status}`);
      }
      return { message: "Slack webhook URL is reachable." };
    }
    case "email": {
      const config = connectorConfigSchemaFor("email").parse(connector.config);
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      if (!res.ok) throw new Error(`Resend API key check failed: ${res.status} ${await res.text()}`);
      return { message: "Resend API key is valid." };
    }
  }
}
