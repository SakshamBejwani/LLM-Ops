"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkflowFieldType, WorkflowSchemaField } from "@/lib/types";

const TYPES: WorkflowFieldType[] = ["string", "number", "boolean"];

export function SchemaFieldBuilder({
  fields,
  onChange,
}: {
  fields: WorkflowSchemaField[];
  onChange: (fields: WorkflowSchemaField[]) => void;
}) {
  const update = (index: number, patch: Partial<WorkflowSchemaField>) => {
    onChange(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  };

  const remove = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...fields, { name: "", type: "string" }]);
  };

  return (
    <div className="space-y-2">
      <Label>Output schema</Label>
      <p className="text-xs text-muted-foreground">
        Fields this bot must return - the next bot in the chain receives this as its input.
      </p>

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No fields yet - add at least one.</p>
      )}

      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={index} className="flex items-start gap-2">
            <Input
              value={field.name}
              onChange={(e) => update(index, { name: e.target.value })}
              placeholder="field_name"
              className="flex-1"
            />
            <Select
              value={field.type}
              onValueChange={(value) => update(index, { type: (value as WorkflowFieldType) ?? "string" })}
            >
              <SelectTrigger className="w-28 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={field.description ?? ""}
              onChange={(e) => update(index, { description: e.target.value })}
              placeholder="description (optional)"
              className="flex-1"
            />
            <Button variant="ghost" size="sm" onClick={() => remove(index)}>
              Remove
            </Button>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={add}>
        Add field
      </Button>
    </div>
  );
}
