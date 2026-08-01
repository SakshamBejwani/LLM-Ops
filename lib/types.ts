export type Bot = {
  id: string;
  name: string;
  system_prompt: string;
  model: string;
  temperature: number;
  tool_ids: string[];
  created_at: string;
};

export type BuiltInToolId = "calculator" | "get_weather" | "search_docs";

export type RunBotCompletion = (params: {
  bot: Bot;
  input: string;
  depth: number;
  parentRequestId: string | null;
}) => Promise<string>;

export type ToolOption = {
  /** Built-in tool id, or `bot:<uuid>` for another bot attached as a tool. */
  id: string;
  kind: "builtin" | "bot";
  name: string;
  description: string;
};

export type RequestStatus = "running" | "success" | "error";

export type ToolCallDisplay = {
  id: string;
  toolName: string;
  input: unknown;
  output: unknown;
  durationMs: number | null;
};

export type RequestRecord = {
  id: string;
  bot_id: string | null;
  bot_name?: string | null;
  conversation_id: string | null;
  depth: number;
  parent_request_id: string | null;
  prompt_preview: string | null;
  latency_ms: number | null;
  ttft_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  status: RequestStatus;
  error: string | null;
  created_at: string;
  tool_calls?: ToolCallDisplay[];
  text?: string;
  reasoning?: string;
};

export type ToolCallRecord = {
  id: string;
  request_id: string;
  tool_name: string;
  input: unknown;
  output: unknown;
  duration_ms: number | null;
  created_at: string;
};

/** Unified shape the request-details dialog renders, built from either a live
 * in-flight request or a persisted history row. */
export type RequestDetailsView = {
  requestId: string;
  botName: string | null;
  status: "queued" | "running" | "success" | "error";
  depth: number;
  parentRequestId: string | null;
  promptPreview: string | null;
  latencyMs: number | null;
  ttftMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  error: string | null;
  text?: string;
  reasoning?: string;
  createdAt?: string;
  toolCalls: ToolCallDisplay[];
};

export type BusEvent =
  | {
      type: "request.queued";
      requestId: string;
      botId: string;
      botName: string;
      depth: number;
      parentRequestId: string | null;
      promptPreview: string;
      timestamp: number;
    }
  | {
      type: "request.start";
      requestId: string;
      botId: string;
      botName: string;
      depth: number;
      parentRequestId: string | null;
      promptPreview: string;
      timestamp: number;
    }
  | { type: "request.ttft"; requestId: string; ttftMs: number; timestamp: number }
  | { type: "request.retry"; requestId: string; attempt: number; error: string; timestamp: number }
  | {
      type: "request.delta";
      requestId: string;
      kind: "text" | "reasoning";
      delta: string;
      timestamp: number;
    }
  | {
      type: "tool.start";
      requestId: string;
      toolCallId: string;
      toolName: string;
      input: unknown;
      timestamp: number;
    }
  | {
      type: "tool.end";
      requestId: string;
      toolCallId: string;
      output: unknown;
      durationMs: number;
      timestamp: number;
    }
  | {
      type: "request.end";
      requestId: string;
      latencyMs: number;
      ttftMs: number | null;
      tokensIn: number | null;
      tokensOut: number | null;
      status: "success";
      timestamp: number;
    }
  | { type: "request.error"; requestId: string; latencyMs: number; error: string; timestamp: number }
  | { type: "workflow.run.start"; workflowRunId: string; workflowId: string; timestamp: number }
  | {
      type: "workflow.run.end";
      workflowRunId: string;
      status: "success" | "error";
      error?: string;
      timestamp: number;
    }
  | {
      type: "workflow.node.start";
      workflowRunId: string;
      nodeId: string;
      stepIndex: number;
      requestId: string;
      botName: string;
      timestamp: number;
    }
  | {
      type: "workflow.node.end";
      workflowRunId: string;
      nodeId: string;
      status: "success" | "error";
      output?: unknown;
      error?: string;
      timestamp: number;
    };

// --- Workflows -------------------------------------------------------------

export type WorkflowFieldType = "string" | "number" | "boolean";

export type WorkflowSchemaField = {
  name: string;
  type: WorkflowFieldType;
  description?: string;
};

/** A small, UI-buildable subset of JSON Schema - a flat object of primitive
 * fields. Converted to a real JSON Schema at execution time (lib/workflow/graph.ts). */
export type WorkflowOutputSchema = {
  fields: WorkflowSchemaField[];
};

export type WorkflowBotNodeDefinition = {
  id: string;
  kind?: "bot";
  botId: string;
  label?: string;
  outputSchema: WorkflowOutputSchema;
  position: { x: number; y: number };
};

export type WorkflowConditionClause = {
  /** Free-typed field name to look up on whatever data is flowing through -
   * not necessarily a direct parent's outputSchema, see lib/workflow/graph.ts. */
  field: string;
  operator: "equals" | "not_equals" | "contains";
  value: string;
};

export type WorkflowConditionNodeDefinition = {
  id: string;
  kind: "condition";
  label?: string;
  combinator: "AND" | "OR";
  clauses: WorkflowConditionClause[];
  position: { x: number; y: number };
};

export type WorkflowNodeDefinition = WorkflowBotNodeDefinition | WorkflowConditionNodeDefinition;

export type WorkflowEdgeCondition = {
  /** Must match a WorkflowSchemaField.name on the source node's outputSchema. */
  field: string;
  operator: "equals" | "not_equals" | "contains";
  value: string;
};

export type WorkflowEdgeDefinition = {
  id: string;
  source: string;
  target: string;
  /** Only valid when the source is a bot node. Absent = the default/"else"
   * edge - at most one per source node. */
  condition?: WorkflowEdgeCondition;
  /** Only valid when the source is a condition node - which of its two fixed
   * outputs this edge represents. */
  branch?: "if" | "else";
};

export type Workflow = {
  id: string;
  name: string;
  description: string | null;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdgeDefinition[];
  created_at: string;
  updated_at: string;
};

export type WorkflowRunStatus = "running" | "success" | "error";

export type WorkflowRunRecord = {
  id: string;
  workflow_id: string | null;
  trigger_message: string;
  status: WorkflowRunStatus;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  latency_ms: number | null;
};

export type WorkflowNodeRunRecord = {
  id: string;
  workflow_run_id: string;
  node_id: string;
  bot_id: string | null;
  bot_name?: string | null;
  step_index: number;
  request_id: string | null;
  input: unknown;
  output: unknown;
  status: WorkflowRunStatus;
  error: string | null;
  latency_ms: number | null;
  created_at: string;
  tool_calls?: ToolCallDisplay[];
};
