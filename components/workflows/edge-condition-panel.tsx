"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WorkflowEdgeCondition, WorkflowEdgeDefinition, WorkflowSchemaField } from "@/lib/types";

const OPERATOR_LABELS: Record<WorkflowEdgeCondition["operator"], string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
};

const OPERATORS = Object.keys(OPERATOR_LABELS) as WorkflowEdgeCondition["operator"][];

export function EdgeConditionPanel({
  edge,
  sourceFields,
  onClose,
  onSave,
  onDelete,
}: {
  edge: WorkflowEdgeDefinition;
  sourceFields: WorkflowSchemaField[];
  onClose: () => void;
  onSave: (condition: WorkflowEdgeCondition | undefined) => void;
  onDelete: () => void;
}) {
  const [field, setField] = useState(edge.condition?.field ?? sourceFields[0]?.name ?? "");
  const [operator, setOperator] = useState<WorkflowEdgeCondition["operator"]>(edge.condition?.operator ?? "equals");
  const [value, setValue] = useState(edge.condition?.value ?? "");

  useEffect(() => {
    setField(edge.condition?.field ?? sourceFields[0]?.name ?? "");
    setOperator(edge.condition?.operator ?? "equals");
    setValue(edge.condition?.value ?? "");
  }, [edge, sourceFields]);

  const canSave = field !== "" && value.trim() !== "";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background/95 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Connection</span>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          ×
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-xs text-muted-foreground">
          By default a connection always fires. Add a condition on the source bot&apos;s output field
          to only follow it when the condition matches - use this to route based on a judge bot&apos;s
          verdict.
        </p>

        {sourceFields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The source bot has no output fields defined - add one in its node config first.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Field</Label>
              <Select value={field} onValueChange={(v) => setField(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a field" />
                </SelectTrigger>
                <SelectContent>
                  {sourceFields.map((f) => (
                    <SelectItem key={f.name} value={f.name}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Operator</Label>
              <Select value={operator} onValueChange={(v) => setOperator((v as WorkflowEdgeCondition["operator"]) ?? "equals")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op} value={op}>
                      {OPERATOR_LABELS[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edge-condition-value">Value</Label>
              <Input
                id="edge-condition-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. pass"
              />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 border-t p-3">
        <Button variant="destructive" size="sm" onClick={onDelete} className="mr-auto">
          Delete connection
        </Button>
        {edge.condition && (
          <Button variant="outline" size="sm" onClick={() => onSave(undefined)}>
            Clear condition
          </Button>
        )}
        <Button size="sm" onClick={() => onSave({ field, operator, value: value.trim() })} disabled={!canSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
