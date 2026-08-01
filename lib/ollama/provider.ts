import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

export const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: `${OLLAMA_BASE_URL}/v1`,
  // Without this, Ollama's OpenAI-compatible streaming responses omit token
  // usage entirely, so latency/tool metrics would show but token counts wouldn't.
  includeUsage: true,
  // Without this, the SDK silently drops `response_format`/structured-output
  // schemas instead of sending them (logs an "is only supported with
  // structuredOutputs" warning) - workflow node output schemas would never
  // actually reach Ollama. Ollama's OpenAI-compatible endpoint does support
  // `response_format: json_schema` for tools-capable models.
  supportsStructuredOutputs: true,
});

// nomic-embed-text: pulled locally, produces 768-dim embeddings via Ollama's
// OpenAI-compatible /v1/embeddings endpoint. Used for real RAG (search_docs).
export const embeddingModel = ollama.embeddingModel("nomic-embed-text");

export type OllamaModel = {
  name: string;
  size: number;
  modified_at: string;
  capabilities?: string[];
};

export async function listOllamaModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
  if (!res.ok) {
    throw new Error(`Ollama /api/tags failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { models: OllamaModel[] };
  return data.models;
}
