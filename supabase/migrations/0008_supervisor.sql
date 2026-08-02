-- Records the per-run parameter override a supervisor scope applied to a
-- bot node right before it ran, if any - null for nodes outside any scope
-- or where the supervisor chose not to intervene.
alter table workflow_node_runs add column supervisor_override jsonb;
