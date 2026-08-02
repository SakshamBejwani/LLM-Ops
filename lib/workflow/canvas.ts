import type { Node, Edge } from "@xyflow/react";
import type {
  Bot,
  SupervisorBounds,
  WorkflowConditionClause,
  WorkflowEdgeCondition,
  WorkflowEdgeDefinition,
  WorkflowNodeDefinition,
  WorkflowOutputSchema,
} from "@/lib/types";
import { validateGraph } from "@/lib/workflow/graph";

export type BotNodeData = {
  label: string;
  botId: string;
  botName: string;
  isRoot: boolean;
};

export type BotNode = Node<BotNodeData, "bot">;

export type ConditionNodeData = {
  label: string;
  combinator: "AND" | "OR";
  clauses: WorkflowConditionClause[];
  isRoot: boolean;
};

export type ConditionNode = Node<ConditionNodeData, "condition">;

export type ParallelNodeData = {
  label: string;
  branchIds: string[];
  isRoot: boolean;
};

export type ParallelNode = Node<ParallelNodeData, "parallel">;

export type JoinNodeData = {
  label: string;
  isRoot: boolean;
};

export type JoinNode = Node<JoinNodeData, "join">;

export type JudgeNodeData = {
  label: string;
  rubric: string;
  referenceField?: string;
  model: string;
  isRoot: boolean;
};

export type JudgeNode = Node<JudgeNodeData, "judge">;

export type SupervisorScopeNodeData = {
  label: string;
  instructions: string;
  model: string;
  bounds: SupervisorBounds;
  memberNodeIds: string[];
};

export type SupervisorScopeNode = Node<SupervisorScopeNodeData, "supervisor_scope">;

/** Every node type the canvas can render - a bot call, a no-LLM
 * condition/router, a no-LLM parallel fan-out/join pair, an LLM-graded
 * pass/fail judge, or a supervisor watch zone (not part of the execution
 * chain at all - see WorkflowSupervisorScopeDefinition). */
export type CanvasNode = BotNode | ConditionNode | ParallelNode | JoinNode | JudgeNode | SupervisorScopeNode;

/** Turns "branch-1" into "Branch 1" for display. */
export function branchDisplayLabel(branchId: string): string {
  if (branchId === "if" || branchId === "else") return branchId === "if" ? "If" : "Else";
  const match = /^branch-(\d+)$/.exec(branchId);
  return match ? `Branch ${match[1]}` : branchId;
}

export const DEFAULT_SCOPE_SIZE = { width: 320, height: 220 };

export function computeIsRoot(nodeId: string, edges: WorkflowEdgeDefinition[]): boolean {
  return !edges.some((edge) => edge.target === nodeId);
}

export function edgeConditionLabel(condition: WorkflowEdgeCondition): string {
  const opText = condition.operator === "equals" ? "=" : condition.operator === "not_equals" ? "≠" : "contains";
  return `${condition.field} ${opText} "${condition.value}"`;
}

/**
 * Recomputes every edge's display label. A condition node's edges are always
 * labeled "If"/"Else" (fixed outputs). A bot node's edges show their field
 * condition, or "else" for its default edge only when it also branches
 * elsewhere (a single plain edge shows no label - it's just "next", not a
 * branch). Recomputed globally rather than per-edge since a sibling edge's
 * label can depend on the whole outgoing group, not just the edited edge.
 */
export function applyEdgeLabels(
  edges: Edge[],
  edgeConditionById: Map<string, WorkflowEdgeCondition>,
  edgeBranchById: Map<string, string>,
): Edge[] {
  const outgoingCount = new Map<string, number>();
  for (const edge of edges) {
    outgoingCount.set(edge.source, (outgoingCount.get(edge.source) ?? 0) + 1);
  }
  return edges.map((edge) => {
    const branch = edgeBranchById.get(edge.id);
    if (branch) return { ...edge, label: branchDisplayLabel(branch) };
    const condition = edgeConditionById.get(edge.id);
    const label = condition
      ? edgeConditionLabel(condition)
      : (outgoingCount.get(edge.source) ?? 0) > 1
        ? "else"
        : undefined;
    return { ...edge, label };
  });
}

