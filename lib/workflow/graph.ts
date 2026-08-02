import type {
  WorkflowConditionClause,
  WorkflowEdgeCondition,
  WorkflowEdgeDefinition,
  WorkflowNodeDefinition,
  WorkflowOutputSchema,
  WorkflowSchemaField,
} from "@/lib/types";

/** Thrown for any graph shape execution can't handle - callers show `.message`
 * directly to the user (in the canvas UI and as an API 400). */
export class WorkflowGraphError extends Error {}

/**
 * Structural validation for a workflow graph. Branching (a node with several
 * outgoing edges, routed by condition at runtime) is allowed; merging isn't,
 * with one exception - a `join` node, which exists specifically to receive
 * every branch of a matching `parallel` node's fan-out. Everywhere else, a
 * node has at most one incoming edge, which keeps "what does this node
 * receive as input" unambiguous without needing to model how to combine
 * arbitrary upstream outputs. Loops aren't allowed either (see
 * `resolveNextEdge` - this is deliberately a DAG, not a general graph).
 */
export function validateGraph(allNodes: WorkflowNodeDefinition[], edges: WorkflowEdgeDefinition[]): void {
  // Supervisor scopes are a canvas-only annotation layer, not part of the
  // execution chain - they carry no edges and are excluded from every check
  // below (root-finding, reachability, cycle detection).
  const nodes = allNodes.filter((n) => n.kind !== "supervisor_scope");
  if (nodes.length === 0) {
    throw new WorkflowGraphError("Add at least one bot to the workflow before running it.");
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, WorkflowEdgeDefinition[]>();
  const incoming = new Map<string, WorkflowEdgeDefinition[]>();

  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      throw new WorkflowGraphError("A connection references a bot that no longer exists.");
    }
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge]);
  }

  for (const node of nodes) {
    const label = node.label ?? node.id;
    const nodeIncoming = incoming.get(node.id)?.length ?? 0;
    if (node.kind !== "join" && nodeIncoming > 1) {
      throw new WorkflowGraphError(
        `"${label}" has more than one incoming connection - workflows must be a single chain, not a merging graph.`,
      );
    }

    const nodeOutgoing = outgoing.get(node.id) ?? [];
    if (node.kind === "condition") {
      if (nodeOutgoing.some((e) => !e.branch)) {
        throw new WorkflowGraphError(
          `"${label}" is a condition node - its connections need an if/else branch, not a field condition.`,
        );
      }
      const ifCount = nodeOutgoing.filter((e) => e.branch === "if").length;
      const elseCount = nodeOutgoing.filter((e) => e.branch === "else").length;
      if (ifCount > 1 || elseCount > 1) {
        throw new WorkflowGraphError(
          `"${label}" has more than one "${ifCount > 1 ? "if" : "else"}" connection - a condition node has exactly one of each.`,
        );
      }
    } else if (node.kind === "judge") {
      if (nodeOutgoing.some((e) => !e.branch)) {
        throw new WorkflowGraphError(
          `"${label}" is a judge node - its connections need a pass/fail branch, not a field condition.`,
        );
      }
      const passCount = nodeOutgoing.filter((e) => e.branch === "pass").length;
      const failCount = nodeOutgoing.filter((e) => e.branch === "fail").length;
      if (passCount > 1 || failCount > 1) {
        throw new WorkflowGraphError(
          `"${label}" has more than one "${passCount > 1 ? "pass" : "fail"}" connection - a judge node has exactly one of each.`,
        );
      }
    } else if (node.kind === "parallel") {
      const invalidBranch = nodeOutgoing.find((e) => !e.branch || !node.branchIds.includes(e.branch));
      if (invalidBranch) {
        throw new WorkflowGraphError(`"${label}" has a connection that isn't one of its branches.`);
      }
      for (const branchId of node.branchIds) {
        if (nodeOutgoing.filter((e) => e.branch === branchId).length > 1) {
          throw new WorkflowGraphError(`"${label}" has more than one connection for the same branch.`);
        }
      }
    } else if (node.kind === "join") {
      // Fan-in is exactly what a join node is for - no per-edge shape checks.
    } else {
      if (nodeOutgoing.some((e) => e.branch)) {
        throw new WorkflowGraphError(
          `"${label}" is a bot node - its connections need a field condition (or none), not an if/else branch.`,
        );
      }
      const defaultEdges = nodeOutgoing.filter((e) => !e.condition);
      if (defaultEdges.length > 1) {
        throw new WorkflowGraphError(
          `"${label}" has more than one default connection - only one outgoing edge may be left without a condition; give the others a condition.`,
        );
      }
    }
  }

  const roots = nodes.filter((n) => (incoming.get(n.id)?.length ?? 0) === 0);
  if (roots.length === 0) {
    throw new WorkflowGraphError("No starting bot found - the workflow has a cycle.");
  }
  if (roots.length > 1) {
    throw new WorkflowGraphError(
      "Workflow has more than one starting bot - connect every bot into a single chain.",
    );
  }

  // Reachability + cycle check: walk every outgoing edge from the root (not
  // just one, since a node can now branch). A join node revisited from a
  // second branch is expected, not a cycle - only re-reaching a non-join node
  // (or a join from the same branch twice) is genuinely one.
  const visited = new Set<string>();
  const stack: string[] = [roots[0].id];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    for (const edge of outgoing.get(currentId) ?? []) {
      const targetNode = nodeById.get(edge.target);
      if (visited.has(edge.target) && targetNode?.kind !== "join") {
        throw new WorkflowGraphError("Workflow has a cycle - a bot's output eventually feeds back into itself.");
      }
      stack.push(edge.target);
    }
  }

  if (visited.size !== nodes.length) {
    const strandedCount = nodes.length - visited.size;
    throw new WorkflowGraphError(
      `${strandedCount} bot${strandedCount === 1 ? " isn't" : "s aren't"} connected to the chain - connect every bot or remove it.`,
    );
  }

  for (const node of nodes) {
    if (node.kind === "parallel") validateParallelGroup(node, nodeById, outgoing);
  }
}

