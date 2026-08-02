import { z } from "zod";

export const workflowSchemaFieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean"]),
  description: z.string().optional(),
});

export const workflowBotNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("bot").optional(),
  botId: z.string().min(1),
  label: z.string().optional(),
  outputSchema: z.object({ fields: z.array(workflowSchemaFieldSchema) }),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const workflowConditionClauseSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["equals", "not_equals", "contains"]),
  value: z.string(),
});

export const workflowConditionNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("condition"),
  label: z.string().optional(),
  combinator: z.enum(["AND", "OR"]),
  clauses: z.array(workflowConditionClauseSchema),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const workflowParallelNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("parallel"),
  label: z.string().optional(),
  branchIds: z.array(z.string().min(1)),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const workflowJoinNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("join"),
  label: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const workflowJudgeNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("judge"),
  label: z.string().optional(),
  rubric: z.string(),
  referenceField: z.string().optional(),
  model: z.string().min(1),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const supervisorBoundsSchema = z.object({
  temperature: z.tuple([z.number(), z.number()]).optional(),
  top_p: z.tuple([z.number(), z.number()]).optional(),
});

export const workflowSupervisorScopeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("supervisor_scope"),
  label: z.string(),
  instructions: z.string(),
  model: z.string().min(1),
  bounds: supervisorBoundsSchema,
  position: z.object({ x: z.number(), y: z.number() }),
  size: z.object({ width: z.number(), height: z.number() }),
  memberNodeIds: z.array(z.string()),
});

export const workflowNodeSchema = z.union([
  workflowConditionNodeSchema,
  workflowParallelNodeSchema,
  workflowJoinNodeSchema,
  workflowJudgeNodeSchema,
  workflowSupervisorScopeSchema,
  workflowBotNodeSchema,
]);

export const workflowEdgeConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["equals", "not_equals", "contains"]),
  value: z.string(),
});

export const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  condition: workflowEdgeConditionSchema.optional(),
  branch: z.string().optional(),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  nodes: z.array(workflowNodeSchema).default([]),
  edges: z.array(workflowEdgeSchema).default([]),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  nodes: z.array(workflowNodeSchema).optional(),
  edges: z.array(workflowEdgeSchema).optional(),
});
