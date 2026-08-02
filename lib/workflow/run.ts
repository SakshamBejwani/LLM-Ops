import { randomUUID } from "node:crypto";
import { generateText, stepCountIs, jsonSchema, Output } from "ai";
import { ollama } from "@/lib/ollama/provider";
import { ollamaSemaphore } from "@/lib/ollama/queue";
import { withRetry } from "@/lib/ollama/retry";
import { emitEvent } from "@/lib/events/bus";
import { resolveTools } from "@/lib/tools";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildToolInstrumentation,
  persistRequest,
  runBotCompletion,
  fetchAllBots,
  type PendingToolCallRow,
} from "@/lib/chat/run";
import {
  validateGraph,
  resolveNextEdge,
  resolveBranchEdge,
  evaluateConditionNode,
  findParallelJoin,
  buildJsonSchema,
} from "@/lib/workflow/graph";
import { withAttachment } from "@/lib/attachments/client";
import { runJudge } from "@/lib/workflow/judge";
import { superviseBeforeNode, findEnclosingScope, applyOverride } from "@/lib/workflow/supervisor";
import type {
  Bot,
  Workflow,
  WorkflowBotNodeDefinition,
  WorkflowConditionNodeDefinition,
  WorkflowParallelNodeDefinition,
  WorkflowJudgeNodeDefinition,
  WorkflowNodeDefinition,
  WorkflowEdgeDefinition,
  SupervisorOverride,
} from "@/lib/types";

/** Per-run record of what each already-completed node produced, keyed by
 * node id - the supervisor's only window into "what the group has done so
 * far", since it has no access to the raw event bus. */
type MemberOutputs = Map<string, { label: string; status: "success" | "error"; output?: unknown; error?: string }>;

const MAX_STEPS = 5;

export type WorkflowAttachment = { name: string; content: string };

// The trigger's attachment is only ever given once, so we deterministically
// append it to every node's prompt rather than relying on the model choosing
// to call search_docs mid-chain - small local models are unreliable about
// that under generateText's forced Output.object mode.
function toPromptText(input: unknown, attachment?: WorkflowAttachment | null): string {
  const base =
    typeof input === "string" ? input : `Input from the previous step (JSON):\n${JSON.stringify(input, null, 2)}`;
  return attachment ? withAttachment(base, attachment.name, attachment.content) : base;
}

/**
 * Runs a single workflow node's underlying bot call. Mirrors
 * `runBotCompletion` (same queue/retry/bus-event/`requests`+`tool_calls`
 * persistence) but uses `generateText`'s `output` option so the model can
 * still call tools across multiple steps *and* produce a final object
 * validated against the node's schema - not `generateObject`, which can't
 * use tools at all.
 */
