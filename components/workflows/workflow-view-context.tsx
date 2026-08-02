"use client";

import { createContext, useContext } from "react";
import type { Bot, SupervisorOverride } from "@/lib/types";
import type { LiveToolCall } from "@/lib/stores/observability-store";

export type NodeRunView = {
  status: "idle" | "running" | "success" | "error";
  input?: unknown;
  output?: unknown;
  error?: string;
  latencyMs?: number;
  toolCalls: LiveToolCall[];
  /** Only populated once a run is persisted (history view) - see the note in
   * workflow-editor.tsx about why live mode doesn't track this yet. */
  supervisorOverride?: SupervisorOverride | null;
};

export type WorkflowView = {
  bots: Bot[];
  nodeViews: Record<string, NodeRunView>;
  /** Undefined while viewing a run - the "+" quick-connect button only makes
   * sense in editing mode. `branch` is set when the click came from a
   * condition node's "If"/"Else" handle, or a parallel node's branch handle. */
  onRequestConnect?: (nodeId: string, branch?: string) => void;
  /** Undefined while viewing a run - adds a new (unconnected) branch handle
   * to a parallel node. */
  onAddParallelBranch?: (nodeId: string) => void;
};

const WorkflowViewContext = createContext<WorkflowView>({ bots: [], nodeViews: {} });

export const WorkflowViewProvider = WorkflowViewContext.Provider;

export function useWorkflowView(): WorkflowView {
  return useContext(WorkflowViewContext);
}