export function definitionToFlowNode(
  node: WorkflowNodeDefinition,
  edges: WorkflowEdgeDefinition[],
  bots: Bot[],
): CanvasNode {
  const isRoot = computeIsRoot(node.id, edges);
  if (node.kind === "condition") {
    return {
      id: node.id,
      type: "condition",
      position: node.position,
      data: {
        label: node.label?.trim() || "Condition",
        combinator: node.combinator,
        clauses: node.clauses,
        isRoot,
      },
    };
  }
  if (node.kind === "parallel") {
    return {
      id: node.id,
      type: "parallel",
      position: node.position,
      data: { label: node.label?.trim() || "Parallel", branchIds: node.branchIds, isRoot },
    };
  }
  if (node.kind === "join") {
    return {
      id: node.id,
      type: "join",
      position: node.position,
      data: { label: node.label?.trim() || "Join", isRoot },
    };
  }
  if (node.kind === "judge") {
    return {
      id: node.id,
      type: "judge",
      position: node.position,
      data: {
        label: node.label?.trim() || "Judge",
        rubric: node.rubric,
        referenceField: node.referenceField,
        model: node.model,
        isRoot,
      },
    };
  }
  if (node.kind === "supervisor_scope") {
    return {
      id: node.id,
      type: "supervisor_scope",
      position: node.position,
      width: node.size.width,
      height: node.size.height,
      zIndex: -1,
      data: {
        label: node.label,
        instructions: node.instructions,
        model: node.model,
        bounds: node.bounds,
        memberNodeIds: node.memberNodeIds,
      },
    };
  }
  const bot = bots.find((b) => b.id === node.botId);
  return {
    id: node.id,
    type: "bot",
    position: node.position,
    data: {
      label: node.label?.trim() || bot?.name || "Untitled bot",
      botId: node.botId,
      botName: bot?.name ?? "Unknown bot",
      isRoot,
    },
  };
}

export function definitionsToFlow(
  nodes: WorkflowNodeDefinition[],
  edges: WorkflowEdgeDefinition[],
  bots: Bot[],
): { nodes: CanvasNode[]; edges: Edge[] } {
  const edgeConditionById = new Map(
    edges
      .filter((e): e is WorkflowEdgeDefinition & { condition: WorkflowEdgeCondition } => !!e.condition)
      .map((e) => [e.id, e.condition]),
  );
  const edgeBranchById = new Map(
    edges
      .filter((e): e is WorkflowEdgeDefinition & { branch: string } => !!e.branch)
      .map((e) => [e.id, e.branch]),
  );
  // sourceHandle must match the branch so a reloaded condition/parallel
  // node's edges reconnect to the right handle instead of bunching on one.
  const plainEdges: Edge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.branch,
  }));
  return {
    nodes: nodes.map((n) => definitionToFlowNode(n, edges, bots)),
    edges: applyEdgeLabels(plainEdges, edgeConditionById, edgeBranchById),
  };
}

/** The node definitions this app persists/exports don't carry React Flow's
 * own fields (type, data) - just the plain shape per node kind. This pulls
 * that back out of the live canvas state, keeping each bot node's
 * `outputSchema` and each edge's `condition`/`branch` (none of these are
 * represented in React Flow's own node/edge shape - they only live in the
 * ref maps the editor keeps alongside). */
export function flowToDefinitions(
  nodes: CanvasNode[],
  edges: Edge[],
  outputSchemaById: Map<string, WorkflowOutputSchema>,
  edgeConditionById: Map<string, WorkflowEdgeCondition>,
  edgeBranchById: Map<string, string>,
): { nodes: WorkflowNodeDefinition[]; edges: WorkflowEdgeDefinition[] } {
  return {
    nodes: nodes.map((n): WorkflowNodeDefinition => {
      if (n.type === "condition") {
        return {
          id: n.id,
          kind: "condition",
          label: n.data.label,
          combinator: n.data.combinator,
          clauses: n.data.clauses,
          position: n.position,
        };
      }
      if (n.type === "parallel") {
        return { id: n.id, kind: "parallel", label: n.data.label, branchIds: n.data.branchIds, position: n.position };
      }
      if (n.type === "join") {
        return { id: n.id, kind: "join", label: n.data.label, position: n.position };
      }
      if (n.type === "judge") {
        return {
          id: n.id,
          kind: "judge",
          label: n.data.label,
          rubric: n.data.rubric,
          referenceField: n.data.referenceField,
          model: n.data.model,
          position: n.position,
        };
      }
      if (n.type === "supervisor_scope") {
        return {
          id: n.id,
          kind: "supervisor_scope",
          label: n.data.label,
          instructions: n.data.instructions,
          model: n.data.model,
          bounds: n.data.bounds,
          memberNodeIds: n.data.memberNodeIds,
          position: n.position,
          size: {
            width: n.width ?? n.measured?.width ?? DEFAULT_SCOPE_SIZE.width,
            height: n.height ?? n.measured?.height ?? DEFAULT_SCOPE_SIZE.height,
          },
        };
      }
      return {
        id: n.id,
        botId: n.data.botId,
        label: n.data.label,
        outputSchema: outputSchemaById.get(n.id) ?? { fields: [] },
        position: n.position,
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      condition: edgeConditionById.get(e.id),
      branch: edgeBranchById.get(e.id),
    })),
  };
}

