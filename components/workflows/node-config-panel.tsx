"use client";

import { useEffect, useState } from "react";
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
import { SchemaFieldBuilder } from "@/components/workflows/schema-field-builder";
import type { Bot, WorkflowBotNodeDefinition, WorkflowSchemaField } from "@/lib/types";

export type NodeDialogMode = { type: "create" } | { type: "edit"; node: WorkflowBotNodeDefinition };

const DEFAULT_FIELDS: WorkflowSchemaField[] = [{ name: "result", type: "string" }];

export function NodeConfigPanel({
  mode,
  bots,
  onClose,
  onSave,
  onDelete,
}: {
  mode: NodeDialogMode;
  bots: Bot[];
  onClose: () => void;
  onSave: (values: { botId: string; label: string; fields: WorkflowSchemaField[] }) => void;
  onDelete: (nodeId: string) => void;
}) {
  const [botId, setBotId] = useState("");
  const [label, setLabel] = useState("");
  const [fields, setFields] = useState<WorkflowSchemaField[]>(DEFAULT_FIELDS);

  useEffect(() => {
    if (mode.type === "edit") {
      setBotId(mode.node.botId);
      setLabel(mode.node.label ?? "");
      setFields(mode.node.outputSchema.fields.length > 0 ? mode.node.outputSchema.fields : DEFAULT_FIELDS);
    } else {
      setBotId(bots[0]?.id ?? "");
      setLabel("");
      setFields(DEFAULT_FIELDS);
    }
  }, [mode, bots]);

  const handleSave = () => {
    if (!botId) return;
    onSave({ botId, label: label.trim(), fields: fields.filter((f) => f.name.trim()) });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background/95 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">{mode.type === "edit" ? "Edit bot" : "Add bot"}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          ×
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-2">
          <Label>Bot</Label>
          {bots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bots yet - create one first.</p>
          ) : (
            <Select value={botId} onValueChange={(value) => setBotId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a bot">
                  {(value: string | null) => bots.find((b) => b.id === value)?.name ?? "Select a bot"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {bots.map((bot) => (
                  <SelectItem key={bot.id} value={bot.id}>
                    {bot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="node-label">Label (optional)</Label>
          <Input
            id="node-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={bots.find((b) => b.id === botId)?.name ?? "Step name"}
          />
        </div>

        <SchemaFieldBuilder fields={fields} onChange={setFields} />
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
        <Button size="sm" onClick={handleSave} disabled={!botId}>
          Save
        </Button>
      </div>
    </div>
  );
}
