# AI Coding Starter Kit

> A Next.js template with an AI-powered development workflow using specialized skills for Requirements, Architecture, Frontend, Backend, QA, and Deployment.

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript
- **Styling:** Tailwind CSS + shadcn/ui (copy-paste components)
- **Backend:** Supabase (PostgreSQL + Auth + Storage) - optional
- **Deployment:** Vercel
- **Validation:** Zod + react-hook-form
- **State:** React useState / Context API
- **AI SDK:** Vercel AI SDK v6 (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/google`)
- **Rate Limiting:** Upstash Redis + `@upstash/ratelimit`
- **PDF:** `@react-pdf/renderer`

## Project Structure

```
src/
  app/              Pages (Next.js App Router)
  components/
    ui/             shadcn/ui components (NEVER recreate these)
  hooks/            Custom React hooks
  lib/              Utilities (supabase.ts, utils.ts)
features/           Feature specifications (grouped by domain)
  INDEX.md          Feature status overview
  platform/         Platform features (auth, infra, security, observability)
  interview-engine/ Interview Engine features (agent, UI, voice, eval)
  wissensbank/      Knowledge base features (extraction, enrichment, embeddings)
  use-case-engine/  Use Case Engine features
  dashboard-output/ Dashboard & reporting features
docs/
  PRD.md            Product Requirements Document
  production/       Production guides (Sentry, security, performance)
  architecture/     C4-basierte Architektur-Doku (Ist-Stand, Component-Wörterbuch; work in progress)
CONTEXT.md          Fach-Vokabular/Ubiquitous Language (siehe /domain-modeling Skill)
```

## Development Workflow

1. `/init` - Initialize the project: PRD + feature map (run once at the start)
2. `/write-spec` - Create a full feature spec for one feature
3. `/architecture` - Design tech architecture (PM-friendly, no code)
4. `/frontend` - Build UI components (shadcn/ui first!)
5. `/backend` - Build APIs, database, RLS policies
6. `/qa` - Test against acceptance criteria + security audit
7. `/deploy` - Deploy to Vercel + production-ready checks

Use `/refine PROJ-X` at any point to revisit and improve an existing feature spec.

## Feature Tracking

All features tracked in `features/INDEX.md`. Every skill reads it at start and updates it when done. Feature specs live in `features/<domain>/PROJ-X-name.md` (domain subfolder matches the feature's Domain field).

## Key Conventions

- **Feature IDs:** PROJ-1, PROJ-2, etc. (sequential)
- **Commits:** `feat(PROJ-X): description`, `fix(PROJ-X): description`
- **Single Responsibility:** One feature per spec file
- **shadcn/ui first:** NEVER create custom versions of installed shadcn components
- **Human-in-the-loop:** All workflows have user approval checkpoints
- **Tests:** Unit tests co-located next to source files (`useHook.test.ts` next to `useHook.ts`). E2E tests in `tests/`.

## Build & Test Commands

```bash
npm run dev          # Development server (localhost:3000)
npm run build        # Production build
npm run lint         # TypeScript type check (tsc --noEmit)
npm run start        # Production server
npm test             # Vitest unit/integration tests
npm run test:e2e     # Playwright E2E tests
npm run test:all     # Both test suites

# Eval runner (PROJ-13) — requires EVAL_WORKSPACE_ID in .env.local
LANGFUSE_ENABLED=true INTERVIEW_MODEL=google/gemini-3.5-flash npm run eval:interview buchhalter
```

## LLM Observability (PROJ-13)

Tracing via Langfuse. Kill-switch: `LANGFUSE_ENABLED=false` (default) — set to `true` only for eval runs or intentional prod tracing.

### Langfuse MCP — Claude Code queries

Zwei MCP Server, beide global in `~/.claude.json` registriert (kein Eintrag in `settings.local.json` nötig):

| Server | Transport | Zweck | Tool-Präfix |
|--------|-----------|-------|-------------|
| `langfuse` | HTTP (offiziell) | Prompt Management | `mcp__langfuse__*` |
| `langfuse-data` | stdio (Community `langfuse-mcp`) | Traces, Sessions, Eval, Metrics | `mcp__langfuse_data__*` |

**Für Eval-Abfragen immer `langfuse-data` nutzen** — nur dieser Server hat `listTraces`, `getTrace`, `listSessions`, `listDatasetRuns`, `getDailyMetrics` etc.

Einrichtung (einmalig, `--scope user`):
```bash
# 1. Offizieller HTTP-Server (Prompt Management)
TOKEN=$(echo -n "pk-lf-...:sk-lf-..." | base64 -w 0)
claude mcp add --transport http --header "Authorization: Basic $TOKEN" --scope user langfuse https://cloud.langfuse.com/api/public/mcp

# 2. Community stdio-Server (Trace-Abfragen) — Env-Vars danach manuell in ~/.claude.json eintragen
claude mcp add --scope user langfuse-data npx -- -y langfuse-mcp
# env: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

Example queries (nutzen `langfuse-data`):
- "Show me the last eval run for persona buchhalter with model gemini-3.5-flash"
- "Compare tool-call sequences between two eval runs by eval_run_id"
- "What was the total token cost for interview session <interview_id>?"

### Tag conventions

| Tag | Values | Source |
|-----|--------|--------|
| `model` | `google/gemini-3.1-flash-lite`, `google/gemini-3.5-flash`, `anthropic/claude-...` | set per LLM call |
| `environment` | `prod`, `eval` | set by runner / default prod |
| `persona` | `buchhalter`, `vertriebler`, `it-support` | set by eval runner |
| `eval_run_id` | UUID | set by eval runner |

Session grouping: `langfuse.session_id = interview_id` — all spans of one interview are one session.

## Product Context

@docs/PRD.md

## Feature Overview

@features/INDEX.md
