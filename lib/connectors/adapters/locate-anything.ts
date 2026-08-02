import { z } from "zod";
import { tool } from "ai";
import type { VisionGroundingConfig } from "../types";

const REQUEST_TIMEOUT_MS = 60_000;

export type Detection = {
  label?: string;
  box?: [number, number, number, number];
  point?: [number, number];
};

// Strips filler phrasing around a detection's label, e.g. "the red mug is
// located at" -> "the red mug". Best-effort - the model's actual label
// format is unverified (see parseLocations below).
const LABEL_STOPWORDS = /\b(is located at|located at|at)\s*$/i;

/**
 * Pulls `<box> x1, y1, x2, y2 </box>` (bounding box) and `<box> x, y </box>`
 * (point) tags out of a VLM grounding response, pairing each with whatever
 * label-like text preceded it.
 *
 * Unverified against real LocateAnything-3B output (no live model to test
 * against yet): both the tag/label structure (is a label always immediately
 * before its `<box>`? one detection per line? could labels use a different
 * wrapper like `<ref>...</ref>`?) and the coordinate space (pixel vs.
 * normalized 0-1000, the convention used by the Qwen2-VL family this model's
 * backbone descends from) are assumptions, not confirmed facts. Numbers are
 * returned as-is, not normalized/interpreted - adjust this parser once the
 * model is actually running.
 */
export function parseLocations(raw: string): Detection[] {
  const detections: Detection[] = [];
  const tagPattern = /<box>\s*([\d.,\s]+?)\s*<\/box>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(raw)) !== null) {
    const numbers = match[1]
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n));

    const labelText = raw.slice(lastIndex, match.index).replace(LABEL_STOPWORDS, "").trim();
    const label = labelText.length > 0 ? labelText : undefined;

    if (numbers.length === 4) {
      detections.push({ label, box: [numbers[0], numbers[1], numbers[2], numbers[3]] });
    } else if (numbers.length === 2) {
      detections.push({ label, point: [numbers[0], numbers[1]] });
    }
    // Any other count of numbers inside the tag is unparseable - skipped
    // rather than guessed at; `raw` is still returned alongside `detections`
    // so nothing is silently lost.

    lastIndex = tagPattern.lastIndex;
  }

  return detections;
}

export function buildTool(config: VisionGroundingConfig) {
  return tool({
    description:
      "Locate objects/regions in an image via a self-hosted vision-grounding model (e.g. NVIDIA LocateAnything-3B). " +
      "Returns bounding boxes/points plus the raw model text; coordinate units (pixel vs. normalized) are not " +
      "guaranteed - treat them as approximate. Only call this with a real image URL already present in context, " +
      "never a fabricated one.",
    inputSchema: z.object({
      imageUrl: z.string().url().describe("A URL the vision-grounding server can fetch - not necessarily this app."),
      query: z.string().describe('What to locate, e.g. "the red mug" or "all traffic signs".'),
    }),
    execute: async ({ imageUrl, query }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch(`${config.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: query },
                  { type: "image_url", image_url: { url: imageUrl } },
                ],
              },
            ],
            max_tokens: 512,
            temperature: 0,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Vision grounding request failed: ${res.status} ${await res.text()}`);
        }

        const data = await res.json();
        const raw: string = data.choices?.[0]?.message?.content ?? "";
        return { raw, detections: parseLocations(raw) };
      } finally {
        clearTimeout(timeout);
      }
    },
  });
}