async function runWorkflowNode(params: {
  bot: Bot;
  allBots: Bot[];
  input: unknown;
  outputSchemaJson: Record<string, unknown>;
  workflowRunId: string;
  node: WorkflowBotNodeDefinition;
  stepIndex: number;
  branchLabel?: string | null;
  supervisorOverride?: SupervisorOverride | null;
  attachment?: WorkflowAttachment | null;
}): Promise<{ output: unknown }> {
  const {
    bot,
    allBots,
    input,
    outputSchemaJson,
    workflowRunId,
    node,
    stepIndex,
    branchLabel,
    supervisorOverride,
    attachment,
  } = params;
  const requestId = randomUUID();
  const startedAt = Date.now();
  const toolCallRows: PendingToolCallRow[] = [];
  const promptText = toPromptText(input, attachment);
  const promptPreview = promptText.slice(0, 200);
  const supabase = getSupabaseServerClient();

  const willQueue = !ollamaSemaphore.isFree;
  if (willQueue) {
    emitEvent({
      type: "request.queued",
      requestId,
      botId: bot.id,
      botName: bot.name,
      depth: 0,
      parentRequestId: null,
      promptPreview,
      timestamp: Date.now(),
    });
  }
  const release = await ollamaSemaphore.acquire();

  emitEvent({
    type: "workflow.node.start",
    workflowRunId,
    nodeId: node.id,
    stepIndex,
    requestId,
    botName: bot.name,
    timestamp: Date.now(),
  });

  try {
    emitEvent({
      type: "request.start",
      requestId,
      botId: bot.id,
      botName: bot.name,
      depth: 0,
      parentRequestId: null,
      promptPreview,
      timestamp: Date.now(),
    });

    const tools = await resolveTools({
      toolIds: bot.tool_ids,
      allBots,
      depth: 0,
      runBotCompletion,
      requestId,
    });
    const instrumentation = buildToolInstrumentation(requestId, toolCallRows);

    const result = await withRetry(
      () =>
        generateText({
          model: ollama(bot.model),
          system: bot.system_prompt,
          prompt: promptText,
          temperature: bot.temperature,
          topP: bot.top_p ?? undefined,
          tools,
          stopWhen: stepCountIs(MAX_STEPS),
          output: Output.object({ schema: jsonSchema(outputSchemaJson) }),
          ...instrumentation,
        }),
      {
        onRetry: (attempt, error) =>
          emitEvent({
            type: "request.retry",
            requestId,
            attempt,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
          }),
      },
    );

    const latencyMs = Date.now() - startedAt;
    const output = result.output;

    emitEvent({
      type: "request.end",
      requestId,
      latencyMs,
      ttftMs: null,
      tokensIn: result.usage.inputTokens ?? null,
      tokensOut: result.usage.outputTokens ?? null,
      status: "success",
      timestamp: Date.now(),
    });

    await persistRequest(
      {
        id: requestId,
        bot_id: bot.id,
        conversation_id: null,
        depth: 0,
        parent_request_id: null,
        prompt_preview: promptPreview,
        latency_ms: latencyMs,
        ttft_ms: null,
        tokens_in: result.usage.inputTokens ?? null,
        tokens_out: result.usage.outputTokens ?? null,
        status: "success",
        error: null,
      },
      toolCallRows,
    );

    const { error: nodeRunError } = await supabase.from("workflow_node_runs").insert({
      workflow_run_id: workflowRunId,
      node_id: node.id,
      bot_id: bot.id,
      step_index: stepIndex,
      branch_label: branchLabel ?? null,
      supervisor_override: supervisorOverride ?? null,
      request_id: requestId,
      input,
      output,
      status: "success",
      latency_ms: latencyMs,
    });
    if (nodeRunError) console.error("Failed to persist workflow_node_runs row:", nodeRunError.message);

    emitEvent({
      type: "workflow.node.end",
      workflowRunId,
      nodeId: node.id,
      status: "success",
      output,
      timestamp: Date.now(),
    });

    return { output };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);

    emitEvent({ type: "request.error", requestId, latencyMs, error: message, timestamp: Date.now() });
    await persistRequest(
      {
        id: requestId,
        bot_id: bot.id,
        conversation_id: null,
        depth: 0,
        parent_request_id: null,
        prompt_preview: promptPreview,
        latency_ms: latencyMs,
        ttft_ms: null,
        tokens_in: null,
        tokens_out: null,
        status: "error",
        error: message,
      },
      toolCallRows,
    );

    const { error: nodeRunError } = await supabase.from("workflow_node_runs").insert({
      workflow_run_id: workflowRunId,
      node_id: node.id,
      bot_id: bot.id,
      step_index: stepIndex,
      branch_label: branchLabel ?? null,
      supervisor_override: supervisorOverride ?? null,
      request_id: requestId,
      input,
      output: null,
      status: "error",
      error: message,
      latency_ms: latencyMs,
    });
    if (nodeRunError) console.error("Failed to persist workflow_node_runs error row:", nodeRunError.message);

    emitEvent({
      type: "workflow.node.end",
      workflowRunId,
      nodeId: node.id,
      status: "error",
      error: message,
      timestamp: Date.now(),
    });

    throw error;
  } finally {
    release();
  }
}

/**
 * Runs a condition node - no LLM call, just evaluates its clauses against
 * whatever data is currently flowing through the workflow and decides which
 * of its two fixed outputs (if/else) to take. Emits the same
 * `workflow.node.start`/`end` bus events as a bot node so the canvas
 * status ring behaves identically, and persists a `workflow_node_runs` row
 * with `bot_id`/`request_id` left null (both columns are nullable - no LLM
 * request backs this node).
 */
async function runConditionNode(params: {
  node: WorkflowConditionNodeDefinition;
  input: unknown;
  workflowRunId: string;
  stepIndex: number;
  branchLabel?: string | null;
}): Promise<{ branch: "if" | "else" }> {
  const { node, input, workflowRunId, stepIndex, branchLabel } = params;
  const startedAt = Date.now();
  const supabase = getSupabaseServerClient();

  emitEvent({
    type: "workflow.node.start",
    workflowRunId,
    nodeId: node.id,
    stepIndex,
    requestId: randomUUID(),
    botName: node.label ?? "Condition",
    timestamp: Date.now(),
  });

  const matched = evaluateConditionNode(node.combinator, node.clauses, input);
  const branch: "if" | "else" = matched ? "if" : "else";

  const { error: nodeRunError } = await supabase.from("workflow_node_runs").insert({
    workflow_run_id: workflowRunId,
    node_id: node.id,
    bot_id: null,
    step_index: stepIndex,
    branch_label: branchLabel ?? null,
    request_id: null,
    input,
    output: { branch },
    status: "success",
    latency_ms: Date.now() - startedAt,
  });
  if (nodeRunError) console.error("Failed to persist workflow_node_runs row:", nodeRunError.message);

  emitEvent({
    type: "workflow.node.end",
    workflowRunId,
    nodeId: node.id,
    status: "success",
    output: { branch },
    timestamp: Date.now(),
  });

  return { branch };
}