/**
 * A `parallel` node's branches must each terminate at the same `join` node,
 * with no earlier re-merge - a clean diamond. Nested parallel/join pairs
 * inside a branch aren't supported yet (each branch's DFS must hit the outer
 * join before any inner parallel node would fan out again).
 */
function validateParallelGroup(
  node: WorkflowNodeDefinition & { kind: "parallel" },
  nodeById: Map<string, WorkflowNodeDefinition>,
  outgoing: Map<string, WorkflowEdgeDefinition[]>,
): void {
  const label = node.label ?? node.id;
  let joinId: string | undefined;

  for (const branchId of node.branchIds) {
    const startEdge = outgoing.get(node.id)?.find((e) => e.branch === branchId);
    if (!startEdge) continue; // an unconnected branch is a valid, unfinished draft

    let currentId = startEdge.target;
    const visitedInBranch = new Set<string>([node.id]);
    while (true) {
      if (visitedInBranch.has(currentId)) {
        throw new WorkflowGraphError(`"${label}" has a branch that loops back on itself.`);
      }
      visitedInBranch.add(currentId);
      const currentNode = nodeById.get(currentId);
      if (currentNode?.kind === "join") {
        if (joinId && joinId !== currentId) {
          throw new WorkflowGraphError(`"${label}"'s branches must all converge on the same join node.`);
        }
        joinId = currentId;
        break;
      }
      if (currentNode?.kind === "parallel") {
        throw new WorkflowGraphError(`"${label}" has a branch that fans out again before reaching a join - nested parallel branches aren't supported yet.`);
      }
      const nextEdges = outgoing.get(currentId) ?? [];
      if (nextEdges.length === 0) break; // branch dead-ends before a join - valid, unfinished draft
      if (nextEdges.length > 1) {
        throw new WorkflowGraphError(`"${label}" has a branch that itself branches before reaching a join.`);
      }
      currentId = nextEdges[0].target;
    }
  }
}

