import type { NextRequest } from "next/server";
import { subscribe } from "@/lib/events/bus";
import type { BusEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: BusEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      unsubscribe = subscribe(send);
      // Opens the connection promptly for clients/proxies buffering on first byte.
      controller.enqueue(encoder.encode(": connected\n\n"));
    },
    cancel() {
      unsubscribe?.();
    },
  });

  request.signal.addEventListener("abort", () => unsubscribe?.());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