/**
 * Runs a `judge` node - an LLM-as-judge QA gate (see lib/workflow/judge.ts).
 * Grades `input` against the node's rubric (and, if configured, a
 * `referenceField` value pulled off `input`) and routes to its fixed
 * "pass"/"fail" outputs, same fixed-branch shape as a condition node's
 * if/else. Passes `input` straight through unchanged - a judge only routes,
 * it doesn't transform data.
 */
async function runJudgeNode(params: {
  node: WorkflowJudgeNodeDefinition;
  input: unknown;
  workflowRunId: string;
  stepIndex: number;
  branchLabel?: string | null;
}): Promise<{ branch: "pass" | "fail" }> {
  const { node, input, workflowRunId, stepIndex, branchLabel } = params;
  const startedAt = Date.now();
  const supabase = getSupabaseServerClient();

  emitEvent({
    type: "workflow.node.start",
    workflowRunId,
    nodeId: node.id,
    stepIndex,
    requestId: randomUUID(),
    botName: node.label ?? "Judge",
    timestamp: Date.now(),
  });

  const reference =
    node.referenceField && typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)[node.referenceField]
      : undefined;

  try {
    const verdict = await runJudge({ model: node.model, rubric: node.rubric, input, reference });

    const { error: nodeRunError } = await supabase.from("workflow_node_runs").insert({
      workflow_run_id: workflowRunId,
      node_id: node.id,
      bot_id: null,
      step_index: stepIndex,
      branch_label: branchLabel ?? null,
      request_id: null,
      input,
      output: verdict,
      status: "success",
      latency_ms: Date.now() - startedAt,
    });
    if (nodeRunError) console.error("Failed to persist workflow_node_runs row:", nodeRunError.message);

    emitEvent({
      type: "workflow.node.end",
      workflowRunId,
      nodeId: node.id,
      status: "success",
      output: verdict,
      timestamp: Date.now(),
    });

    return { branch: verdict.verdict };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const { error: nodeRunError } = await supabase.from("workflow_node_runs").insert({
      workflow_run_id: workflowRunId,
      node_id: node.id,
      bot_id: null,
      step_index: stepIndex,
      branch_label: branchLabel ?? null,
      request_id: null,
      input,
      output: null,
      status: "error",
      error: message,
      latency_ms: Date.now() - startedAt,
    });
    if (nodeRunError) console.error("Failed to persist workflow_node_runs error row:", nodeRunError.message);

    emitEvent({
      type: "workflow.node.end",
      workflowRunId,
      nodeId: node.id,
      status: "error",
      error: message,
      timestamp: Date.now(),
    });

    throw error;
  }
}

/**
 * Runs a `parallel` node - no LLM call, just fans out. Each wired-up branch
 * runs its own sub-chain concurrently (via `runChainFrom`) against the same
 * input, all the way to the matching join node; unwired branches are simply
 * skipped. Persists a passthrough `workflow_node_runs` row like a condition
 * node, then returns each branch's terminal output keyed by its `branchId`
 * so the join step can merge them.
 */
