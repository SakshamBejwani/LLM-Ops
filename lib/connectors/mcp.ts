import { createMCPClient, type MCPClient, type MCPClientConfig } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { Tool } from "ai";
import type { McpConfig } from "./types";

// Connecting a stdio MCP server spawns a child process, and its tools' own
// `execute` closures need that connection to stay open for as long as the
// tool might be called - so unlike the REST adapters, we can't build-and-
// forget per resolve call. Cache one client per connector id on globalThis
// (same pattern as lib/supabase/server.ts's singleton), reused across
// requests and never explicitly closed; good enough for a local single-user
// dev server, not a production-grade connection pool.
declare global {
  var __mcpClients: Map<string, Promise<MCPClient>> | undefined;
}

function getClientCache(): Map<string, Promise<MCPClient>> {
  if (!globalThis.__mcpClients) {
    globalThis.__mcpClients = new Map();
  }
  return globalThis.__mcpClients;
}

function buildTransport(config: McpConfig): MCPClientConfig["transport"] {
  if (config.transport === "stdio") {
    return new Experimental_StdioMCPTransport({ command: config.command, args: config.args });
  }
  return { type: "sse", url: config.url, headers: config.headers };
}

export async function resolveMcpTools(connectorId: string, config: McpConfig): Promise<Record<string, Tool>> {
  const cache = getClientCache();
  let clientPromise = cache.get(connectorId);
  if (!clientPromise) {
    clientPromise = createMCPClient({ transport: buildTransport(config) });
    cache.set(connectorId, clientPromise);
  }

  try {
    const client = await clientPromise;
    return (await client.tools()) as Record<string, Tool>;
  } catch (err) {
    cache.delete(connectorId);
    throw err;
  }
}

export async function listMcpToolNames(config: McpConfig): Promise<string[]> {
  const client = await createMCPClient({ transport: buildTransport(config) });
  try {
    const tools = await client.tools();
    return Object.keys(tools);
  } finally {
    await client.close();
  }
}
