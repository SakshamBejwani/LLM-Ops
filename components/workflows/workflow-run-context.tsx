"use client";

import { createContext, useContext } from "react";

const WorkflowRunContext = createContext<string | null>(null);

export const WorkflowRunProvider = WorkflowRunContext.Provider;

export function useActiveWorkflowRunId(): string | null {
  return useContext(WorkflowRunContext);
}