export type ExportedWorkflow = {
  nodes: (WorkflowNodeDefinition & { botName?: string })[];
  edges: WorkflowEdgeDefinition[];
};
/** Old export format, kept importable for backward compatibility - a flat
 * ordered array with edges inferred from adjacency. Can't represent
 * branches, which is exactly why the format changed. */
export type ExportedWorkflowNodeLegacy = WorkflowNodeDefinition & { botName?: string };

/** Clean shape for download/copy - the format the user re-imports. Validates
 * the graph first so an unrunnable workflow can't be exported silently. */
export function exportWorkflowNodes(
  nodes: WorkflowNodeDefinition[],
  edges: WorkflowEdgeDefinition[],
  bots: Bot[],
): ExportedWorkflow {
  validateGraph(nodes, edges);
  return {
    nodes: nodes.map((node) =>
      node.kind === "condition" ||
      node.kind === "parallel" ||
      node.kind === "join" ||
      node.kind === "judge" ||
      node.kind === "supervisor_scope"
        ? { ...node }
        : { ...node, botName: bots.find((b) => b.id === node.botId)?.name },
    ),
    edges,
  };
}

const IMPORT_NODE_SPACING_X = 280;

function toImportedNode(entry: ExportedWorkflowNodeLegacy, index: number): WorkflowNodeDefinition {
  const position = entry.position ?? { x: index * IMPORT_NODE_SPACING_X, y: 100 };
  const id = entry.id || crypto.randomUUID();
  if (entry.kind === "condition") {
    return { id, kind: "condition", label: entry.label, combinator: entry.combinator, clauses: entry.clauses, position };
  }
  if (entry.kind === "parallel") {
    return { id, kind: "parallel", label: entry.label, branchIds: entry.branchIds, position };
  }
  if (entry.kind === "join") {
    return { id, kind: "join", label: entry.label, position };
  }
  if (entry.kind === "judge") {
    return {
      id,
      kind: "judge",
      label: entry.label,
      rubric: entry.rubric,
      referenceField: entry.referenceField,
      model: entry.model,
      position,
    };
  }
  if (entry.kind === "supervisor_scope") {
    return {
      id,
      kind: "supervisor_scope",
      label: entry.label,
      instructions: entry.instructions,
      model: entry.model,
      bounds: entry.bounds,
      memberNodeIds: entry.memberNodeIds,
      position,
      size: entry.size ?? DEFAULT_SCOPE_SIZE,
    };
  }
  return { id, botId: entry.botId, label: entry.label, outputSchema: entry.outputSchema ?? { fields: [] }, position };
}

/** Rebuilds nodes/edges from an exported workflow: reuses ids/positions if
 * present, otherwise lays nodes out left-to-right. Accepts the current
 * `{nodes, edges}` object shape, or a plain array from an old export (before
 * branching existed) - reconstructed as a sequential chain, same as before. */
export function importWorkflowNodes(
  exported: ExportedWorkflow | ExportedWorkflowNodeLegacy[],
): { nodes: WorkflowNodeDefinition[]; edges: WorkflowEdgeDefinition[] } {
  if (Array.isArray(exported)) {
    const nodes = exported.map(toImportedNode);
    const edges: WorkflowEdgeDefinition[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ id: crypto.randomUUID(), source: nodes[i].id, target: nodes[i + 1].id });
    }
    return { nodes, edges };
  }

  const nodes = exported.nodes.map(toImportedNode);
  const edges: WorkflowEdgeDefinition[] = exported.edges.map((edge) => ({
    id: edge.id || crypto.randomUUID(),
    source: edge.source,
    target: edge.target,
    condition: edge.condition,
    branch: edge.branch,
  }));
  return { nodes, edges };
}
