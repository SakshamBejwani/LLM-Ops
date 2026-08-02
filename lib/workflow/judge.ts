import { generateText, Output } from "ai";
import { z } from "zod";
import { ollama } from "@/lib/ollama/provider";
import { withRetry } from "@/lib/ollama/retry";

const judgeVerdictSchema = z.object({
  verdict: z.enum(["pass", "fail"]),
  score: z.number().min(0).max(1),
  rationale: z.string(),
});

export type JudgeVerdict = z.infer<typeof judgeVerdictSchema>;

/**
 * A reusable LLM-as-judge call: grades `input` against a free-text `rubric`
 * (and an optional `reference` "known good" answer), forced into a strict
 * pass/fail + score + rationale shape via `Output.object` - not free text -
 * so callers (a workflow Judge node, or the supervisor scope) can branch on
 * `verdict` programmatically. Always runs at temperature 0 for reproducible
 * grading, per the standard LLM-as-judge recommendation.
 */
export async function runJudge(params: {
  model: string;
  rubric: string;
  input: unknown;
  reference?: unknown;
}): Promise<JudgeVerdict> {
  const { model, rubric, input, reference } = params;

  const prompt = [
    "You are grading a single piece of output against a rubric. Be strict and consistent.",
    "",
    `Rubric:\n${rubric}`,
    reference !== undefined ? `\nReference (known-good) answer:\n${JSON.stringify(reference, null, 2)}` : "",
    `\nOutput to grade:\n${typeof input === "string" ? input : JSON.stringify(input, null, 2)}`,
    "\nReturn a verdict ('pass' or 'fail'), a score from 0 to 1, and a one-sentence rationale.",
  ].join("\n");

  const result = await withRetry(() =>
    generateText({
      model: ollama(model),
      prompt,
      temperature: 0,
      output: Output.object({ schema: judgeVerdictSchema }),
    }),
  );

  return result.output;
}
