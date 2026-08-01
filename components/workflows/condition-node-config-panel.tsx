"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AvailableFieldSource } from "@/lib/workflow/graph";
import type { WorkflowConditionClause, WorkflowConditionNodeDefinition } from "@/lib/types";

export type ConditionDialogMode = { type: "create" } | { type: "edit"; node: WorkflowConditionNodeDefinition };

const OPERATOR_LABELS: Record<WorkflowConditionClause["operator"], string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
};

const OPERATORS = Object.keys(OPERATOR_LABELS) as WorkflowConditionClause["operator"][];

const EMPTY_CLAUSE: WorkflowConditionClause = { field: "", operator: "equals", value: "" };

export function ConditionNodeConfigPanel({
  mode,
  availableFields,
  onClose,
  onSave,
  onDelete,
}: {
  mode: ConditionDialogMode;
  /** Output fields of the nearest upstream bot, grouped by source - lets
   * clauses be picked from real data instead of typed blind. */
  availableFields: AvailableFieldSource[];
  onClose: () => void;
  onSave: (values: { label: string; combinator: "AND" | "OR"; clauses: WorkflowConditionClause[] }) => void;
  onDelete: (nodeId: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [combinator, setCombinator] = useState<"AND" | "OR">("AND");
  const [clauses, setClauses] = useState<WorkflowConditionClause[]>([EMPTY_CLAUSE]);

  useEffect(() => {
    if (mode.type === "edit") {
      setLabel(mode.node.label ?? "");
      setCombinator(mode.node.combinator);
      setClauses(mode.node.clauses.length > 0 ? mode.node.clauses : [EMPTY_CLAUSE]);
    } else {
      setLabel("");
      setCombinator("AND");
      setClauses([EMPTY_CLAUSE]);
    }
  }, [mode]);

  const updateClause = (index: number, patch: Partial<WorkflowConditionClause>) => {
    setClauses((cs) => cs.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeClause = (index: number) => {
    setClauses((cs) => cs.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({ label: label.trim(), combinator, clauses: clauses.filter((c) => c.field.trim()) });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background/95 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">{mode.type === "edit" ? "Edit condition" : "Add condition"}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          ×
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-2">
          <Label htmlFor="condition-node-label">Label (optional)</Label>
          <Input
            id="condition-node-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Condition"
          />
        </div>

        <div className="space-y-2">
          <Label>Match</Label>
          <div className="flex gap-1 rounded-lg border p-1">
            {(["AND", "OR"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCombinator(option)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  combinator === option
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {option === "AND" ? "All (AND)" : "Any (OR)"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Conditions</Label>
          <div className="space-y-2">
            {clauses.map((clause, index) => (
              <div key={index} className="space-y-1.5 rounded-md border p-2">
                <div className="flex items-center gap-1.5">
                  {availableFields.length > 0 ? (
                    <Select value={clause.field} onValueChange={(v) => updateClause(index, { field: v ?? "" })}>
                      <SelectTrigger className="h-8 flex-1 text-xs">
                        <SelectValue placeholder="field name" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFields.map((source) => (
                          <SelectGroup key={source.nodeId}>
                            <SelectLabel className="font-semibold text-foreground">{source.label}</SelectLabel>
                            {source.fields.map((f) => (
                              <SelectItem key={f.name} value={f.name}>
                                {f.name} <span className="text-muted-foreground">({f.type})</span>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                        {clause.field &&
                          !availableFields.some((source) => source.fields.some((f) => f.name === clause.field)) && (
                            <SelectItem value={clause.field}>{clause.field} (custom)</SelectItem>
                          )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={clause.field}
                      onChange={(e) => updateClause(index, { field: e.target.value })}
                      placeholder="field name"
                      className="h-8 flex-1 text-xs"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Remove condition"
                    onClick={() => removeClause(index)}
                  >
                    ×
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  <Select
                    value={clause.operator}
                    onValueChange={(v) =>
                      updateClause(index, { operator: (v as WorkflowConditionClause["operator"]) ?? "equals" })
                    }
                  >
                    <SelectTrigger className="h-8 flex-1 text-xs">
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
                  <Input
                    value={clause.value}
                    onChange={(e) => updateClause(index, { value: e.target.value })}
                    placeholder="value"
                    className="h-8 flex-1 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setClauses((cs) => [...cs, { ...EMPTY_CLAUSE }])}
          >
            Add condition
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t p-3">
        {mode.type === "edit" && (
          <Button variant="destructive" size="sm" onClick={() => onDelete(mode.node.id)} className="mr-auto">
            Delete
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
