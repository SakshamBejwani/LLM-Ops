-- Nested (child) requests are persisted as soon as their own tool call
-- finishes, which is always *before* the parent request's `onFinish` fires
-- (the parent is still waiting on that same tool call). So a child's insert
-- referencing parent_request_id can land before the parent row exists.
-- parent_request_id stays as a plain correlation id for the dashboard,
-- without a foreign key enforcing an ordering that doesn't hold here.
alter table requests drop constraint requests_parent_request_id_fkey;
