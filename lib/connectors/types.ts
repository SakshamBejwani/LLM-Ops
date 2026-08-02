import { z } from "zod";

export type ConnectorType = "mcp" | "web_search" | "weather" | "github" | "slack_webhook" | "email";

export const CONNECTOR_TYPES: ConnectorType[] = [
  "mcp",
  "web_search",
  "weather",
  "github",
  "slack_webhook",
  "email",
];

export const mcpConfigSchema = z.discriminatedUnion("transport", [
  z.object({
    transport: z.literal("stdio"),
    command: z.string().min(1),
    args: z.array(z.string()).optional(),
  }),
  z.object({
    transport: z.literal("sse"),
    url: z.string().url(),
    headers: z.record(z.string(), z.string()).optional(),
  }),
]);
export type McpConfig = z.infer<typeof mcpConfigSchema>;

export const webSearchConfigSchema = z.object({
  provider: z.enum(["tavily", "serper"]),
  apiKey: z.string().min(1),
});
export type WebSearchConfig = z.infer<typeof webSearchConfigSchema>;

export const weatherConfigSchema = z.object({});
export type WeatherConfig = z.infer<typeof weatherConfigSchema>;

export const githubConfigSchema = z.object({
  token: z.string().min(1),
});
export type GithubConfig = z.infer<typeof githubConfigSchema>;

export const slackWebhookConfigSchema = z.object({
  webhookUrl: z.string().url(),
});
export type SlackWebhookConfig = z.infer<typeof slackWebhookConfigSchema>;

export const emailConfigSchema = z.object({
  apiKey: z.string().min(1),
  fromAddress: z.string().email(),
});
export type EmailConfig = z.infer<typeof emailConfigSchema>;

export const connectorConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mcp"), config: mcpConfigSchema }),
  z.object({ type: z.literal("web_search"), config: webSearchConfigSchema }),
  z.object({ type: z.literal("weather"), config: weatherConfigSchema }),
  z.object({ type: z.literal("github"), config: githubConfigSchema }),
  z.object({ type: z.literal("slack_webhook"), config: slackWebhookConfigSchema }),
  z.object({ type: z.literal("email"), config: emailConfigSchema }),
]);

export type Connector = {
  id: string;
  type: ConnectorType;
  name: string;
  description: string | null;
  config: McpConfig | WebSearchConfig | WeatherConfig | GithubConfig | SlackWebhookConfig | EmailConfig;
  enabled: boolean;
  created_at: string;
};

export function connectorConfigSchemaFor(type: "mcp"): typeof mcpConfigSchema;
export function connectorConfigSchemaFor(type: "web_search"): typeof webSearchConfigSchema;
export function connectorConfigSchemaFor(type: "weather"): typeof weatherConfigSchema;
export function connectorConfigSchemaFor(type: "github"): typeof githubConfigSchema;
export function connectorConfigSchemaFor(type: "slack_webhook"): typeof slackWebhookConfigSchema;
export function connectorConfigSchemaFor(type: "email"): typeof emailConfigSchema;
export function connectorConfigSchemaFor(type: ConnectorType) {
  switch (type) {
    case "mcp":
      return mcpConfigSchema;
    case "web_search":
      return webSearchConfigSchema;
    case "weather":
      return weatherConfigSchema;
    case "github":
      return githubConfigSchema;
    case "slack_webhook":
      return slackWebhookConfigSchema;
    case "email":
      return emailConfigSchema;
  }
}
