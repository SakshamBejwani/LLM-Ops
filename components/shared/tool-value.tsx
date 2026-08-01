function formatPrimitive(value: unknown): string {
  if (value === null || value === undefined) return "–";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Renders a tool/node input-output value without raw JSON syntax. A
 * single-key object (the common shape for built-in tools, bot-delegate
 * tools, and workflow node input `{ message: "..." }`) unwraps to just its
 * value, since the surrounding "Input"/"Output" label already says what it
 * is. Multi-key objects (e.g. calculator's `{ expression, result }`, or a
 * workflow node's multi-field structured output) render as a labeled
 * key/value list instead.
 */
export function ToolValue({ value }: { value: unknown }) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 1) {
      return <ToolValue value={entries[0][1]} />;
    }
    return (
      <dl className="space-y-1">
        {entries.map(([key, val]) => (
          <div key={key} className="flex gap-1.5">
            <dt className="shrink-0 text-muted-foreground">{key}:</dt>
            <dd className="break-words">{formatPrimitive(val)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return <p className="break-words whitespace-pre-wrap">{formatPrimitive(value)}</p>;
}