async function runParallelNode(params: {
  node: WorkflowParallelNodeDefinition;
  input: unknown;
  workflow: Workflow;
  workflowRunId: string;
  stepIndex: number;
  stepCounter: { value: number };
  allBots: Bot[];
  memberOutputs: MemberOutputs;
  attachment?: WorkflowAttachment | null;
}): Promise<Record<string, unknown>> {
  const { node, input, workflow, workflowRunId, stepIndex, stepCounter, allBots, memberOutputs, attachment } = params;
  const startedAt = Date.now();
  const supabase = getSupabaseServerClient();

  emitEvent({
    type: "workflow.node.start",
    workflowRunId,
    nodeId: node.id,
    stepIndex,
    requestId: randomUUID(),
    botName: node.label ?? "Parallel",
    timestamp: Date.now(),
  });

  const branchOutputs = await Promise.all(
    node.branchIds.map(async (branchId) => {
      const startEdge = workflow.edges.find((e) => e.source === node.id && e.branch === branchId);
      if (!startEdge) return null;
      const result = await runChainFrom({
        nodeId: startEdge.target,
        input,
        workflow,
        workflowRunId,
        allBots,
        memberOutputs,
        attachment,
        branchLabel: branchId,
        stopAtJoin: findParallelJoin(node.id, workflow.nodes, workflow.edges),
        stepCounter,
      });
      return { branchId, output: result.output };
    }),
  );

  const merged: Record<string, unknown> = {};
  for (const branch of branchOutputs) {
    if (branch) merged[branch.branchId] = branch.output;
  }

  const { error: nodeRunError } = await supabase.from("workflow_node_runs").insert({
    workflow_run_id: workflowRunId,
    node_id: node.id,
    bot_id: null,
    step_index: stepIndex,
    branch_label: null,
    request_id: null,
    input,
    output: merged,
    status: "success",
    latency_ms: Date.now() - startedAt,
  });
  if (nodeRunError) console.error("Failed to persist workflow_node_runs row:", nodeRunError.message);

  emitEvent({
    type: "workflow.node.end",
    workflowRunId,
    nodeId: node.id,
    status: "success",
    output: merged,
    timestamp: Date.now(),
  });

  return merged;
}

/**
 * Runs a `join` node - the barrier point a `parallel` node's branches were
 * already run up to (see `runParallelNode`/`runChainFrom`'s `stopAtJoin`).
 * By the time this is reached, `input` is already the merged
 * `{ [branchId]: output }` object; this just persists that as the join's own
 * row and passes it through unchanged.
 */
async function runJoinNode(params: {
  nodeId: string;
  label?: string;
  input: unknown;
  workflowRunId: string;
  stepIndex: number;
}): Promise<void> {
  const { nodeId, label, input, workflowRunId, stepIndex } = params;
  const startedAt = Date.now();
  const supabase = getSupabaseServerClient();

  emitEvent({
    type: "workflow.node.start",
    workflowRunId,
    nodeId,
    stepIndex,
    requestId: randomUUID(),
    botName: label ?? "Join",
    timestamp: Date.now(),
  });

  const { error: nodeRunError } = await supabase.from("workflow_node_runs").insert({
    workflow_run_id: workflowRunId,
    node_id: nodeId,
    bot_id: null,
    step_index: stepIndex,
    branch_label: null,
    request_id: null,
    input,
    output: input,
    status: "success",
    latency_ms: Date.now() - startedAt,
  });
  if (nodeRunError) console.error("Failed to persist workflow_node_runs row:", nodeRunError.message);

  emitEvent({
    type: "workflow.node.end",
    workflowRunId,
    nodeId,
    status: "success",
    output: input,
    timestamp: Date.now(),
  });
}

/**
 * Runs a workflow's chain starting at `nodeId`, feeding each node's output
 * forward as the next node's input, until it either runs out of outgoing
 * edges or (when running inside a parallel branch) reaches `stopAtJoin` -
 * that join is left for the parallel node's caller to run once, after every
 * branch has produced its output (see `runParallelNode`). `stepCounter` is a
 * shared mutable counter so concurrently-running branches still get distinct,
 * monotonically increasing `step_index` values for the live/history views.
 */
