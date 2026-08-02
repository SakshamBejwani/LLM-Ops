-- Third-party tool connectors (MCP servers + built-in REST adapters), same
-- pragmatic JSONB-config pattern as `workflows.nodes`/`edges` - config shape
-- varies per `type` and is validated in lib/connectors/types.ts, not here.
create table connectors (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  name text not null,
  description text,
  config jsonb not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
