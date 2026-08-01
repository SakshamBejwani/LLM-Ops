"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PlaygroundColumn } from "@/components/playground/playground-column";
import { NestedRunCards } from "@/components/playground/nested-run-cards";
import { TerminalLog } from "@/components/playground/terminal-log";
import { RequestDetailsDialog } from "@/components/dashboard/request-details-dialog";
import { AttachmentChip, AttachmentPickerButton } from "@/components/chat/attachment-field";
import { ingestAttachment, withAttachment } from "@/lib/attachments/client";
import { useObservabilityStore } from "@/lib/stores/observability-store";
import type { Bot, RequestDetailsView } from "@/lib/types";

export default function PlaygroundPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [runPrompt, setRunPrompt] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [runToken, setRunToken] = useState(0);
  const [details, setDetails] = useState<RequestDetailsView | null>(null);
  const clearRawEvents = useObservabilityStore((s) => s.clearRawEvents);

  useEffect(() => {
    fetch("/api/bots")
      .then((res) => res.json())
      .then((data: { bots: Bot[] }) => setBots(data.bots ?? []));
  }, []);

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((v) => v !== id)));
  };

  const handleRun = async () => {
    if (!prompt.trim() || selected.length === 0 || attaching) return;

    let text = prompt;
    if (attachedFile) {
      setAttaching(true);
      try {
        const content = await ingestAttachment(attachedFile);
        text = withAttachment(prompt, attachedFile.name, content);
      } catch {
        setAttachError("Failed to attach file - running without it.");
      } finally {
        setAttaching(false);
      }
    }

    clearRawEvents();
    setRunPrompt(text);
    setRunToken((t) => t + 1);
    setAttachedFile(null);
  };

  const selectedBots = bots.filter((bot) => selected.includes(bot.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Playground</h1>
        <p className="text-sm text-muted-foreground">
          Send one prompt to multiple bots at once and watch them run in parallel - the terminal
          on the right streams every request/tool-call event live, same feed as the dashboard.
          Bots invoked as a tool by another bot show up here too, even if you didn&apos;t select
          them yourself.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex h-full flex-col gap-6">
          <div className="space-y-2">
            <Label>Bots</Label>
            {bots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bots yet - create one first.</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {bots.map((bot) => (
                  <div key={bot.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`select-${bot.id}`}
                      checked={selected.includes(bot.id)}
                      onCheckedChange={(v) => toggle(bot.id, v === true)}
                    />
                    <Label htmlFor={`select-${bot.id}`} className="font-normal">
                      {bot.name}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {(attachedFile || attachError) && (
              <div className="flex items-center gap-2 text-xs">
                {attachedFile && <AttachmentChip file={attachedFile} onClear={() => setAttachedFile(null)} />}
                {attachError && <p className="text-destructive">{attachError}</p>}
              </div>
            )}
            <div className="flex gap-2">
              <AttachmentPickerButton
                disabled={attaching}
                onSelect={(file) => {
                  setAttachError(null);
                  setAttachedFile(file);
                }}
                onError={setAttachError}
              />
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Prompt to send to all selected bots…"
                rows={2}
              />
              <Button onClick={handleRun} disabled={!prompt.trim() || selected.length === 0 || attaching}>
                {attaching ? "Attaching…" : "Run"}
              </Button>
            </div>
          </div>

          {selectedBots.length > 0 && (
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              {selectedBots.map((bot) => (
                <PlaygroundColumn key={bot.id} bot={bot} prompt={runPrompt} runToken={runToken} />
              ))}
              <NestedRunCards onSelect={setDetails} />
            </div>
          )}
        </div>

        <TerminalLog />
      </div>

      <RequestDetailsDialog
        request={details}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
      />
    </div>
  );
}
