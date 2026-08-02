import { z } from "zod";
import { tool } from "ai";
import type { EmailConfig } from "../types";

export function buildTool(config: EmailConfig) {
  return tool({
    description: "Send an email via Resend.",
    inputSchema: z.object({
      to: z.string().email(),
      subject: z.string(),
      body: z.string().describe("Plain-text email body."),
    }),
    execute: async ({ to, subject, body }) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: config.fromAddress, to, subject, text: body }),
      });
      if (!res.ok) {
        throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
      }
      return await res.json();
    },
  });
}
