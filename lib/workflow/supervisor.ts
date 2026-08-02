import { generateText, Output } from "ai";
import { z } from "zod";
import { ollama } from "@/lib/ollama/provider";
import { withRetry } from "@/lib/ollama/retry";
import type {
  Bot,
  SupervisorBounds,
  SupervisorOverride,
  WorkflowNodeDefinition,
  WorkflowSupervisorScopeDefinition,
} from "@/lib/types";

const overrideSchema = z.object({
  intervene: z.boolean(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  systemPromptAddendum: z.string().optional(),
  reasoning: z.string(),
});

function clamp(value: number, bounds?: [number, number]): number {
  if (!bounds) return value;
  const [min, max] = bounds;
  return Math.min(max, Math.max(min, value));
}

/** Applies a supervisor's override to `bot`'s effective params for a single
 * run, clamped to the scope's configured bounds - never mutates `bot` itself. */
export function applyOverride(bot: Bot, override: SupervisorOverride): Bot {
  return {
    ...bot,
    temperature: override.temperature ?? bot.temperature,
    top_p: override.top_p ?? bot.top_p,
    system_prompt: override.systemPromptAddendum
      ? `${bot.system_prompt}\n\n${override.systemPromptAddendum}`
      : bot.system_prompt,
  };
}

/**
 * The "master LLM": reviews recent activity from a supervisor scope's other
 * member bots (their outputs/errors so far this run) against the scope's
 * free-text `instructions`, and decides whether to adjust the *next* member
 * bot's temperature/top_p/system prompt before it runs. Ollama calls are a
 * single blocking request each, so this can only act *between* node runs,
 * never mid-generation - see the design note in lib/workflow/run.ts.
 * Returns `null` when the supervisor chooses not to intervene.
 */
export async function superviseBeforeNode(params: {
  scope: WorkflowSupervisorScopeDefinition;
  nextBot: Bot;
  memberHistory: { label: string; status: string; output?: unknown; error?: string }[];
}): Promise<{ override: SupervisorOverride; reasoning: string } | null> {
  const { scope, nextBot, memberHistory } = params;

  const historyText =
    memberHistory.length === 0
      ? "(no other member bots have run yet in this workflow run)"
      : memberHistory
          .map((h) => `- ${h.label}: ${h.status}${h.error ? ` (error: ${h.error})` : ` -> ${JSON.stringify(h.output)}`}`)
          .join("\n");

  const prompt = [
    "You are a supervisor watching a group of bots collaborate in a workflow run.",
    `Your instructions: ${scope.instructions || "Use your judgment to keep the group on track."}`,
    "",
    "What the other bots in your group have done so far in this run:",
    historyText,
    "",
    `The next bot about to run is "${nextBot.name}", currently configured with temperature=${nextBot.temperature}` +
      (nextBot.top_p != null ? `, top_p=${nextBot.top_p}` : ", top_p=unset") +
      ".",
    "Decide whether to intervene. If the group is on track, set intervene=false and leave the other fields empty.",
    "If you intervene, only set the fields you want to change (temperature, top_p, and/or a short addendum to append to its system prompt) and always give a one-sentence reasoning.",
  ].join("\n");

  const result = await withRetry(() =>
    generateText({
      model: ollama(scope.model),
      prompt,
      temperature: 0,
      output: Output.object({ schema: overrideSchema }),
    }),
  );

  const verdict = result.output;
  if (!verdict.intervene) return null;

  const override: SupervisorOverride = {
    temperature: verdict.temperature !== undefined ? clamp(verdict.temperature, scope.bounds.temperature) : undefined,
    top_p: verdict.top_p !== undefined ? clamp(verdict.top_p, scope.bounds.top_p) : undefined,
    systemPromptAddendum: verdict.systemPromptAddendum,
  };
  return { override, reasoning: verdict.reasoning };
}

export function findEnclosingScope(
  nodeId: string,
  nodes: WorkflowNodeDefinition[],
): WorkflowSupervisorScopeDefinition | undefined {
  return nodes.find(
    (n): n is WorkflowSupervisorScopeDefinition =>
      n.kind === "supervisor_scope" && n.memberNodeIds.includes(nodeId),
  );
}

export type { SupervisorBounds };
