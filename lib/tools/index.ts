import type { Tool } from "ai";
import { calculatorTool } from "./calculator";
import { weatherTool } from "./weather";
import { searchDocsTool } from "./search-docs";
import { createBotTool } from "./bot-tool";
import type { Bot, RunBotCompletion, ToolOption } from "@/lib/types";

export const BUILTIN_TOOLS: Record<string, { tool: Tool; name: string; description: string }> = {
  calculator: {
    tool: calculatorTool,
    name: "Calculator",
    description: "Evaluate arithmetic expressions.",
  },
  get_weather: {
    tool: weatherTool,
    name: "Get Weather",
    description: "Mock current weather for a city.",
  },
  search_docs: {
    tool: searchDocsTool,
    name: "Search Docs",
    description: "Search a small local knowledge base.",
  },
};

export function botToolKey(botId: string): string {
  return `bot_${botId.replace(/-/g, "")}`;
}

export function listToolOptions(allBots: Bot[], excludeBotId?: string): ToolOption[] {
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
  return [...builtins, ...bots];
}

/**
 * Depth guard: only depth-0 (top-level chat) requests may resolve `bot:*`
 * tool ids into real bot-tools. Any nested call this produces runs at depth
 * 1, where `bot:*` ids are skipped entirely - so a chain can never exceed 2
 * LLM calls and cycles are impossible without visited-set bookkeeping.
 */
export function resolveTools(params: {
  toolIds: string[];
  allBots: Bot[];
  depth: number;
  runBotCompletion: RunBotCompletion;
  requestId: string;
}): Record<string, Tool> {
  const { toolIds, allBots, depth, runBotCompletion, requestId } = params;
  const tools: Record<string, Tool> = {};

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
    } else if (id in BUILTIN_TOOLS) {
      tools[id] = BUILTIN_TOOLS[id].tool;
    }
  }
  return tools;
}
