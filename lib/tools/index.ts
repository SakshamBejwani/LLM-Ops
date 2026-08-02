import type { Tool } from "ai";
import { createBotTool } from "./bot-tool";
import { resolveConnectorTools } from "@/lib/connectors/registry";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Bot, RunBotCompletion, ToolOption } from "@/lib/types";

export { BUILTIN_TOOLS, botToolKey } from "./builtin";
import { BUILTIN_TOOLS, botToolKey } from "./builtin";

export async function listToolOptions(allBots: Bot[], excludeBotId?: string): Promise<ToolOption[]> {
  const builtins: ToolOption[] = Object.entries(BUILTIN_TOOLS).map(([id, def]) => ({
    id,
    kind: "builtin",
    name: def.name,
    description: def.description,
  }));
  const bots: ToolOption[] = allBots
    .filter((bot) => bot.id !== excludeBotId)
    .map((bot) => ({
      id: `bot:${bot.id}`,
      kind: "bot",
      name: bot.name,
      description: `Delegate to the "${bot.name}" bot.`,
    }));

  const supabase = getSupabaseServerClient();
  const { data: connectorRows } = await supabase
    .from("connectors")
    .select("*")
    .order("created_at", { ascending: false });
  const connectors: ToolOption[] = (connectorRows ?? []).map((connector) => ({
    id: `connector:${connector.id}`,
    kind: "connector",
    name: connector.name,
    description: connector.description || `${connector.type} connector`,
  }));

  return [...builtins, ...bots, ...connectors];
}

/**
 * Depth guard: only depth-0 (top-level chat) requests may resolve `bot:*`
 * tool ids into real bot-tools. Any nested call this produces runs at depth
 * 1, where `bot:*` ids are skipped entirely - so a chain can never exceed 2
 * LLM calls and cycles are impossible without visited-set bookkeeping.
 */
export async function resolveTools(params: {
  toolIds: string[];
  allBots: Bot[];
  depth: number;
  runBotCompletion: RunBotCompletion;
  requestId: string;
}): Promise<Record<string, Tool>> {
  const { toolIds, allBots, depth, runBotCompletion, requestId } = params;
  const tools: Record<string, Tool> = {};
  const connectorIds: string[] = [];

  for (const id of toolIds) {
    if (id.startsWith("bot:")) {
      if (depth > 0) continue;
      const targetBot = allBots.find((bot) => bot.id === id.slice("bot:".length));
      if (!targetBot) continue;
      tools[botToolKey(targetBot.id)] = createBotTool({
        bot: targetBot,
        depth: depth + 1,
        parentRequestId: requestId,
        runBotCompletion,
      });
    } else if (id.startsWith("connector:")) {
      connectorIds.push(id);
    } else if (id in BUILTIN_TOOLS) {
      tools[id] = BUILTIN_TOOLS[id].tool;
    }
  }

  if (connectorIds.length > 0) {
    Object.assign(tools, await resolveConnectorTools(connectorIds));
  }

  return tools;
}