function stringifyFieldValue(output: unknown, field: string): string {
  if (typeof output !== "object" || output === null) return "";
  const value = (output as Record<string, unknown>)[field];
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function evaluateCondition(condition: WorkflowEdgeCondition, output: unknown): boolean {
  const actual = stringifyFieldValue(output, condition.field).trim().toLowerCase();
  const expected = condition.value.trim().toLowerCase();
  switch (condition.operator) {
    case "equals":
      return actual === expected;
    case "not_equals":
      return actual !== expected;
    case "contains":
      return actual.includes(expected);
  }
}

/**
 * Picks which outgoing edge to follow after a node finishes, given its
 * structured output: the first edge whose condition matches, else the
 * conditionless default edge if one exists, else `undefined` - that branch
 * legitimately ends there (e.g. a judge's "fail" path with nothing wired up
 * yet is a valid outcome, not an error).
 */
export function resolveNextEdge(
  nodeId: string,
  edges: WorkflowEdgeDefinition[],
  output: unknown,
): WorkflowEdgeDefinition | undefined {
  const outgoing = edges.filter((e) => e.source === nodeId);
  const matched = outgoing.find((e) => e.condition && evaluateCondition(e.condition, output));
  if (matched) return matched;
  return outgoing.find((e) => !e.condition);
}

/** Picks the edge for a condition node's decided branch, or one of a
 * parallel node's fixed `branchIds` - parallel to `resolveNextEdge` but for
 * fixed outputs instead of field conditions. `undefined` means that branch
 * isn't wired up, a valid dead end. */
export function resolveBranchEdge(
  nodeId: string,
  edges: WorkflowEdgeDefinition[],
  branch: string,
): WorkflowEdgeDefinition | undefined {
  return edges.find((e) => e.source === nodeId && e.branch === branch);
}

/**
 * Finds the join node a `parallel` node's branches converge on, by walking
 * one branch forward until it hits a `join` (mirrors the DFS in
 * `validateParallelGroup`, which already guarantees every connected branch
 * reaches the same one). Returns `undefined` if no branch is wired up yet.
 */
export function findParallelJoin(
  parallelNodeId: string,
  nodes: WorkflowNodeDefinition[],
  edges: WorkflowEdgeDefinition[],
): string | undefined {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outgoingFrom = (id: string) => edges.filter((e) => e.source === id);
  for (const startEdge of outgoingFrom(parallelNodeId)) {
    let currentId = startEdge.target;
    while (true) {
      const node = nodeById.get(currentId);
      if (!node) break;
      if (node.kind === "join") return node.id;
      const next = outgoingFrom(currentId);
      if (next.length !== 1) break;
      currentId = next[0].target;
    }
  }
  return undefined;
}

/**
 * Evaluates a condition node's clauses against whatever data is currently
 * flowing through the workflow, combined with its AND/OR combinator.
 */
export function evaluateConditionNode(
  combinator: "AND" | "OR",
  clauses: WorkflowConditionClause[],
  input: unknown,
): boolean {
  if (clauses.length === 0) return false;
  const results = clauses.map((clause) => evaluateCondition(clause, input));
  return combinator === "AND" ? results.every(Boolean) : results.some(Boolean);
}

export type AvailableFieldSource = {
  nodeId: string;
  label: string;
  fields: WorkflowSchemaField[];
};

/**
 * Walks backward from a node through its incoming-edge lineage, skipping over
 * condition/parallel/join nodes (they pass data through unchanged - see
 * lib/workflow/run.ts), to find the nearest ancestor that actually produces
 * fields - a bot node's `outputSchema`. That's the real shape of whatever
 * data reaches this node at runtime, which is what a condition's clauses
 * should be built against.
 *
 * A join node has more than one incoming edge (the only such case - fan-in is
 * banned everywhere else); this walks its first one, which is an
 * approximation (the real runtime value is all branches' outputs merged) but
 * good enough for suggesting field names in the UI.
 *
 * Returns at most one source today, but the return type is a list so any
 * future node kind that *can* combine multiple inputs doesn't need this
 * signature to change.
 */
export function resolveAvailableFields(
  nodeId: string,
  nodes: WorkflowNodeDefinition[],
  edges: WorkflowEdgeDefinition[],
): AvailableFieldSource[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const incomingEdgesByTarget = new Map<string, WorkflowEdgeDefinition[]>();
  for (const edge of edges) {
    incomingEdgesByTarget.set(edge.target, [...(incomingEdgesByTarget.get(edge.target) ?? []), edge]);
  }

  const visited = new Set<string>();
  let incoming = incomingEdgesByTarget.get(nodeId)?.[0];
  while (incoming) {
    if (visited.has(incoming.source)) return []; // guard against a stray cycle
    visited.add(incoming.source);
    const sourceNode = nodeById.get(incoming.source);
    if (!sourceNode) return [];
    if (
      sourceNode.kind !== "condition" &&
      sourceNode.kind !== "parallel" &&
      sourceNode.kind !== "join" &&
      sourceNode.kind !== "judge" &&
      sourceNode.kind !== "supervisor_scope"
    ) {
      return [{ nodeId: sourceNode.id, label: sourceNode.label ?? "Bot", fields: sourceNode.outputSchema.fields }];
    }
    incoming = incomingEdgesByTarget.get(sourceNode.id)?.[0];
  }
  return [];
}

/** Converts the UI-built field list into a plain JSON Schema object (draft-7
 * shaped). Passed to the AI SDK's `jsonSchema()` helper at call time. */
export function buildJsonSchema(schema: WorkflowOutputSchema): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const field of schema.fields) {
    if (!field.name.trim()) continue;
    properties[field.name] = {
      type: field.type,
      ...(field.description ? { description: field.description } : {}),
    };
    required.push(field.name);
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}
