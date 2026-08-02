import type { Tool } from "ai";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Connector, ConnectorType } from "./types";
import { connectorConfigSchemaFor } from "./types";
import { resolveMcpTools } from "./mcp";
import { buildTool as buildWebSearchTool } from "./adapters/web-search";
import { buildTool as buildWeatherTool } from "./adapters/weather";
import { buildTool as buildGithubTool } from "./adapters/github";
import { buildTool as buildSlackTool } from "./adapters/slack";
import { buildTool as buildEmailTool } from "./adapters/email";

export function connectorToolKey(connectorId: string): string {
  return `connector_${connectorId.replace(/-/g, "")}`;
}

function buildAdapterTool(type: Exclude<ConnectorType, "mcp">, config: unknown): Tool {
  switch (type) {
    case "web_search":
      return buildWebSearchTool(connectorConfigSchemaFor("web_search").parse(config));
    case "weather":
      return buildWeatherTool(connectorConfigSchemaFor("weather").parse(config));
    case "github":
      return buildGithubTool(connectorConfigSchemaFor("github").parse(config));
    case "slack_webhook":
      return buildSlackTool(connectorConfigSchemaFor("slack_webhook").parse(config));
    case "email":
      return buildEmailTool(connectorConfigSchemaFor("email").parse(config));
  }
}

/**
 * `connectorIds` are `connector:<uuid>` strings, the same convention
 * `bot:<uuid>` already uses in lib/tools/index.ts. Connectors that are
 * disabled, missing, or fail to resolve (bad config, unreachable server) are
 * silently skipped rather than failing the whole tool set.
 */
export async function resolveConnectorTools(connectorIds: string[]): Promise<Record<string, Tool>> {
  const ids = connectorIds
    .filter((id) => id.startsWith("connector:"))
    .map((id) => id.slice("connector:".length));
  if (ids.length === 0) return {};

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("connectors").select("*").in("id", ids);
  if (error || !data) return {};

  const tools: Record<string, Tool> = {};
  for (const row of data as Connector[]) {
    if (!row.enabled) continue;
    try {
      if (row.type === "mcp") {
        const config = connectorConfigSchemaFor("mcp").parse(row.config);
        const mcpTools = await resolveMcpTools(row.id, config);
        for (const [name, mcpTool] of Object.entries(mcpTools)) {
          tools[`${connectorToolKey(row.id)}_${name}`] = mcpTool;
        }
        continue;
      }
      tools[connectorToolKey(row.id)] = buildAdapterTool(row.type, row.config);
    } catch {
      continue;
    }
  }
  return tools;
}
