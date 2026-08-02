import { z } from "zod";
import { tool } from "ai";
import type { SlackWebhookConfig } from "../types";

export function buildTool(config: SlackWebhookConfig) {
  return tool({
    description: "Post a message to a Slack channel via an incoming webhook.",
    inputSchema: z.object({
      message: z.string().describe("The message text to post."),
    }),
    execute: async ({ message }) => {
      const res = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      if (!res.ok) {
        throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
      }
      return { ok: true };
    },
  });
}
