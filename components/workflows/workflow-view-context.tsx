"use client";

import { createContext, useContext } from "react";
import type { Bot } from "@/lib/types";
import type { LiveToolCall } from "@/lib/stores/observability-store";

export type NodeRunView = {
  status: "idle" | "running" | "success" | "error";
  input?: unknown;
  output?: unknown;
  error?: string;
  latencyMs?: number;
  toolCalls: LiveToolCall[];
};

export type WorkflowView = {
  bots: Bot[];
  nodeViews: Record<string, NodeRunView>;
  /** Undefined while viewing a run - the "+" quick-connect button only makes
   * sense in editing mode. `branch` is set when the click came from a
   * condition node's "If"/"Else" handle specifically. */
  onRequestConnect?: (nodeId: string, branch?: "if" | "else") => void;
};

const WorkflowViewContext = createContext<WorkflowView>({ bots: [], nodeViews: {} });

export const WorkflowViewProvider = WorkflowViewContext.Provider;

export function useWorkflowView(): WorkflowView {
  return useContext(WorkflowViewContext);
}
