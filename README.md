<div align="center">

# LLM Engineering Playground

**A self-hosted workbench for building, observing, and orchestrating local LLM agents.**

Build bots with tools, chat with your own documents via real RAG, chain agents together on a visual workflow canvas with branching logic, and watch every request, tool call, and token stream in a live observability dashboard — all running on your own machine against [Ollama](https://ollama.com), with zero cloud API keys required.

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20pgvector-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Ollama](https://img.shields.io/badge/Ollama-local%20inference-000000?logo=ollama&logoColor=white)](https://ollama.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)

</div>

---

## What is this?

LLM Engineering Playground is a hands-on environment for the parts of LLM application engineering that are hard to learn from docs alone: tool-calling agents, retrieval-augmented generation, multi-agent orchestration, and the observability you need to debug all of it. Everything runs locally against Ollama, with Postgres (via Supabase) as the single source of truth for bots, conversations, documents, and workflow runs.

## Features

### 🤖 Bot Builder
Create bots with a system prompt, model, temperature, and a toolbelt. Tools are composable — attach built-in tools (calculator, weather, document search) **or attach another bot as a tool**, enabling recursive agent-calls-agent patterns out of the box.

### 📚 Retrieval-Augmented Generation
Upload documents, chunk and embed them locally with `nomic-embed-text` via Ollama, and store vectors in Postgres with `pgvector`. Any bot with the `search_docs` tool can retrieve and cite real content — no external embedding API involved.

### 🧵 Workflows Canvas
A visual, [React Flow](https://reactflow.dev)-based canvas for chaining bots into multi-step pipelines:
- **Bot nodes** run an LLM call with a structured output schema you define per node.
- **Condition nodes** route execution down an `if` / `else` path based on N clauses combined with `AND`/`OR` — no LLM call spent on deterministic routing.
- **Edge conditions** let a bot's own structured output (e.g. an LLM-as-judge verdict) pick the next node directly.
- Field pickers throughout are populated live from upstream nodes' output schemas, so you wire pipelines against real data shapes instead of typing field names blind.
- Save, run, inspect history, and export/import workflows as JSON.

### 📡 Live Observability
Every request — chat, workflow node, or nested bot-as-tool call — streams through a real-time event bus onto a dashboard: live request waterfalls, token/latency/TTFT metrics, nested tool-call trees, and full run history persisted in Postgres.

### 🛝 Playground
A multi-column comparison view for running the same prompt across multiple bots side by side, with nested run cards for tool calls and sub-agent invocations.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack), React 19, TypeScript (strict) |
| UI | Tailwind CSS v4, shadcn/ui (base-ui), Zustand |
| Canvas | `@xyflow/react` |
| LLM runtime | [AI SDK v7](https://sdk.vercel.ai) + `@ai-sdk/openai-compatible` against local [Ollama](https://ollama.com) |
| Embeddings | `nomic-embed-text` via Ollama's OpenAI-compatible `/v1/embeddings` |
| Database | Supabase (local Postgres) + `pgvector` for embeddings |
| Validation | Zod |

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────────────┐
│   Next.js    │────▶│   API routes      │────▶│  Ollama (local inference) │
│  App Router  │     │ (bots, chat,      │     │  + nomic-embed-text       │
│  UI          │◀────│  workflows, docs) │◀────│                            │
└──────┬───────┘     └────────┬──────────┘     └──────────────────────────┘
       │                      │
       │ SSE event bus        ▼
       │              ┌───────────────┐
       └─────────────▶│   Supabase    │
                       │ Postgres +    │
                       │ pgvector      │
                       └───────────────┘
```

- **`app/api/*`** — REST endpoints for bots, chat, documents, workflows, and workflow runs.
- **`lib/workflow/*`** — graph validation, execution engine, and xyflow canvas <-> definition conversion for the Workflows feature.
- **`lib/chat/run.ts`** — the core agentic loop: tool calling, nested bot-as-tool recursion, streaming.
- **`lib/embeddings/*`** — chunking, ingestion, and vector search for RAG.
- **`lib/events/bus.ts`** + **`lib/stores/observability-store.ts`** — SSE-backed live event bus feeding the dashboard.

## Getting started

### Prerequisites

- Node.js 24 (see `.nvmrc`)
- [Docker](https://docs.docker.com/get-docker/) (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Ollama](https://ollama.com), with these models pulled:
  ```bash
  ollama pull nomic-embed-text
  ollama pull <a tool-calling-capable chat model, e.g. qwen2.5 or llama3.1>
  ```

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Start local Supabase (Postgres + pgvector, migrations auto-applied)
npx supabase start

# 3. Copy the generated credentials into .env.local
#    (npx supabase start prints these — url, anon key, service_role key)
cp .env.example .env.local   # then fill in the values below

# 4. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Local Supabase API URL (from `supabase start`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service role key (from `supabase start`) — never exposed to the browser |
| `OLLAMA_BASE_URL` | Defaults to `http://localhost:11434` |
| `MAX_CONCURRENT_OLLAMA_REQUESTS` | Optional — caps concurrent inference calls to your local Ollama instance |

> This is a local, single-user learning app — there's no auth layer, and the service role key is used directly from API routes. Don't deploy it as-is to a multi-tenant or public environment.

## Project structure

```
app/                  Next.js App Router pages + API routes
components/           UI components (bots, chat, dashboard, playground, workflows)
lib/
  chat/               Agentic run loop (tool calling, streaming, recursion)
  embeddings/         Chunking, ingestion, vector search
  events/             SSE event bus
  ollama/             Provider config, request queue, retry logic
  stores/             Zustand observability store
  tools/              Built-in tools (calculator, weather, search_docs)
  workflow/           Graph validation, execution engine, canvas conversion
supabase/
  migrations/         SQL migrations (bots, requests, workflows, embeddings)
```

## Roadmap

- [ ] Bounded loop nodes on the workflow canvas (iterate until a condition or max-count)
- [ ] Streaming token output surfaced live per workflow node, not just on completion
- [ ] Multi-provider support alongside Ollama

## License

MIT
