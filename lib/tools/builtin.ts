import type { Tool } from "ai";
import { calculatorTool } from "./calculator";
import { weatherTool } from "./weather";
import { searchDocsTool } from "./search-docs";

// Split out from index.ts so client components (e.g. node-tool-status.tsx)
// can read the built-in tool list without pulling in index.ts's
// server-only connector resolution (which imports the MCP client, and
// transitively Node's `child_process` - not bundleable for the browser).
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
