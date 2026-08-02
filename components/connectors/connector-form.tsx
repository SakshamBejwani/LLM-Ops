"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONNECTOR_TYPES, type ConnectorType } from "@/lib/connectors/types";

const TYPE_LABELS: Record<ConnectorType, string> = {
  mcp: "MCP server",
  web_search: "Web search",
  weather: "Weather (Open-Meteo)",
  github: "GitHub",
  slack_webhook: "Slack webhook",
  email: "Email (Resend)",
  vision_grounding: "Vision grounding (VLM object localization)",
};

export type ConnectorFormValues = {
  name: string;
  description: string;
  type: ConnectorType;
  config: Record<string, unknown>;
  enabled: boolean;
};

export function ConnectorForm({
  initialValues,
  connectorId,
  submitLabel,
  onSubmit,
}: {
  initialValues?: Partial<ConnectorFormValues>;
  /** Only set once the connector already exists - enables the Test button. */
  connectorId?: string;
  submitLabel: string;
  onSubmit: (values: ConnectorFormValues) => Promise<void>;
}) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [type, setType] = useState<ConnectorType>(initialValues?.type ?? "web_search");
  const [enabled, setEnabled] = useState(initialValues?.enabled ?? true);
  const [config, setConfig] = useState<Record<string, unknown>>(initialValues?.config ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (key: string, value: unknown) => setConfig((c) => ({ ...c, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), type, config, enabled });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!connectorId) return;
    setTesting(true);
    try {
      const res = await fetch(`/api/connectors/${connectorId}/test`, { method: "POST" });
      const data = await res.json();
      if (data.ok) toast.success(data.message ?? "Connector works.");
      else toast.error(data.error ?? "Test failed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="connector-name">Name</Label>
        <Input
          id="connector-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Web Search"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="connector-description">Description</Label>
        <Textarea
          id="connector-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Shown to bots choosing which tools to use."
        />
      </div>

      <div className="space-y-2">
        <Label>Type</Label>
        <Select
          value={type}
          onValueChange={(value) => {
            setType(value as ConnectorType);
            setConfig({});
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONNECTOR_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ConnectorConfigFields type={type} config={config} setField={setField} />

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Enabled</p>
          <p className="text-xs text-muted-foreground">Disabled connectors are hidden from bots&apos; tool lists.</p>
        </div>
        <Switch checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
        {connectorId && (
          <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? "Testing…" : "Test connection"}
          </Button>
        )}
      </div>
    </form>
  );
}

function ConnectorConfigFields({
  type,
  config,
  setField,
}: {
  type: ConnectorType;
  config: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
}) {
  switch (type) {
    case "weather":
      return <p className="text-sm text-muted-foreground">No configuration needed - Open-Meteo requires no API key.</p>;

    case "web_search":
      return (
        <>
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={(config.provider as string) ?? "tavily"} onValueChange={(v) => setField("provider", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tavily">Tavily</SelectItem>
                <SelectItem value="serper">Serper</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="connector-api-key">API key</Label>
            <Input
              id="connector-api-key"
              type="password"
              value={(config.apiKey as string) ?? ""}
              onChange={(e) => setField("apiKey", e.target.value)}
            />
          </div>
        </>
      );

    case "github":
      return (
        <div className="space-y-2">
          <Label htmlFor="connector-token">Personal access token</Label>
          <Input
            id="connector-token"
            type="password"
            value={(config.token as string) ?? ""}
            onChange={(e) => setField("token", e.target.value)}
          />
        </div>
      );

    case "slack_webhook":
      return (
        <div className="space-y-2">
          <Label htmlFor="connector-webhook-url">Incoming webhook URL</Label>
          <Input
            id="connector-webhook-url"
            value={(config.webhookUrl as string) ?? ""}
            onChange={(e) => setField("webhookUrl", e.target.value)}
            placeholder="https://hooks.slack.com/services/…"
          />
        </div>
      );

    case "email":
      return (
        <>
          <div className="space-y-2">
            <Label htmlFor="connector-resend-key">Resend API key</Label>
            <Input
              id="connector-resend-key"
              type="password"
              value={(config.apiKey as string) ?? ""}
              onChange={(e) => setField("apiKey", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="connector-from-address">From address</Label>
            <Input
              id="connector-from-address"
              value={(config.fromAddress as string) ?? ""}
              onChange={(e) => setField("fromAddress", e.target.value)}
              placeholder="bot@yourdomain.com"
            />
          </div>
        </>
      );

    case "vision_grounding":
      return (
        <>
          <div className="space-y-2">
            <Label htmlFor="connector-vg-base-url">Server URL</Label>
            <Input
              id="connector-vg-base-url"
              value={(config.baseUrl as string) ?? ""}
              onChange={(e) => setField("baseUrl", e.target.value)}
              placeholder="http://host:8000"
            />
            <p className="text-xs text-muted-foreground">
              Your self-hosted vLLM/SGLang server, exposing an OpenAI-compatible API. Must be reachable from
              this app&apos;s server process - and separately, the server itself must be able to reach any
              image URL a bot passes it, since this app never downloads the image itself.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="connector-vg-model">Model name</Label>
            <Input
              id="connector-vg-model"
              value={(config.model as string) ?? ""}
              onChange={(e) => setField("model", e.target.value)}
              placeholder="nvidia/LocateAnything-3B"
            />
            <p className="text-xs text-muted-foreground">
              Must exactly match the server&apos;s --model or --served-model-name value.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="connector-vg-api-key">API key (optional)</Label>
            <Input
              id="connector-vg-api-key"
              type="password"
              value={(config.apiKey as string) ?? ""}
              onChange={(e) => setField("apiKey", e.target.value)}
              placeholder="Leave blank if the server has no --api-key set"
            />
          </div>
        </>
      );

    case "mcp": {
      const transport = (config.transport as string) ?? "stdio";
      return (
        <>
          <div className="space-y-2">
            <Label>Transport</Label>
            <Select value={transport} onValueChange={(v) => setField("transport", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">Local process (stdio)</SelectItem>
                <SelectItem value="sse">Remote server (SSE/HTTP)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {transport === "stdio" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="connector-mcp-command">Command</Label>
                <Input
                  id="connector-mcp-command"
                  value={(config.command as string) ?? ""}
                  onChange={(e) => setField("command", e.target.value)}
                  placeholder="npx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="connector-mcp-args">Arguments (space-separated)</Label>
                <Input
                  id="connector-mcp-args"
                  value={((config.args as string[]) ?? []).join(" ")}
                  onChange={(e) => setField("args", e.target.value.split(/\s+/).filter(Boolean))}
                  placeholder="-y @modelcontextprotocol/server-filesystem /path"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="connector-mcp-url">Server URL</Label>
              <Input
                id="connector-mcp-url"
                value={(config.url as string) ?? ""}
                onChange={(e) => setField("url", e.target.value)}
                placeholder="https://example.com/mcp"
              />
            </div>
          )}
        </>
      );
    }
  }
}
