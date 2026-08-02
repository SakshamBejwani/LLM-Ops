"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BotNode } from "@/components/workflows/bot-node";
import { ConditionNode } from "@/components/workflows/condition-node";
import { ParallelNode } from "@/components/workflows/parallel-node";
import { JoinNode } from "@/components/workflows/join-node";
import { JudgeNode } from "@/components/workflows/judge-node";
import { SupervisorScopeNode } from "@/components/workflows/supervisor-scope-node";
import { NodeConfigPanel, type NodeDialogMode } from "@/components/workflows/node-config-panel";
import { ConditionNodeConfigPanel, type ConditionDialogMode } from "@/components/workflows/condition-node-config-panel";
import { JudgeNodeConfigPanel, type JudgeDialogMode } from "@/components/workflows/judge-node-config-panel";
import {
  SupervisorScopeConfigPanel,
  type SupervisorScopeDialogMode,
} from "@/components/workflows/supervisor-scope-config-panel";
import { NodeRunDetailPanel } from "@/components/workflows/node-run-detail-panel";
import { EdgeConditionPanel } from "@/components/workflows/edge-condition-panel";
import { NodeConnectPicker } from "@/components/workflows/node-connect-picker";
import { WorkflowSidePanel } from "@/components/workflows/workflow-side-panel";
import { WorkflowRunProvider } from "@/components/workflows/workflow-run-context";
import { WorkflowViewProvider, type NodeRunView } from "@/components/workflows/workflow-view-context";
import { AttachmentChip, AttachmentPickerButton } from "@/components/chat/attachment-field";
import { ingestAttachment } from "@/lib/attachments/client";
import {
  definitionsToFlow,
  flowToDefinitions,
  exportWorkflowNodes,
  importWorkflowNodes,
  applyEdgeLabels,
  computeIsRoot,
  DEFAULT_SCOPE_SIZE,
  type CanvasNode,
  type SupervisorScopeNode as SupervisorScopeNodeType,
} from "@/lib/workflow/canvas";
import { validateGraph, resolveAvailableFields } from "@/lib/workflow/graph";
import { useObservabilityStore, workflowNodeKey, type LiveToolCall } from "@/lib/stores/observability-store";
import type {
  Bot,
  Workflow,
  WorkflowBotNodeDefinition,
  WorkflowConditionClause,
  WorkflowEdgeCondition,
  WorkflowNodeRunRecord,
  WorkflowRunRecord,
  WorkflowSchemaField,
  SupervisorBounds,
} from "@/lib/types";

const nodeTypes = {
  bot: BotNode,
  condition: ConditionNode,
  parallel: ParallelNode,
  join: JoinNode,
  judge: JudgeNode,
  supervisor_scope: SupervisorScopeNode,
};

const NODE_FOOTPRINT = { width: 224, height: 120 };
const SCOPE_PADDING = 24;