async function runChainFrom(params: {
  nodeId: string;
  input: unknown;
  workflow: Workflow;
  workflowRunId: string;
  allBots: Bot[];
  memberOutputs: MemberOutputs;
  attachment?: WorkflowAttachment | null;
  branchLabel?: string;
  stopAtJoin?: string;
  stepCounter: { value: number };
}): Promise<{ output: unknown }> {
  const { workflow, workflowRunId, allBots, memberOutputs, attachment, branchLabel, stopAtJoin, stepCounter } = params;
  const nodeById = new Map(workflow.nodes.map((n) => [n.id, n]));

  let currentInput = params.input;
  let current: WorkflowNodeDefinition | undefined = nodeById.get(params.nodeId);

  while (current) {
    if (current.id === stopAtJoin) return { output: currentInput };

    const node = current;
    const stepIndex = stepCounter.value++;
    let nextEdge: WorkflowEdgeDefinition | undefined;

    if (node.kind === "condition") {
      const { branch } = await runConditionNode({ node, input: currentInput, workflowRunId, stepIndex, branchLabel });
      // A condition node routes, it doesn't transform data - currentInput
      // passes through unchanged to whichever branch is taken.
      nextEdge = resolveBranchEdge(node.id, workflow.edges, branch);
    } else if (node.kind === "parallel") {
      currentInput = await runParallelNode({
        node,
        input: currentInput,
        workflow,
        workflowRunId,
        stepIndex,
        stepCounter,
        allBots,
        memberOutputs,
        attachment,
      });
      const joinId = findParallelJoin(node.id, workflow.nodes, workflow.edges);
      current = joinId ? nodeById.get(joinId) : undefined;
      continue;
    } else if (node.kind === "join") {
      await runJoinNode({ nodeId: node.id, label: node.label, input: currentInput, workflowRunId, stepIndex });
      nextEdge = resolveNextEdge(node.id, workflow.edges, currentInput);
    } else if (node.kind === "judge") {
      const { branch } = await runJudgeNode({ node, input: currentInput, workflowRunId, stepIndex, branchLabel });
      // Same as a condition node - a judge routes, it doesn't transform data.
      nextEdge = resolveBranchEdge(node.id, workflow.edges, branch);
    } else if (node.kind === "supervisor_scope") {
      // Never targeted by an edge (validateGraph excludes it from the
      // chain) - defensive only.
      current = undefined;
      continue;
    } else {
      const bot = allBots.find((b) => b.id === node.botId);
      if (!bot) throw new Error(`Bot not found for node "${node.label ?? node.id}".`);

      const scope = findEnclosingScope(node.id, workflow.nodes);
      let effectiveBot = bot;
      let supervisorOverride: SupervisorOverride | null = null;
      if (scope) {
        const memberHistory = scope.memberNodeIds
          .filter((id) => id !== node.id)
          .map((id) => memberOutputs.get(id))
          .filter((entry): entry is NonNullable<typeof entry> => !!entry);
        const decision = await superviseBeforeNode({ scope, nextBot: bot, memberHistory });
        if (decision) {
          supervisorOverride = decision.override;
          effectiveBot = applyOverride(bot, decision.override);
          emitEvent({
            type: "supervisor.override",
            workflowRunId,
            scopeId: scope.id,
            nodeId: node.id,
            botName: bot.name,
            override: decision.override,
            reasoning: decision.reasoning,
            timestamp: Date.now(),
          });
        }
      }

      const outputSchemaJson = buildJsonSchema(node.outputSchema);
      const { output } = await runWorkflowNode({
        bot: effectiveBot,
        allBots,
        input: currentInput,
        outputSchemaJson,
        workflowRunId,
        node,
        stepIndex,
        branchLabel,
        supervisorOverride,
        attachment,
      });
      memberOutputs.set(node.id, { label: node.label ?? bot.name, status: "success", output });
      currentInput = output;
      nextEdge = resolveNextEdge(node.id, workflow.edges, output);
    }

    current = nextEdge ? nodeById.get(nextEdge.target) : undefined;
  }

  return { output: currentInput };
}

/**
 * Runs an entire workflow from its root. Expects the caller to have already
 * inserted the `workflow_runs` row (status 'running') so it exists the
 * instant the triggering API response returns - this function only updates
 * it at the end. Never throws; failures are recorded on the run/node rows
 * and surfaced via `workflow.run.end`.
 */
export async function runWorkflow(params: {
  workflow: Workflow;
  workflowRunId: string;
  triggerMessage: string;
  attachment?: WorkflowAttachment | null;
}): Promise<void> {
  const { workflow, workflowRunId, triggerMessage, attachment } = params;
  const supabase = getSupabaseServerClient();
  const startedAt = Date.now();

  emitEvent({ type: "workflow.run.start", workflowRunId, workflowId: workflow.id, timestamp: Date.now() });

  const finish = async (status: "success" | "error", error?: string) => {
    await supabase
      .from("workflow_runs")
      .update({
        status,
        error: error ?? null,
        finished_at: new Date().toISOString(),
        latency_ms: Date.now() - startedAt,
      })
      .eq("id", workflowRunId);
    emitEvent({ type: "workflow.run.end", workflowRunId, status, error, timestamp: Date.now() });
  };

  try {
    validateGraph(workflow.nodes, workflow.edges);
  } catch (error) {
    await finish("error", error instanceof Error ? error.message : String(error));
    return;
  }

  const targetIds = new Set(workflow.edges.map((e) => e.target));
  const root = workflow.nodes.find((n) => n.kind !== "supervisor_scope" && !targetIds.has(n.id));
  if (!root) {
    await finish("error", "No starting bot found - the workflow has a cycle.");
    return;
  }

  try {
    const allBots = await fetchAllBots();
    await runChainFrom({
      nodeId: root.id,
      input: triggerMessage,
      workflow,
      workflowRunId,
      allBots,
      memberOutputs: new Map(),
      attachment,
      stepCounter: { value: 0 },
    });
    await finish("success");
  } catch (error) {
    await finish("error", error instanceof Error ? error.message : String(error));
  }
}
