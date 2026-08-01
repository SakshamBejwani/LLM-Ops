import { Badge } from "@/components/ui/badge";
import { ToolValue } from "@/components/shared/tool-value";
import { fmtMs } from "@/lib/format";

export type NodeRunCardToolCall = {
  id: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  durationMs?: number | null;
};

export function NodeRunCard({
  botName,
  status,
  latencyMs,
  input,
  output,
  error,
  toolCalls,
}: {
  botName: string;
  status: "idle" | "running" | "success" | "error";
  latencyMs?: number | null;
  input?: unknown;
  output?: unknown;
  error?: string | null;
  toolCalls: NodeRunCardToolCall[];
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{botName}</span>
        <Badge variant={status === "error" ? "destructive" : "outline"}>{status}</Badge>
        {latencyMs != null && <span className="text-xs text-muted-foreground">{fmtMs(latencyMs)}</span>}
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Input</p>
          <div className="rounded bg-muted/50 p-2">
            <ToolValue value={input} />
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Output</p>
          <div className="rounded bg-muted/50 p-2">
            <ToolValue value={error ?? output} />
          </div>
        </div>
      </div>

      <div className="mt-2">
        <p className="mb-1 text-xs text-muted-foreground">
          Tool calls{toolCalls.length > 0 ? ` (${toolCalls.length})` : ""}
        </p>
        {toolCalls.length === 0 ? (
          <p className="text-xs text-muted-foreground">None.</p>
        ) : (
          <div className="space-y-2">
            {toolCalls.map((call) => (
              <div key={call.id} className="rounded-md border p-2 text-xs">
                <div className="mb-2 flex items-center justify-between">
                  <Badge variant="secondary">{call.toolName}</Badge>
                  <span className="text-muted-foreground">{fmtMs(call.durationMs)}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 font-medium text-muted-foreground">Input</p>
                    <div className="rounded bg-muted/50 p-1.5">
                      <ToolValue value={call.input} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-muted-foreground">Output</p>
                    <div className="rounded bg-muted/50 p-1.5">
                      <ToolValue value={call.output} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