/** Next unused "branch-N" id for a parallel node, given its current ones. */
function nextBranchId(existingBranchIds: string[]): string {
  const max = existingBranchIds.reduce((m, id) => {
    const n = Number(/^branch-(\d+)$/.exec(id)?.[1] ?? 0);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `branch-${max + 1}`;
}

type ViewMode =
  | { type: "editing" }
  | { type: "live"; runId: string }
  | { type: "history"; run: WorkflowRunRecord; nodeRuns: WorkflowNodeRunRecord[] };

export function WorkflowEditor({ workflow, bots }: { workflow: Workflow; bots: Bot[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clearRawEvents = useObservabilityStore((s) => s.clearRawEvents);
  const workflowNodeStatuses = useObservabilityStore((s) => s.workflowNodeStatuses);
  const liveRequests = useObservabilityStore((s) => s.liveRequests);
  const requestHistory = useObservabilityStore((s) => s.history);

  const [name, setName] = useState(workflow.name);
  const outputSchemaByIdRef = useRef(
    new Map(
      workflow.nodes
        .filter((n): n is WorkflowBotNodeDefinition => n.kind === undefined || n.kind === "bot")
        .map((n) => [n.id, n.outputSchema]),
    ),
  );
  const edgeConditionByIdRef = useRef(
    new Map(
      workflow.edges
        .filter((e): e is typeof e & { condition: WorkflowEdgeCondition } => !!e.condition)
        .map((e) => [e.id, e.condition]),
    ),
  );
  const edgeBranchByIdRef = useRef(
    new Map(
      workflow.edges.filter((e): e is typeof e & { branch: string } => !!e.branch).map((e) => [e.id, e.branch]),
    ),
  );

  const initialFlow = useMemo(
    () => definitionsToFlow(workflow.nodes, workflow.edges, bots),
    // Only ever used for the initial render - the canvas owns its own state after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges);

  const [dialogMode, setDialogMode] = useState<NodeDialogMode | null>(null);
  const [conditionDialogMode, setConditionDialogMode] = useState<ConditionDialogMode | null>(null);
  const [judgeDialogMode, setJudgeDialogMode] = useState<JudgeDialogMode | null>(null);
  const [supervisorScopeDialogMode, setSupervisorScopeDialogMode] = useState<SupervisorScopeDialogMode | null>(null);
  const [selectedViewNodeId, setSelectedViewNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectPickerNodeId, setConnectPickerNodeId] = useState<string | null>(null);
  const [connectPickerBranch, setConnectPickerBranch] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>({ type: "editing" });
  const [triggerMessage, setTriggerMessage] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const activeRunId = viewMode.type === "live" ? viewMode.runId : null;
  const runStatus = useObservabilityStore((s) => (activeRunId ? s.workflowRuns[activeRunId] : undefined));
  const isRunInProgress = starting || runStatus?.status === "running";

  // Deep-link from the run-history popup: /workflows/[id]?run=<id> loads straight into
  // history-view mode for that run.
  useEffect(() => {
    const runId = searchParams.get("run");
    if (!runId) return;
    fetch(`/api/workflows/${workflow.id}/runs`)
      .then((res) => res.json())
      .then((data: { runs: WorkflowRunRecord[]; nodeRuns: WorkflowNodeRunRecord[] }) => {
        const run = data.runs.find((r) => r.id === runId);
        if (!run) return;
        setViewMode({
          type: "history",
          run,
          nodeRuns: data.nodeRuns.filter((nr) => nr.workflow_run_id === runId),
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute each node's "Start" badge whenever connections change.
  useEffect(() => {
    const plainEdges = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
    setNodes((nds) =>
      nds.map((n) => {
        // Not part of the execution chain - no "Start" badge applies.
        if (n.type === "supervisor_scope") return n;
        const isRoot = computeIsRoot(n.id, plainEdges);
        if (isRoot === n.data.isRoot) return n;
        // Branching on n.type (rather than one shared spread) keeps each
        // returned object's `data` narrowed to its own node kind - a single
        // `{ ...n, data: { ...n.data, isRoot } }` collapses CanvasNode's
        // discriminated union into an ambiguous shape TS can't reconcile.
        if (n.type === "condition") return { ...n, data: { ...n.data, isRoot } };
        if (n.type === "parallel") return { ...n, data: { ...n.data, isRoot } };
        if (n.type === "join") return { ...n, data: { ...n.data, isRoot } };
        if (n.type === "judge") return { ...n, data: { ...n.data, isRoot } };
        return { ...n, data: { ...n.data, isRoot } };
      }),
    );
  }, [edges, setNodes]);

  // Recompute each supervisor scope's membership (which bots currently sit
  // inside its box) and grow the box to fit them, whenever any node moves.
  // Returns the *same* `nds` reference when nothing changes so this doesn't
  // loop forever - setNodes bails out of a re-render on an unchanged array.
  useEffect(() => {
    setNodes((nds) => {
      const scopes = nds.filter((n): n is SupervisorScopeNodeType => n.type === "supervisor_scope");
      if (scopes.length === 0) return nds;
      let changed = false;
      const next = nds.map((n) => {
        if (n.type !== "supervisor_scope") return n;
        const width = n.width ?? DEFAULT_SCOPE_SIZE.width;
        const height = n.height ?? DEFAULT_SCOPE_SIZE.height;
        const memberIds: string[] = [];
        let maxX = n.position.x + width;
        let maxY = n.position.y + height;
        for (const other of nds) {
          if (other.id === n.id || other.type === "supervisor_scope") continue;
          const cx = other.position.x + NODE_FOOTPRINT.width / 2;
          const cy = other.position.y + NODE_FOOTPRINT.height / 2;
          const inside =
            cx >= n.position.x && cx <= n.position.x + width && cy >= n.position.y && cy <= n.position.y + height;
          if (!inside) continue;
          memberIds.push(other.id);
          maxX = Math.max(maxX, other.position.x + NODE_FOOTPRINT.width + SCOPE_PADDING);
          maxY = Math.max(maxY, other.position.y + NODE_FOOTPRINT.height + SCOPE_PADDING);
        }
        const nextWidth = Math.max(width, maxX - n.position.x);
        const nextHeight = Math.max(height, maxY - n.position.y);
        const sameMembers =
          memberIds.length === n.data.memberNodeIds.length &&
          memberIds.every((id) => n.data.memberNodeIds.includes(id));
        if (sameMembers && nextWidth === width && nextHeight === height) return n;
        changed = true;
        return { ...n, width: nextWidth, height: nextHeight, data: { ...n.data, memberNodeIds: memberIds } };
      });
      return changed ? next : nds;
    });
  }, [nodes, setNodes]);

  const nodeViews = useMemo<Record<string, NodeRunView>>(() => {
    if (viewMode.type === "editing") return {};

    if (viewMode.type === "live") {
      const runId = viewMode.runId;
      const result: Record<string, NodeRunView> = {};
      for (const node of nodes) {
        const nodeStatus = workflowNodeStatuses[workflowNodeKey(runId, node.id)];
        if (!nodeStatus) {
          result[node.id] = { status: "idle", toolCalls: [] };
          continue;
        }
        const requestId = nodeStatus.requestId;
        const liveReq = requestId ? liveRequests[requestId] : undefined;
        const historyReq = requestId ? requestHistory.find((r) => r.id === requestId) : undefined;
        const toolCalls: LiveToolCall[] =
          liveReq?.toolCalls ??
          (historyReq?.tool_calls ?? []).map((call) => ({
            toolCallId: call.id,
            toolName: call.toolName,
            input: call.input,
            output: call.output,
            durationMs: call.durationMs ?? undefined,
            status: "done" as const,
          }));
        result[node.id] = {
          status: nodeStatus.status,
          input: liveReq?.promptPreview ?? historyReq?.prompt_preview ?? undefined,
          output: nodeStatus.output,
          error: nodeStatus.error,
          toolCalls,
        };
      }
      return result;
    }

    const result: Record<string, NodeRunView> = {};
    for (const nodeRun of viewMode.nodeRuns) {
      result[nodeRun.node_id] = {
        status: nodeRun.status,
        input: nodeRun.input,
        output: nodeRun.output,
        error: nodeRun.error ?? undefined,
        latencyMs: nodeRun.latency_ms ?? undefined,
        toolCalls: (nodeRun.tool_calls ?? []).map((call) => ({
          toolCallId: call.id,
          toolName: call.toolName,
          input: call.input,
          output: call.output,
          durationMs: call.durationMs ?? undefined,
          status: "done" as const,
        })),
        supervisorOverride: nodeRun.supervisor_override,
      };
    }
    return result;
  }, [viewMode, nodes, workflowNodeStatuses, liveRequests, requestHistory]);

  const connectNodes = useCallback(
    (sourceId: string, targetId: string, branch?: string) => {
      const newEdgeId = crypto.randomUUID();
      const sourceHadEdge = edges.some((e) => e.source === sourceId);
      if (branch) edgeBranchByIdRef.current.set(newEdgeId, branch);
      setEdges((eds) =>
        applyEdgeLabels(
          addEdge({ id: newEdgeId, source: sourceId, target: targetId, sourceHandle: branch }, eds),
          edgeConditionByIdRef.current,
          edgeBranchByIdRef.current,
        ),
      );
      setConnectPickerNodeId(null);
      setConnectPickerBranch(undefined);
      // A bot node's second (or later) outgoing edge is a branch - prompt for
      // its condition immediately instead of silently leaving two default
      // edges, which validateGraph would reject on Save/Run anyway. A
      // condition node's edges don't need this - their branch is already
      // fixed by which handle/button was used to create them.
      if (sourceHadEdge && !branch) {
        setDialogMode(null);
        setConditionDialogMode(null);
        setJudgeDialogMode(null);
        setSupervisorScopeDialogMode(null);
        setSelectedViewNodeId(null);
        setLogsOpen(false);
        setSelectedEdgeId(newEdgeId);
      }
    },
    [edges, setEdges],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      // Only condition ("if"/"else") and parallel ("branch-N") source nodes
      // set a sourceHandle id at all - a bot/join node's single output handle
      // is unnamed (null), so any non-null handle here is a branch.
      connectNodes(connection.source, connection.target, connection.sourceHandle ?? undefined);
    },
    [connectNodes],
  );

  const handleRequestConnect = useCallback((nodeId: string, branch?: string) => {
    setDialogMode(null);
    setConditionDialogMode(null);
    setJudgeDialogMode(null);
    setSupervisorScopeDialogMode(null);
    setSelectedViewNodeId(null);
    setSelectedEdgeId(null);
    setLogsOpen(false);
    setConnectPickerNodeId(nodeId);
    setConnectPickerBranch(branch);
  }, []);

  const handleNodeClick: NodeMouseHandler<CanvasNode> = useCallback(
    (_event, node) => {
      setLogsOpen(false);
      setSelectedEdgeId(null);
      setConnectPickerNodeId(null);
      if (viewMode.type !== "editing") {
        setDialogMode(null);
        setConditionDialogMode(null);
        setJudgeDialogMode(null);
        setSupervisorScopeDialogMode(null);
        setSelectedViewNodeId(node.id);
        return;
      }
      setSelectedViewNodeId(null);
      if (node.type === "condition") {
        setDialogMode(null);
        setConditionDialogMode({
          type: "edit",
          node: {
            id: node.id,
            kind: "condition",
            label: node.data.label,
            combinator: node.data.combinator,
            clauses: node.data.clauses,
            position: node.position,
          },
        });
        return;
      }
      if (node.type === "judge") {
        setDialogMode(null);
        setJudgeDialogMode({
          type: "edit",
          node: {
            id: node.id,
            kind: "judge",
            label: node.data.label,
            rubric: node.data.rubric,
            referenceField: node.data.referenceField,
            model: node.data.model,
            position: node.position,
          },
        });
        return;
      }
      if (node.type === "supervisor_scope") {
        setDialogMode(null);
        setSupervisorScopeDialogMode({
          type: "edit",
          node: {
            id: node.id,
            kind: "supervisor_scope",
            label: node.data.label,
            instructions: node.data.instructions,
            model: node.data.model,
            bounds: node.data.bounds,
            memberNodeIds: node.data.memberNodeIds,
            position: node.position,
            size: { width: node.width ?? DEFAULT_SCOPE_SIZE.width, height: node.height ?? DEFAULT_SCOPE_SIZE.height },
          },
        });
        return;
      }
      // Parallel/join nodes have no per-node config - just fan-out shape
      // (branches) and a merge point, both edited via connections directly.
      if (node.type === "parallel" || node.type === "join") return;
      const outputSchema = outputSchemaByIdRef.current.get(node.id) ?? { fields: [] };
      setConditionDialogMode(null);
      setJudgeDialogMode(null);
      setSupervisorScopeDialogMode(null);
      setDialogMode({
        type: "edit",
        node: {
          id: node.id,
          botId: node.data.botId,
          label: node.data.label,
          outputSchema,
          position: node.position,
        },
      });
    },
    [viewMode],
  );

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      if (viewMode.type !== "editing") return;
      // Branch edges (from a condition node) are fixed if/else - nothing to
      // configure. Native selection still applies, so they can be removed
      // via the Delete/Backspace key like any selected edge.
      if (edgeBranchByIdRef.current.has(edge.id)) return;
      setDialogMode(null);
      setConditionDialogMode(null);
      setJudgeDialogMode(null);
      setSupervisorScopeDialogMode(null);
      setSelectedViewNodeId(null);
      setConnectPickerNodeId(null);
      setLogsOpen(false);
      setSelectedEdgeId(edge.id);
    },
    [viewMode],
  );

  const handleEdgeConditionSave = useCallback(
    (condition: WorkflowEdgeCondition | undefined) => {
      if (!selectedEdgeId) return;
      if (condition) edgeConditionByIdRef.current.set(selectedEdgeId, condition);
      else edgeConditionByIdRef.current.delete(selectedEdgeId);
      setEdges((eds) => applyEdgeLabels(eds, edgeConditionByIdRef.current, edgeBranchByIdRef.current));
      setSelectedEdgeId(null);
    },
    [selectedEdgeId, setEdges],
  );

  const handleEdgeDelete = useCallback(() => {
    if (!selectedEdgeId) return;
    const edgeId = selectedEdgeId;
    edgeConditionByIdRef.current.delete(edgeId);
    edgeBranchByIdRef.current.delete(edgeId);
    setEdges((eds) =>
      applyEdgeLabels(eds.filter((e) => e.id !== edgeId), edgeConditionByIdRef.current, edgeBranchByIdRef.current),
    );
    setSelectedEdgeId(null);
  }, [selectedEdgeId, setEdges]);

  const handleDialogSave = useCallback(
    (values: { botId: string; label: string; fields: WorkflowSchemaField[] }) => {
      const bot = bots.find((b) => b.id === values.botId);

      if (dialogMode?.type === "edit") {
        const nodeId = dialogMode.node.id;
        outputSchemaByIdRef.current.set(nodeId, { fields: values.fields });
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId && n.type === "bot"
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    botId: values.botId,
                    botName: bot?.name ?? "Unknown bot",
                    label: values.label || bot?.name || "Untitled bot",
                  },
                }
              : n,
          ),
        );
      } else {
        const nodeId = crypto.randomUUID();
        outputSchemaByIdRef.current.set(nodeId, { fields: values.fields });
        const position = { x: 80 + nodes.length * 260, y: 120 };
        setNodes((nds) => [
          ...nds,
          {
            id: nodeId,
            type: "bot",
            position,
            data: {
              label: values.label || bot?.name || "Untitled bot",
              botId: values.botId,
              botName: bot?.name ?? "Unknown bot",
              isRoot: computeIsRoot(nodeId, []),
            },
          },
        ]);
      }
      setDialogMode(null);
    },
    [dialogMode, bots, nodes.length, setNodes],
  );

  const handleDialogDelete = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      outputSchemaByIdRef.current.delete(nodeId);
      setDialogMode(null);
    },
    [setNodes, setEdges],
  );

  const handleConditionDialogSave = useCallback(
    (values: { label: string; combinator: "AND" | "OR"; clauses: WorkflowConditionClause[] }) => {
      if (conditionDialogMode?.type === "edit") {
        const nodeId = conditionDialogMode.node.id;
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId && n.type === "condition"
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    label: values.label || "Condition",
                    combinator: values.combinator,
                    clauses: values.clauses,
                  },
                }
              : n,
          ),
        );
      } else {
        const nodeId = crypto.randomUUID();
        const position = { x: 80 + nodes.length * 260, y: 120 };
        setNodes((nds) => [
          ...nds,
          {
            id: nodeId,
            type: "condition",
            position,
            data: {
              label: values.label || "Condition",
              combinator: values.combinator,
              clauses: values.clauses,
              isRoot: computeIsRoot(nodeId, []),
            },
          },
        ]);
      }
      setConditionDialogMode(null);
      setJudgeDialogMode(null);
      setSupervisorScopeDialogMode(null);
    },
    [conditionDialogMode, nodes.length, setNodes],
  );

  const handleConditionDialogDelete = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setConditionDialogMode(null);
      setJudgeDialogMode(null);
      setSupervisorScopeDialogMode(null);
    },
    [setNodes, setEdges],
  );

  const handleJudgeDialogSave = useCallback(
    (values: { label: string; rubric: string; referenceField?: string; model: string }) => {
      if (judgeDialogMode?.type === "edit") {
        const nodeId = judgeDialogMode.node.id;
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId && n.type === "judge"
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    label: values.label || "Judge",
                    rubric: values.rubric,
                    referenceField: values.referenceField,
                    model: values.model,
                  },
                }
              : n,
          ),
        );
      } else {
        const nodeId = crypto.randomUUID();
        const position = { x: 80 + nodes.length * 260, y: 120 };
        setNodes((nds) => [
          ...nds,
          {
            id: nodeId,
            type: "judge",
            position,
            data: {
              label: values.label || "Judge",
              rubric: values.rubric,
              referenceField: values.referenceField,
              model: values.model,
              isRoot: computeIsRoot(nodeId, []),
            },
          },
        ]);
      }
      setConditionDialogMode(null);
      setJudgeDialogMode(null);
      setSupervisorScopeDialogMode(null);
    },
    [judgeDialogMode, nodes.length, setNodes],
  );

  const handleJudgeDialogDelete = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setJudgeDialogMode(null);
      setSupervisorScopeDialogMode(null);
    },
    [setNodes, setEdges],
  );

  const handleAddSupervisorScope = useCallback(() => {
    setDialogMode(null);
    setConditionDialogMode(null);
    setJudgeDialogMode(null);
    setSupervisorScopeDialogMode(null);
    setConnectPickerNodeId(null);
    setSupervisorScopeDialogMode({ type: "create" });
  }, []);

  const handleSupervisorScopeDialogSave = useCallback(
    (values: { label: string; instructions: string; model: string; bounds: SupervisorBounds }) => {
      if (supervisorScopeDialogMode?.type === "edit") {
        const nodeId = supervisorScopeDialogMode.node.id;
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId && n.type === "supervisor_scope"
              ? { ...n, data: { ...n.data, label: values.label, instructions: values.instructions, model: values.model, bounds: values.bounds } }
              : n,
          ),
        );
      } else {
        const nodeId = crypto.randomUUID();
        const position = { x: 80 + nodes.length * 60, y: 400 };
        setNodes((nds) => [
          ...nds,
          {
            id: nodeId,
            type: "supervisor_scope",
            position,
            width: DEFAULT_SCOPE_SIZE.width,
            height: DEFAULT_SCOPE_SIZE.height,
            zIndex: -1,
            data: {
              label: values.label,
              instructions: values.instructions,
              model: values.model,
              bounds: values.bounds,
              memberNodeIds: [],
            },
          },
        ]);
      }
      setSupervisorScopeDialogMode(null);
    },
    [supervisorScopeDialogMode, nodes.length, setNodes],
  );

  const handleSupervisorScopeDialogDelete = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setSupervisorScopeDialogMode(null);
    },
    [setNodes],
  );

  const handlePickerSelectBot = useCallback(
    (bot: Bot) => {
      if (!connectPickerNodeId) return;
      const sourceNode = nodes.find((n) => n.id === connectPickerNodeId);
      if (!sourceNode) return;
      const outgoingCount = edges.filter((e) => e.source === connectPickerNodeId).length;
      const newNodeId = crypto.randomUUID();
      outputSchemaByIdRef.current.set(newNodeId, { fields: [] });
      const position = {
        x: sourceNode.position.x + 280,
        y: sourceNode.position.y + outgoingCount * 140,
      };
      setNodes((nds) => [
        ...nds,
        {
          id: newNodeId,
          type: "bot",
          position,
          data: {
            label: bot.name,
            botId: bot.id,
            botName: bot.name,
            isRoot: computeIsRoot(newNodeId, []),
          },
        },
      ]);
      connectNodes(connectPickerNodeId, newNodeId, connectPickerBranch);
    },
    [connectPickerNodeId, connectPickerBranch, nodes, edges, setNodes, connectNodes],
  );

  const handlePickerSelectExisting = useCallback(
    (targetNodeId: string) => {
      if (!connectPickerNodeId) return;
      connectNodes(connectPickerNodeId, targetNodeId, connectPickerBranch);
    },
    [connectPickerNodeId, connectPickerBranch, connectNodes],
  );

  const handlePickerSelectCondition = useCallback(() => {
    if (!connectPickerNodeId) return;
    const sourceNode = nodes.find((n) => n.id === connectPickerNodeId);
    if (!sourceNode) return;
    const outgoingCount = edges.filter((e) => e.source === connectPickerNodeId).length;
    const newNodeId = crypto.randomUUID();
    const position = {
      x: sourceNode.position.x + 280,
      y: sourceNode.position.y + outgoingCount * 140,
    };
    setNodes((nds) => [
      ...nds,
      {
        id: newNodeId,
        type: "condition",
        position,
        data: { label: "Condition", combinator: "AND", clauses: [], isRoot: computeIsRoot(newNodeId, []) },
      },
    ]);
    connectNodes(connectPickerNodeId, newNodeId, connectPickerBranch);
  }, [connectPickerNodeId, connectPickerBranch, nodes, edges, setNodes, connectNodes]);

  const handlePickerSelectJudge = useCallback(() => {
    if (!connectPickerNodeId) return;
    const sourceNode = nodes.find((n) => n.id === connectPickerNodeId);
    if (!sourceNode) return;
    const outgoingCount = edges.filter((e) => e.source === connectPickerNodeId).length;
    const newNodeId = crypto.randomUUID();
    const position = {
      x: sourceNode.position.x + 280,
      y: sourceNode.position.y + outgoingCount * 140,
    };
    setNodes((nds) => [
      ...nds,
      {
        id: newNodeId,
        type: "judge",
        position,
        data: { label: "Judge", rubric: "", model: "", isRoot: computeIsRoot(newNodeId, []) },
      },
    ]);
    connectNodes(connectPickerNodeId, newNodeId, connectPickerBranch);
  }, [connectPickerNodeId, connectPickerBranch, nodes, edges, setNodes, connectNodes]);

  const handlePickerSelectParallel = useCallback(() => {
    if (!connectPickerNodeId) return;
    const sourceNode = nodes.find((n) => n.id === connectPickerNodeId);
    if (!sourceNode) return;
    const outgoingCount = edges.filter((e) => e.source === connectPickerNodeId).length;
    const parallelId = crypto.randomUUID();
    const joinId = crypto.randomUUID();
    const parallelPosition = {
      x: sourceNode.position.x + 280,
      y: sourceNode.position.y + outgoingCount * 140,
    };
    const joinPosition = { x: parallelPosition.x + 280, y: parallelPosition.y };
    setNodes((nds) => [
      ...nds,
      {
        id: parallelId,
        type: "parallel",
        position: parallelPosition,
        data: { label: "Parallel", branchIds: ["branch-1", "branch-2"], isRoot: computeIsRoot(parallelId, []) },
      },
      {
        id: joinId,
        type: "join",
        position: joinPosition,
        data: { label: "Join", isRoot: computeIsRoot(joinId, []) },
      },
    ]);
    connectNodes(connectPickerNodeId, parallelId, connectPickerBranch);
  }, [connectPickerNodeId, connectPickerBranch, nodes, edges, setNodes, connectNodes]);

  const handleAddParallelBranch = useCallback(
    (parallelNodeId: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== parallelNodeId || n.type !== "parallel") return n;
          return { ...n, data: { ...n.data, branchIds: [...n.data.branchIds, nextBranchId(n.data.branchIds)] } };
        }),
      );
    },
    [setNodes],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { nodes: defNodes, edges: defEdges } = flowToDefinitions(
        nodes,
        edges,
        outputSchemaByIdRef.current,
        edgeConditionByIdRef.current,
        edgeBranchByIdRef.current,
      );
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nodes: defNodes, edges: defEdges }),
      });
      if (!res.ok) throw new Error("Failed to save workflow");
      toast.success("Workflow saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  }, [nodes, edges, name, workflow.id, router]);

  const handleRun = useCallback(async () => {
    setRunError(null);
    if (!triggerMessage.trim() || attaching) return;

    const { nodes: defNodes, edges: defEdges } = flowToDefinitions(
      nodes,
      edges,
      outputSchemaByIdRef.current,
      edgeConditionByIdRef.current,
      edgeBranchByIdRef.current,
    );
    try {
      validateGraph(defNodes, defEdges);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
      return;
    }

    let attachment: { name: string; content: string } | undefined;
    if (attachedFile) {
      setAttaching(true);
      try {
        const content = await ingestAttachment(attachedFile);
        attachment = { name: attachedFile.name, content };
      } catch {
        setAttachError("Failed to attach file - running without it.");
      } finally {
        setAttaching(false);
      }
    }

    setStarting(true);
    clearRawEvents();
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: triggerMessage, attachment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start run");
      setViewMode({ type: "live", runId: data.workflowRunId });
      setSelectedViewNodeId(null);
      setSelectedEdgeId(null);
      setConnectPickerNodeId(null);
      setLogsOpen(true);
      setAttachedFile(null);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to start run");
    } finally {
      setStarting(false);
    }
  }, [nodes, edges, triggerMessage, attachedFile, attaching, workflow.id, clearRawEvents]);

  const handleBackToEditing = useCallback(() => {
    setViewMode({ type: "editing" });
    setSelectedViewNodeId(null);
    setSelectedEdgeId(null);
    setConnectPickerNodeId(null);
    if (searchParams.get("run")) {
      router.replace(`/workflows/${workflow.id}`);
    }
  }, [router, searchParams, workflow.id]);

  const handleExport = useCallback(() => {
    try {
      const { nodes: defNodes, edges: defEdges } = flowToDefinitions(
        nodes,
        edges,
        outputSchemaByIdRef.current,
        edgeConditionByIdRef.current,
        edgeBranchByIdRef.current,
      );
      const exported = exportWorkflowNodes(defNodes, defEdges, bots);
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.trim().toLowerCase().replace(/\s+/g, "-") || "workflow"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Can't export - fix the workflow graph first");
    }
  }, [nodes, edges, bots, name]);

  const handleImportFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const isLegacyArray = Array.isArray(parsed);
        const isCurrentFormat =
          parsed && typeof parsed === "object" && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges);
        if (!isLegacyArray && !isCurrentFormat) {
          throw new Error("Expected a workflow export (nodes/edges).");
        }
        const { nodes: importedNodes, edges: importedEdges } = importWorkflowNodes(parsed);
        outputSchemaByIdRef.current = new Map(
          importedNodes
            .filter((n): n is WorkflowBotNodeDefinition => n.kind === undefined || n.kind === "bot")
            .map((n) => [n.id, n.outputSchema]),
        );
        edgeConditionByIdRef.current = new Map(
          importedEdges
            .filter((e): e is typeof e & { condition: WorkflowEdgeCondition } => !!e.condition)
            .map((e) => [e.id, e.condition]),
        );
        edgeBranchByIdRef.current = new Map(
          importedEdges.filter((e): e is typeof e & { branch: string } => !!e.branch).map((e) => [e.id, e.branch]),
        );
        const flow = definitionsToFlow(importedNodes, importedEdges, bots);
        setNodes(flow.nodes);
        setEdges(flow.edges);
        toast.success(`Imported ${importedNodes.length} node${importedNodes.length === 1 ? "" : "s"}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to import workflow");
      }
    },
    [bots, setNodes, setEdges],
  );

  const selectedViewNode = selectedViewNodeId ? nodes.find((n) => n.id === selectedViewNodeId) : undefined;
  const selectedViewNodeName = selectedViewNode
    ? selectedViewNode.type === "bot"
      ? selectedViewNode.data.botName
      : selectedViewNode.data.label
    : "Unknown bot";
  const selectedEdge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : undefined;
  // Only nodes with no incoming edge yet are valid quick-connect targets -
  // validateGraph bans fan-in everywhere except a join node, which is exactly
  // meant to receive more than one.
  const existingNodesForPicker = connectPickerNodeId
    ? (() => {
        const plainEdges = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
        return nodes
          .filter(
            (n) =>
              n.id !== connectPickerNodeId &&
              n.type !== "supervisor_scope" &&
              (n.type === "join" || computeIsRoot(n.id, plainEdges)),
          )
          .map((n) => ({
            id: n.id,
            label: n.data.label,
            botName:
              n.type === "bot"
                ? n.data.botName
                : n.type === "condition"
                  ? "Condition"
                  : n.type === "parallel"
                    ? "Parallel"
                    : n.type === "judge"
                      ? "Judge"
                      : "Join",
          }));
      })()
    : [];
  const conditionAvailableFields =
    conditionDialogMode?.type === "edit"
      ? (() => {
          const { nodes: defNodes, edges: defEdges } = flowToDefinitions(
            nodes,
            edges,
            outputSchemaByIdRef.current,
            edgeConditionByIdRef.current,
            edgeBranchByIdRef.current,
          );
          return resolveAvailableFields(conditionDialogMode.node.id, defNodes, defEdges);
        })()
      : [];
  const judgeAvailableFields =
    judgeDialogMode?.type === "edit"
      ? (() => {
          const { nodes: defNodes, edges: defEdges } = flowToDefinitions(
            nodes,
            edges,
            outputSchemaByIdRef.current,
            edgeConditionByIdRef.current,
            edgeBranchByIdRef.current,
          );
          return resolveAvailableFields(judgeDialogMode.node.id, defNodes, defEdges);
        })()
      : [];

  return (
    <ReactFlowProvider>
      <WorkflowRunProvider value={activeRunId}>
        <WorkflowViewProvider
          value={{
            bots,
            nodeViews,
            onRequestConnect: viewMode.type === "editing" ? handleRequestConnect : undefined,
            onAddParallelBranch: viewMode.type === "editing" ? handleAddParallelBranch : undefined,
          }}
        >
          <div className="relative h-full w-full overflow-hidden bg-muted/20">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={handleConnect}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              fitView
              className="h-full w-full"
            >
              <Background variant={BackgroundVariant.Dots} gap={16} />
              <Controls showInteractive={false} />
            </ReactFlow>

            {/* Top-left: workflow toolbar */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-background/90 p-2 shadow-lg backdrop-blur-md">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="max-w-[10rem] font-medium"
                aria-label="Workflow name"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLogsOpen(false);
                  setSelectedViewNodeId(null);
                  setSelectedEdgeId(null);
                  setConnectPickerNodeId(null);
                  setConditionDialogMode(null);
                  setJudgeDialogMode(null);
                  setSupervisorScopeDialogMode(null);
                  setDialogMode({ type: "create" });
                }}
              >
                + Add bot
              </Button>
              <Button variant="outline" size="sm" onClick={handleAddSupervisorScope}>
                + Add supervisor
              </Button>
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()}>
                Import
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>

            {/* Top-center: viewing-a-run banner */}
            {viewMode.type !== "editing" && (
              <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2">
                <button
                  type="button"
                  onClick={handleBackToEditing}
                  className="flex items-center gap-2 rounded-xl border bg-background/90 px-3 py-1.5 text-xs shadow-lg backdrop-blur-md hover:bg-muted/50"
                >
                  <span className="font-medium">
                    {viewMode.type === "history"
                      ? `Viewing run from ${new Date(viewMode.run.started_at).toLocaleString()}`
                      : "Live run"}
                  </span>
                  <span className="text-muted-foreground">- Back to editing</span>
                </button>
              </div>
            )}

            {/* Top-right: logs toggle - only meaningful when a live run is (or was) active */}
            {viewMode.type !== "history" && (
              <Button
                variant={logsOpen ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDialogMode(null);
                  setConditionDialogMode(null);
                  setJudgeDialogMode(null);
                  setSupervisorScopeDialogMode(null);
                  setSelectedViewNodeId(null);
                  setSelectedEdgeId(null);
                  setConnectPickerNodeId(null);
                  setLogsOpen((v) => !v);
                }}
                className="absolute top-4 right-4 z-10 shadow-lg"
              >
                Logs
              </Button>
            )}

            {/* Right dock: node editor / node run detail / edge condition / connect picker / logs panel share one slot */}
            {(dialogMode ||
              conditionDialogMode ||
              judgeDialogMode ||
              supervisorScopeDialogMode ||
              logsOpen ||
              selectedViewNodeId ||
              (selectedEdgeId && selectedEdge) ||
              connectPickerNodeId) && (
              <div className="absolute top-16 right-4 bottom-4 z-20 w-96">
                {dialogMode ? (
                  <NodeConfigPanel
                    mode={dialogMode}
                    bots={bots}
                    onClose={() => setDialogMode(null)}
                    onSave={handleDialogSave}
                    onDelete={handleDialogDelete}
                  />
                ) : conditionDialogMode ? (
                  <ConditionNodeConfigPanel
                    mode={conditionDialogMode}
                    availableFields={conditionAvailableFields}
                    onClose={() => setConditionDialogMode(null)}
                    onSave={handleConditionDialogSave}
                    onDelete={handleConditionDialogDelete}
                  />
                ) : judgeDialogMode ? (
                  <JudgeNodeConfigPanel
                    mode={judgeDialogMode}
                    availableFields={judgeAvailableFields}
                    onClose={() => setJudgeDialogMode(null)}
                    onSave={handleJudgeDialogSave}
                    onDelete={handleJudgeDialogDelete}
                  />
                ) : supervisorScopeDialogMode ? (
                  <SupervisorScopeConfigPanel
                    mode={supervisorScopeDialogMode}
                    memberCount={
                      supervisorScopeDialogMode.type === "edit"
                        ? ((nodes.find((n) => n.id === supervisorScopeDialogMode.node.id) as
                            | SupervisorScopeNodeType
                            | undefined)?.data.memberNodeIds.length ?? 0)
                        : 0
                    }
                    onClose={() => setSupervisorScopeDialogMode(null)}
                    onSave={handleSupervisorScopeDialogSave}
                    onDelete={handleSupervisorScopeDialogDelete}
                  />
                ) : selectedViewNodeId ? (
                  <NodeRunDetailPanel
                    botName={selectedViewNodeName}
                    view={nodeViews[selectedViewNodeId]}
                    onClose={() => setSelectedViewNodeId(null)}
                  />
                ) : selectedEdgeId && selectedEdge ? (
                  <EdgeConditionPanel
                    edge={{
                      id: selectedEdge.id,
                      source: selectedEdge.source,
                      target: selectedEdge.target,
                      condition: edgeConditionByIdRef.current.get(selectedEdge.id),
                    }}
                    sourceFields={outputSchemaByIdRef.current.get(selectedEdge.source)?.fields ?? []}
                    onClose={() => setSelectedEdgeId(null)}
                    onSave={handleEdgeConditionSave}
                    onDelete={handleEdgeDelete}
                  />
                ) : connectPickerNodeId ? (
                  <NodeConnectPicker
                    bots={bots}
                    existingNodes={existingNodesForPicker}
                    onClose={() => {
                      setConnectPickerNodeId(null);
                      setConnectPickerBranch(undefined);
                    }}
                    onSelectBot={handlePickerSelectBot}
                    onSelectExisting={handlePickerSelectExisting}
                    onSelectCondition={connectPickerBranch ? undefined : handlePickerSelectCondition}
                    onSelectParallel={connectPickerBranch ? undefined : handlePickerSelectParallel}
                    onSelectJudge={connectPickerBranch ? undefined : handlePickerSelectJudge}
                  />
                ) : (
                  <WorkflowSidePanel workflowRunId={activeRunId} onClose={() => setLogsOpen(false)} />
                )}
              </div>
            )}

            {/* Bottom-center: run bar */}
            <div className="absolute inset-x-0 bottom-4 z-10 mx-auto w-full max-w-2xl px-4">
              <div className="space-y-2 rounded-xl border bg-background/90 p-3 shadow-lg backdrop-blur-md">
                {(attachedFile || attachError) && (
                  <div className="flex items-center gap-2 text-xs">
                    {attachedFile && (
                      <AttachmentChip file={attachedFile} onClear={() => setAttachedFile(null)} />
                    )}
                    {attachError && <p className="text-destructive">{attachError}</p>}
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <AttachmentPickerButton
                    disabled={isRunInProgress || attaching}
                    onSelect={(file) => {
                      setAttachError(null);
                      setAttachedFile(file);
                    }}
                    onError={setAttachError}
                  />
                  <Textarea
                    value={triggerMessage}
                    onChange={(e) => setTriggerMessage(e.target.value)}
                    placeholder="Trigger message for the first bot…"
                    rows={2}
                    className="flex-1 resize-none bg-background"
                  />
                  <Button onClick={handleRun} disabled={!triggerMessage.trim() || isRunInProgress || attaching}>
                    {attaching ? "Attaching…" : isRunInProgress ? "Running…" : "Run"}
                  </Button>
                </div>
                {runError && <p className="text-sm text-destructive">{runError}</p>}
              </div>
            </div>
          </div>
        </WorkflowViewProvider>
      </WorkflowRunProvider>
    </ReactFlowProvider>
  );
}
