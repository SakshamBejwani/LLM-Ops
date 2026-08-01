import { embedMany } from "ai";
import { embeddingModel } from "@/lib/ollama/provider";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { chunkText } from "@/lib/embeddings/chunk";

export async function ingestDocument(params: {
  name: string;
  content: string;
  source: "upload" | "chat-attachment";
}): Promise<{ id: string; chunkCount: number }> {
  const { name, content, source } = params;
  const chunks = chunkText(content);
  if (chunks.length === 0) {
    throw new Error("Document has no extractable text content.");
  }

  const supabase = getSupabaseServerClient();
  const { data: document, error: documentError } = await supabase
    .from("documents")
    .insert({ name, content, source })
    .select("id")
    .single();
  if (documentError || !document) {
    throw new Error(`Failed to create document: ${documentError?.message}`);
  }

  const { embeddings } = await embedMany({ model: embeddingModel, values: chunks });

  const rows = chunks.map((chunk, index) => ({
    document_id: document.id as string,
    chunk_index: index,
    content: chunk,
    embedding: embeddings[index],
  }));

  const { error: chunksError } = await supabase.from("document_chunks").insert(rows);
  if (chunksError) {
    throw new Error(`Failed to store document chunks: ${chunksError.message}`);
  }

  return { id: document.id as string, chunkCount: chunks.length };
}
