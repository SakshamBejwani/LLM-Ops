"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OllamaModel } from "@/lib/ollama/provider";
import type { SupervisorBounds, WorkflowSupervisorScopeDefinition } from "@/lib/types";

export type SupervisorScopeDialogMode =
  | { type: "create" }
  | { type: "edit"; node: WorkflowSupervisorScopeDefinition };

const DEFAULT_BOUNDS: SupervisorBounds = { temperature: [0, 2], top_p: [0, 1] };

export function SupervisorScopeConfigPanel({
  mode,
  memberCount,
  onClose,
  onSave,
  onDelete,
}: {
  mode: SupervisorScopeDialogMode;
  /** Read-only - membership is computed by dragging bots into the box, not
   * edited here. */
  memberCount: number;
  onClose: () => void;
  onSave: (values: { label: string; instructions: string; model: string; bounds: SupervisorBounds }) => void;
  onDelete: (nodeId: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState("");
  const [bounds, setBounds] = useState<SupervisorBounds>(DEFAULT_BOUNDS);
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
      setLabel(mode.node.label);
      setInstructions(mode.node.instructions);
      setBounds(mode.node.bounds);
      setModel((current) => mode.node.model || current);
    } else {
      setLabel("Supervisor");
      setInstructions("");
      setBounds(DEFAULT_BOUNDS);
    }
  }, [mode]);

  const handleSave = () => {
    if (!model) return;
    onSave({ label: label.trim() || "Supervisor", instructions: instructions.trim(), model, bounds });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background/95 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">{mode.type === "edit" ? "Edit supervisor" : "Add supervisor"}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          ×
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-xs text-muted-foreground">
          Drag bot nodes so they sit inside this box on the canvas to put them under supervision - the box grows to
          fit them. Currently watching <span className="font-medium text-foreground">{memberCount}</span> bot
          {memberCount === 1 ? "" : "s"}.
        </p>

        <div className="space-y-2">
          <Label htmlFor="scope-label">Label</Label>
          <Input id="scope-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Supervisor" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="scope-instructions">Instructions</Label>
          <Textarea
            id="scope-instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={5}
            placeholder="Watch for repeated tool errors and lower temperature if a bot seems to be rambling..."
          />
        </div>

        <div className="space-y-2">
          <Label>Supervisor model</Label>
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Temperature bounds</Label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={bounds.temperature?.[0] ?? 0}
                onChange={(e) =>
                  setBounds((b) => ({ ...b, temperature: [Number(e.target.value), b.temperature?.[1] ?? 2] }))
                }
                className="h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={bounds.temperature?.[1] ?? 2}
                onChange={(e) =>
                  setBounds((b) => ({ ...b, temperature: [b.temperature?.[0] ?? 0, Number(e.target.value)] }))
                }
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Top P bounds</Label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={bounds.top_p?.[0] ?? 0}
                onChange={(e) => setBounds((b) => ({ ...b, top_p: [Number(e.target.value), b.top_p?.[1] ?? 1] }))}
                className="h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={bounds.top_p?.[1] ?? 1}
                onChange={(e) => setBounds((b) => ({ ...b, top_p: [b.top_p?.[0] ?? 0, Number(e.target.value)] }))}
                className="h-8 text-xs"
              />
            </div>
          </div>
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
