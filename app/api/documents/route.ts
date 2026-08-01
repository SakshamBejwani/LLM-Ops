import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ingestDocument } from "@/lib/embeddings/ingest";

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, name, source, created_at, document_chunks(count)")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const documents = (data ?? []).map((row) => {
    const chunks = row.document_chunks as unknown as { count: number }[];
    return {
      id: row.id,
      name: row.name,
      source: row.source,
      created_at: row.created_at,
      chunkCount: chunks?.[0]?.count ?? 0,
    };
  });

  return NextResponse.json({ documents });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { name?: string; content?: string; source?: "upload" | "chat-attachment" };
  if (!body.name || !body.content) {
    return NextResponse.json({ error: "name and content are required" }, { status: 400 });
  }

  try {
    const result = await ingestDocument({
      name: body.name,
      content: body.content,
      source: body.source ?? "upload",
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Ingestion failed" }, { status: 500 });
  }
}
