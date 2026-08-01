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
  buildJsonSchema,
} from "@/lib/workflow/graph";
import { withAttachment } from "@/lib/attachments/client";
import type { Bot, Workflow, WorkflowBotNodeDefinition, WorkflowConditionNodeDefinition, WorkflowEdgeDefinition, WorkflowNodeDefinition } from "@/lib/types";

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
  attachment?: WorkflowAttachment | null;
}): Promise<{ output: unknown }> {
  const { bot, allBots, input, outputSchemaJson, workflowRunId, node, stepIndex, attachment } = params;
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

    const tools = resolveTools({
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
}): Promise<{ branch: "if" | "else" }> {
  const { node, input, workflowRunId, stepIndex } = params;
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
 * Runs every node in a workflow's chain in order, feeding each node's output
 * forward as the next node's input. Expects the caller to have already
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

  const nodeById = new Map(workflow.nodes.map((n) => [n.id, n]));
  const targetIds = new Set(workflow.edges.map((e) => e.target));
  const root = workflow.nodes.find((n) => !targetIds.has(n.id));
  if (!root) {
    await finish("error", "No starting bot found - the workflow has a cycle.");
    return;
  }

  try {
    const allBots = await fetchAllBots();
    let currentInput: unknown = triggerMessage;
    let current: WorkflowNodeDefinition | undefined = root;
    let stepIndex = 0;

    while (current) {
      const node = current;
      let nextEdge: WorkflowEdgeDefinition | undefined;

      if (node.kind === "condition") {
        const { branch } = await runConditionNode({ node, input: currentInput, workflowRunId, stepIndex });
        // A condition node routes, it doesn't transform data - currentInput
        // passes through unchanged to whichever branch is taken.
        nextEdge = resolveBranchEdge(node.id, workflow.edges, branch);
      } else {
        const bot = allBots.find((b) => b.id === node.botId);
        if (!bot) throw new Error(`Bot not found for node "${node.label ?? node.id}".`);
        const outputSchemaJson = buildJsonSchema(node.outputSchema);
        const { output } = await runWorkflowNode({
          bot,
          allBots,
          input: currentInput,
          outputSchemaJson,
          workflowRunId,
          node,
          stepIndex,
          attachment,
        });
        currentInput = output;
        nextEdge = resolveNextEdge(node.id, workflow.edges, output);
      }

      stepIndex += 1;
      current = nextEdge ? nodeById.get(nextEdge.target) : undefined;
    }

    await finish("success");
  } catch (error) {
    await finish("error", error instanceof Error ? error.message : String(error));
  }
}
