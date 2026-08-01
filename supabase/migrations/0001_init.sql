-- Local, single-user learning app: no auth, RLS intentionally disabled on all
-- tables below. All access goes through Next.js API routes using the
-- service_role key, so explicit grants to service_role are enough here.

create extension if not exists "pgcrypto";

create table bots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  system_prompt text not null default '',
  model text not null,
  temperature real not null default 0.7,
  tool_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references bots(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content text not null,
  created_at timestamptz not null default now()
);

create table requests (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid references bots(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  depth int not null default 0,
  parent_request_id uuid references requests(id) on delete set null,
  prompt_preview text,
  latency_ms int,
  ttft_ms int,
  tokens_in int,
  tokens_out int,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  error text,
  created_at timestamptz not null default now()
);

create table tool_calls (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  tool_name text not null,
  input jsonb,
  output jsonb,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index requests_created_at_idx on requests (created_at desc);
create index requests_parent_request_id_idx on requests (parent_request_id);
create index tool_calls_request_id_idx on tool_calls (request_id);
create index messages_conversation_id_idx on messages (conversation_id);

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
