-- Nullable = use the provider's own default (Ollama omits top_p when unset),
-- same "optional sampling knob" pattern as temperature but without a forced
-- default value.
alter table bots add column top_p real;
