import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DocumentList, type DocumentRow } from "@/components/knowledge/document-list";
import { DocumentUploadForm } from "@/components/knowledge/document-upload-form";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("documents")
    .select("id, name, source, created_at, document_chunks(count)")
    .order("created_at", { ascending: false });

  const documents: DocumentRow[] = (data ?? []).map((row) => {
    const chunks = row.document_chunks as unknown as { count: number }[];
    return {
      id: row.id,
      name: row.name,
      source: row.source,
      created_at: row.created_at,
      chunkCount: chunks?.[0]?.count ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Knowledge</h1>
          <p className="text-sm text-muted-foreground">
            Documents embedded with nomic-embed-text, searchable by any bot with the Search Docs tool.
          </p>
        </div>
        <DocumentUploadForm />
      </div>

      <DocumentList documents={documents} />
    </div>
  );
}
