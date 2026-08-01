import { EventEmitter } from "node:events";
import type { BusEvent } from "@/lib/types";

// Cached on `globalThis` so Next.js dev-mode module re-evaluation (HMR) and
// separate route handler chunks all share one in-process emitter.
declare global {
  var __observabilityBus: EventEmitter | undefined;
}

const bus = globalThis.__observabilityBus ?? new EventEmitter();
bus.setMaxListeners(50);
globalThis.__observabilityBus = bus;

const CHANNEL = "event";

export function emitEvent(event: BusEvent) {
  bus.emit(CHANNEL, event);
}

export function subscribe(listener: (event: BusEvent) => void) {
  bus.on(CHANNEL, listener);
  return () => bus.off(CHANNEL, listener);
}
