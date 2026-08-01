import { z } from "zod";
import { tool } from "ai";

const CONDITIONS = ["Sunny", "Cloudy", "Rainy", "Windy", "Snowy", "Foggy"] as const;

// Deterministic pseudo-random hash so the same city always returns the same
// mock reading within a run - this is a demo tool, not a real weather API.
function hashCity(city: string): number {
  let hash = 0;
  for (let i = 0; i < city.length; i++) {
    hash = (hash * 31 + city.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export const weatherTool = tool({
  description: "Get the current (mock) weather for a city.",
  inputSchema: z.object({
    city: z.string().describe('e.g. "Tokyo"'),
  }),
  execute: async ({ city }) => {
    // Simulate network latency so the dashboard has something to visualize.
    await new Promise((resolve) => setTimeout(resolve, 250 + Math.random() * 300));

    const hash = hashCity(city.toLowerCase().trim());
    const temperatureC = (hash % 35) - 5;
    const condition = CONDITIONS[hash % CONDITIONS.length];
    const humidity = 30 + (hash % 60);

    return { city, temperatureC, condition, humidity };
  },
});
