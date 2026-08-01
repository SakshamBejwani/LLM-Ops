import { z } from "zod";
import { tool } from "ai";
import { searchKnowledgeBase } from "@/lib/embeddings/search";

export const searchDocsTool = tool({
  description:
    "Search the knowledge base of uploaded/attached documents for relevant information using vector similarity.",
  inputSchema: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => {
    const results = await searchKnowledgeBase(query, 5);
    return { query, results };
  },
});
