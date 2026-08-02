"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OllamaModel } from "@/lib/ollama/provider";
import type { AvailableFieldSource } from "@/lib/workflow/graph";
import type { WorkflowJudgeNodeDefinition } from "@/lib/types";

export type JudgeDialogMode = { type: "create" } | { type: "edit"; node: WorkflowJudgeNodeDefinition };

export function JudgeNodeConfigPanel({
  mode,
  availableFields,
  onClose,
  onSave,
  onDelete,
}: {
  mode: JudgeDialogMode;
  /** Output fields of the nearest upstream bot - offered as the optional
   * "reference answer" field, same source as a condition node's clauses. */
  availableFields: AvailableFieldSource[];
  onClose: () => void;
  onSave: (values: { label: string; rubric: string; referenceField?: string; model: string }) => void;
  onDelete: (nodeId: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [rubric, setRubric] = useState("");
  const [referenceField, setReferenceField] = useState<string>("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ollama/models")
      .then((res) => res.json())
      .then((data: { models?: OllamaModel[]; error?: string }) => {
        if (data.error) {
          setModelsError(data.error);
          return;
        }
        setModels(data.models ?? []);
        setModel((current) => current || data.models?.[0]?.name || "");
      })
      .catch((err) => setModelsError(String(err)));
  }, []);

  useEffect(() => {
    if (mode.type === "edit") {
      setLabel(mode.node.label ?? "");
      setRubric(mode.node.rubric);
      setReferenceField(mode.node.referenceField ?? "");
      setModel((current) => mode.node.model || current);
    } else {
      setLabel("");
      setRubric("");
      setReferenceField("");
    }
  }, [mode]);

  const handleSave = () => {
    if (!model) return;
    onSave({ label: label.trim(), rubric: rubric.trim(), referenceField: referenceField || undefined, model });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background/95 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">{mode.type === "edit" ? "Edit judge" : "Add judge"}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          ×
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-2">
          <Label htmlFor="judge-node-label">Label (optional)</Label>
          <Input
            id="judge-node-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Judge"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="judge-node-rubric">Rubric</Label>
          <Textarea
            id="judge-node-rubric"
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            rows={5}
            placeholder="Pass if the answer is factually correct and cites a source..."
          />
        </div>

        {availableFields.length > 0 && (
          <div className="space-y-2">
            <Label>Reference field (optional)</Label>
            <Select value={referenceField} onValueChange={(v) => setReferenceField(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None - grade against the rubric alone" />
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
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Judge model</Label>
          {modelsError ? (
            <p className="text-sm text-destructive">Couldn&apos;t reach Ollama: {modelsError}.</p>
          ) : (
            <Select value={model} onValueChange={(value) => setModel(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.name} value={m.name}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
        <Button size="sm" onClick={handleSave} disabled={!model}>
          Save
        </Button>
      </div>
    </div>
  );
}
