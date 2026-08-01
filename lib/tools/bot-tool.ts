import { z } from "zod";
import { tool } from "ai";
import type { Bot, RunBotCompletion } from "@/lib/types";

export function createBotTool(params: {
  bot: Bot;
  depth: number;
  parentRequestId: string | null;
  runBotCompletion: RunBotCompletion;
}) {
  const { bot, depth, parentRequestId, runBotCompletion } = params;

  return tool({
    description: `Delegate a task to the "${bot.name}" bot. Its role: ${bot.system_prompt.slice(0, 200)}`,
    inputSchema: z.object({
      input: z.string().describe("The message or task to send to this bot."),
    }),
    execute: async ({ input }) => {
      const output = await runBotCompletion({ bot, input, depth, parentRequestId });
      return { output };
    },
  });
}
