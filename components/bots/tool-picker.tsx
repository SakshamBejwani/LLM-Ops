"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ToolOption } from "@/lib/types";

export function ToolPicker({
  value,
  onChange,
  excludeBotId,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  excludeBotId?: string;
}) {
  const [options, setOptions] = useState<ToolOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = excludeBotId ? `?excludeBotId=${excludeBotId}` : "";
    fetch(`/api/tools${params}`)
      .then((res) => res.json())
      .then((data: { tools: ToolOption[] }) => setOptions(data.tools ?? []))
      .finally(() => setLoading(false));
  }, [excludeBotId]);

  const toggle = (id: string, checked: boolean) => {
    onChange(checked ? [...value, id] : value.filter((v) => v !== id));
  };

  const builtins = options.filter((o) => o.kind === "builtin");
  const bots = options.filter((o) => o.kind === "bot");

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading tools…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">Built-in tools</p>
        <div className="space-y-2">
          {builtins.map((tool) => (
            <ToolRow key={tool.id} tool={tool} checked={value.includes(tool.id)} onToggle={toggle} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Other bots (delegate as a tool)</p>
        {bots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other bots yet.</p>
        ) : (
          <div className="space-y-2">
            {bots.map((tool) => (
              <ToolRow key={tool.id} tool={tool} checked={value.includes(tool.id)} onToggle={toggle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolRow({
  tool,
  checked,
  onToggle,
}: {
  tool: ToolOption;
  checked: boolean;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={tool.id}
        checked={checked}
        onCheckedChange={(value) => onToggle(tool.id, value === true)}
      />
      <Label htmlFor={tool.id} className="flex flex-col gap-0.5 font-normal">
        <span className="font-medium">{tool.name}</span>
        <span className="text-xs text-muted-foreground">{tool.description}</span>
      </Label>
    </div>
  );
}
