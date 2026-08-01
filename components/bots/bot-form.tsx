"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToolPicker } from "@/components/bots/tool-picker";
import type { OllamaModel } from "@/lib/ollama/provider";

export type BotFormValues = {
  name: string;
  system_prompt: string;
  model: string;
  temperature: number;
  tool_ids: string[];
};

export function BotForm({
  initialValues,
  excludeBotId,
  submitLabel,
  onSubmit,
}: {
  initialValues?: Partial<BotFormValues>;
  excludeBotId?: string;
  submitLabel: string;
  onSubmit: (values: BotFormValues) => Promise<void>;
}) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initialValues?.system_prompt ?? "");
  const [model, setModel] = useState(initialValues?.model ?? "");
  const [temperature, setTemperature] = useState(initialValues?.temperature ?? 0.7);
  const [toolIds, setToolIds] = useState<string[]>(initialValues?.tool_ids ?? []);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !model) {
      setError("Name and model are required.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), system_prompt: systemPrompt, model, temperature, tool_ids: toolIds });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="bot-name">Name</Label>
        <Input
          id="bot-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Research Assistant"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bot-system-prompt">System prompt</Label>
        <Textarea
          id="bot-system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={5}
          placeholder="You are a helpful assistant that..."
        />
      </div>

      <div className="space-y-2">
        <Label>Model</Label>
        {modelsError ? (
          <p className="text-sm text-destructive">
            Couldn&apos;t reach Ollama: {modelsError}. Is it running on localhost:11434?
          </p>
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Temperature</Label>
          <span className="text-sm text-muted-foreground">{(temperature ?? 0.7).toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={temperature ?? 0.7}
          onChange={(e) => setTemperature(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        />
      </div>

      <div className="space-y-2">
        <Label>Tools</Label>
        <ToolPicker value={toolIds} onChange={setToolIds} excludeBotId={excludeBotId} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
