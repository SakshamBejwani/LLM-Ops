import { embed } from "ai";
import { embeddingModel } from "@/lib/ollama/provider";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type KnowledgeBaseMatch = {
  content: string;
  documentName: string;
  similarity: number;
};

export async function searchKnowledgeBase(query: string, matchCount = 5): Promise<KnowledgeBaseMatch[]> {
  const supabase = getSupabaseServerClient();
  const { embedding } = await embed({ model: embeddingModel, value: query });

  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: embedding,
    match_count: matchCount,
  });
  if (error) {
    throw new Error(`Knowledge base search failed: ${error.message}`);
  }

  return ((data ?? []) as { content: string; document_name: string; similarity: number }[]).map((row) => ({
    content: row.content,
    documentName: row.document_name,
    similarity: row.similarity,
  }));
}
