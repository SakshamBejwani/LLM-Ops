-- Parallel/join node kinds run several workflow_node_runs rows concurrently
-- for the same workflow_run, so step_index alone is no longer enough to tell
-- which branch a row belongs to.
alter table workflow_node_runs add column branch_label text;
