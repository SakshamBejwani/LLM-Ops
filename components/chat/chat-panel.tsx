"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AttachmentChip, AttachmentPickerButton } from "@/components/chat/attachment-field";
import { ingestAttachment, withAttachment } from "@/lib/attachments/client";
import { cn } from "@/lib/utils";

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function getToolNames(message: UIMessage): string[] {
  const names = message.parts.map((part) => {
    if (part.type === "dynamic-tool") return part.toolName;
    if (part.type.startsWith("tool-")) return part.type.slice("tool-".length);
    return null;
  });
  return Array.from(new Set(names.filter((name): name is string => name !== null)));
}

export function ChatPanel({ botId }: { botId: string }) {
  const conversationId = useMemo(() => crypto.randomUUID(), []);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  const { messages, sendMessage, status, error } = useChat({
    id: conversationId,
    transport: new DefaultChatTransport({
      api: `/api/chat/${botId}`,
      body: { conversationId },
    }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if ((!input.trim() && !attachedFile) || isBusy || attaching) return;

    let messageText = input;
    if (attachedFile) {
      setAttaching(true);
      try {
        const content = await ingestAttachment(attachedFile);
        messageText = withAttachment(input, attachedFile.name, content);
      } catch {
        setAttachError("Failed to attach file - sending message without it.");
      } finally {
        setAttaching(false);
      }
    }

    sendMessage({ text: messageText });
    setInput("");
    setAttachedFile(null);
  };

  return (
    <div className="flex h-[32rem] flex-col rounded-lg border">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Send a message to test this bot. Tool calls show up on the dashboard live.
            </p>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex flex-col gap-1", message.role === "user" ? "items-end" : "items-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {getMessageText(message) || (message.role === "assistant" ? "…" : "")}
              </div>
              {getToolNames(message).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {getToolNames(message).map((name) => (
                    <Badge key={name} variant="outline">
                      {name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
          {error && <p className="text-sm text-destructive">Error: {error.message}</p>}
        </div>
      </ScrollArea>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t p-3">
        {(attachedFile || attachError) && (
          <div className="flex items-center gap-2 text-xs">
            {attachedFile && <AttachmentChip file={attachedFile} onClear={() => setAttachedFile(null)} />}
            {attachError && <p className="text-destructive">{attachError}</p>}
          </div>
        )}
        <div className="flex gap-2">
          <AttachmentPickerButton
            disabled={isBusy || attaching}
            onSelect={(file) => {
              setAttachError(null);
              setAttachedFile(file);
            }}
            onError={setAttachError}
          />
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Say something…"
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button type="submit" disabled={isBusy || attaching || (!input.trim() && !attachedFile)}>
            {attaching ? "Attaching…" : isBusy ? "…" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}
