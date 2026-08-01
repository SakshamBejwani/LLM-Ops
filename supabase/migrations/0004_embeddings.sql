-- Real vector search backing `search_docs`, plus a shared knowledge base fed
-- by both direct uploads and chat attachments. Same conventions as
-- 0001_init.sql: RLS disabled, explicit service_role grants.

create extension if not exists vector;

create table documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null default 'upload' check (source in ('upload', 'chat-attachment')),
  content text not null,
  created_at timestamptz not null default now()
);

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(768) not null,
  created_at timestamptz not null default now()
);

create index document_chunks_embedding_idx on document_chunks
  using hnsw (embedding vector_cosine_ops);
create index document_chunks_document_id_idx on document_chunks (document_id);

-- Exposed to PostgREST as an RPC (POST /rest/v1/rpc/match_document_chunks)
-- since supabase-js has no native vector query builder.
create or replace function match_document_chunks(query_embedding vector(768), match_count int default 5)
returns table (id uuid, document_id uuid, document_name text, content text, similarity float)
language sql stable as $$
  select dc.id, dc.document_id, d.name, dc.content, 1 - (dc.embedding <=> query_embedding)
  from document_chunks dc join documents d on d.id = dc.document_id
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on function match_document_chunks to service_role;
