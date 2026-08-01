-- Canvas-based sequential bot chains. `nodes`/`edges` are stored as JSONB
-- (not normalized tables) - same pragmatic pattern as `bots.tool_ids` being a
-- plain array, and it's structurally the same shape used for export/import.
create table workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  nodes jsonb not null default '[]',
  edges jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references workflows(id) on delete set null,
  trigger_message text not null,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  latency_ms int
);

create table workflow_node_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references workflow_runs(id) on delete cascade,
  -- Node ids only exist inside workflows.nodes JSONB, not a normalized table -
  -- same free-text pattern as tool_calls.tool_name, so no FK here.
  node_id text not null,
  bot_id uuid references bots(id) on delete set null,
  step_index int not null,
  -- Links to the underlying LLM call: tool_calls/tokens/TTFT already live on
  -- that requests row via the normal pipeline, this table only adds
  -- workflow-specific context (which node, which step, chain input/output).
  request_id uuid references requests(id) on delete set null,
  input jsonb,
  output jsonb,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  error text,
  latency_ms int,
  created_at timestamptz not null default now()
);

create index workflow_runs_workflow_id_idx on workflow_runs (workflow_id);
create index workflow_runs_started_at_idx on workflow_runs (started_at desc);
create index workflow_node_runs_workflow_run_id_idx on workflow_node_runs (workflow_run_id);

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
