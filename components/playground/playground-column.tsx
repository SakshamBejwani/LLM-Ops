"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Bot } from "@/lib/types";

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function PlaygroundColumn({
  bot,
  prompt,
  runToken,
}: {
  bot: Bot;
  prompt: string;
  runToken: number;
}) {
  const conversationId = useRef(crypto.randomUUID()).current;
  const lastRunToken = useRef(0);

  const { messages, sendMessage, status } = useChat({
    id: conversationId,
    transport: new DefaultChatTransport({
      api: `/api/chat/${bot.id}`,
      body: { conversationId },
    }),
  });

  useEffect(() => {
    if (runToken > 0 && runToken !== lastRunToken.current && prompt.trim()) {
      lastRunToken.current = runToken;
      sendMessage({ text: prompt });
    }
  }, [runToken, prompt, sendMessage]);

  const assistantText = messages
    .filter((m) => m.role === "assistant")
    .map(getMessageText)
    .join("\n\n");
  const isBusy = status === "submitted" || status === "streaming";

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{bot.name}</span>
          {isBusy && <span className="text-xs font-normal text-muted-foreground">generating…</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <p className="whitespace-pre-wrap text-sm">
            {assistantText || (isBusy ? "…" : "Waiting to run.")}
          </p>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
