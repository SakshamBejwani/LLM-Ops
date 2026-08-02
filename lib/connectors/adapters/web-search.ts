import { z } from "zod";
import { tool } from "ai";
import type { WebSearchConfig } from "../types";

export function buildTool(config: WebSearchConfig) {
  return tool({
    description: `Search the web for current information (via ${config.provider === "tavily" ? "Tavily" : "Serper"}).`,
    inputSchema: z.object({
      query: z.string().describe("The search query."),
    }),
    execute: async ({ query }) => {
      if (config.provider === "tavily") {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: config.apiKey, query, max_results: 5 }),
        });
        if (!res.ok) {
          throw new Error(`Tavily search failed: ${res.status} ${await res.text()}`);
        }
        const data = await res.json();
        return { query, results: data.results ?? [] };
      }

      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": config.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query }),
      });
      if (!res.ok) {
        throw new Error(`Serper search failed: ${res.status} ${await res.text()}`);
      }
      const data = await res.json();
      return { query, results: data.organic ?? [] };
    },
  });
}
