"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ToolValue } from "@/components/shared/tool-value";
import { fmtMs } from "@/lib/format";
import type { RequestDetailsView } from "@/lib/types";

export function RequestDetailsDialog({
  request,
  onOpenChange,
}: {
  request: RequestDetailsView | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={request !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {request && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {request.botName ?? "Unknown bot"}
                <Badge variant={request.status === "error" ? "destructive" : "outline"}>
                  {request.status}
                </Badge>
                {request.depth > 0 && <Badge variant="outline">depth {request.depth}</Badge>}
              </DialogTitle>
              <DialogDescription>
                {request.requestId}
                {request.parentRequestId ? ` · parent ${request.parentRequestId}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Latency</p>
                <p>{fmtMs(request.latencyMs)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">TTFT</p>
                <p>{fmtMs(request.ttftMs)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tokens in</p>
                <p>{request.tokensIn ?? "–"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tokens out</p>
                <p>{request.tokensOut ?? "–"}</p>
              </div>
            </div>

            {request.promptPreview && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Prompt</p>
                <p className="rounded-md bg-muted/50 p-2 text-sm whitespace-pre-wrap">
                  {request.promptPreview}
                </p>
              </div>
            )}

            {request.reasoning && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Thinking</p>
                <p className="max-h-40 overflow-y-auto rounded-md bg-muted/50 p-2 text-xs italic whitespace-pre-wrap">
                  {request.reasoning}
                </p>
              </div>
            )}

            {request.text && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Output</p>
                <p className="max-h-40 overflow-y-auto rounded-md bg-muted/50 p-2 text-sm whitespace-pre-wrap">
                  {request.text}
                </p>
              </div>
            )}

            {request.error && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Error</p>
                <p className="rounded-md bg-destructive/10 p-2 text-sm whitespace-pre-wrap text-destructive">
                  {request.error}
                </p>
              </div>
            )}

            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                Tool calls{request.toolCalls.length > 0 ? ` (${request.toolCalls.length})` : ""}
              </p>
              {request.toolCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {request.toolCalls.map((call) => (
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
