# ADR-001: Fork-Audit für AlexPEClub/ai-coding-starter-kit

**Status:** Accepted (2026-05-19)
**Author:** Lias Hemmersbach
**Repository:** Roly-Bach/meridian-app

## Context

Das Meridian-MVP wird auf Basis eines Hybrid-Setups gebaut: `AlexPEClub/ai-coding-starter-kit` (MIT-Lizenz, 287 Stars, Prototyp-Phase mit 24 Commits) wird als Stack-Boilerplate übernommen, darüber wird eine eigene 6-Agent-Pipeline mit Multi-Vendor-Routing, Loop-Mechanik und EU-Datenschutz-Konfiguration gelegt.

Dieser ADR dokumentiert explizit, was vom Starter-Kit übernommen, ergänzt, umgebaut oder weggelassen wird. Ziel: Keine versteckten Annahmen, klare Trennlinien für künftige Entscheidungen.

## Decision

### 1:1 Übernommen (keine Änderungen)

**Stack:**
- Next.js 16 (App Router)
- TypeScript strict
- Tailwind CSS 4 + shadcn/ui (35+ Komponenten)
- Vitest (Unit/Integration)
- Playwright (E2E)
- Zod (Validierung)

**Konfigurationsdateien:**
- `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `playwright.config.ts`, `vitest.config.ts`, `postcss.config.mjs`
- `components.json` (shadcn/ui)
- `.eslintrc.json`

**Rules (`.claude/rules/`):**
- `general.md` — "Always read, never guess"-Prinzip
- `frontend.md`, `backend.md`, `security.md` — Domain-Standards

**Produktions-Dokumentation (`docs/production/`):**
- `database-optimization.md`, `error-tracking.md`, `performance.md`, `rate-limiting.md`, `security-headers.md`

**Feature-Tracking:**
- `features/INDEX.md` als Single-Source-of-Truth für Feature-Status
- `docs/PRD.md` als Product Requirements Template

### Beibehalten und integriert (bestehende Skills als Substeps)

**Starter-Kit-Skills bleiben aktiv, werden aber von neuen Orchestrierungs-Commands aufgerufen:**

| Bestehende Skill | Rolle in unserer Pipeline |
|---|---|
| `/init` | Einmaliges Projekt-Setup (PRD, Feature-Map) |
| `/write-spec` | Spec-Erstellung vor Architect-Phase |
| `/refine` | Spec-Iteration |
| `/architecture` | Substep im Architect-Agent |
| `/frontend` | Substep im Coder-Agent (UI-Tasks) |
| `/backend` | Substep im Coder-Agent (API/DB-Tasks) |
| `/qa` | Substep im Verifier-Agent |
| `/deploy` | Verifier-Last-Step vor Production |
| `/help` | Generelle Hilfe, unverändert |

**Bestehende Subagents (`.claude/agents/`):**
- `backend-dev.md`, `frontend-dev.md`, `qa-engineer.md` bleiben als Domain-Spezialisten erhalten

### Ergänzt (neue Layer auf den Fork)

**Neue Subagents (`.claude/agents/`):**
- `architect.md` (Opus, Orchestration)
- `scout.md` (Haiku, Research)
- `coder.md` (Sonnet, Implementation) — delegiert an `frontend-dev`/`backend-dev`
- `reviewer.md` (Sonnet-Orchestrierung + Gemini 2.5 Pro via Aider) — Multi-Vendor
- `verifier.md` (Sonnet) — nutzt bestehenden `/qa`-Skill
- `janitor.md` (Sonnet + Gemini 2.5 Flash via Aider) — Maintenance

**Neue Slash-Commands (`.claude/commands/`):**
- `/build` — volle Pipeline mit Loop-Mechanik
- `/quick` — schlanke Pipeline (Coder → Reviewer)
- `/cleanup` — Janitor-Trigger
- `/adr` — ADR-Skeleton-Generator
- `/research` — Scout mit Web-Fokus

**Loop-Mechanik (im `/build`-Command):**
- Inner Loop (Reviewer → Coder): max 3 Iterationen
- Build Loop (Verifier → Coder): max 2 Iterationen
- Outer Loop (→ Architect): max 1 Eskalation
- Verdict-Schema: `pass | retry | escalate`

**ADR-Verzeichnis (`docs/adr/`):**
- Squid-Pattern: nummeriert, datiert, immutable, Supersession statt Edit
- Dieser ADR ist erster Eintrag

**Multi-Vendor-Layer:**
- Aider als CLI-Sidekick (`pipx install aider-chat`)
- Gemini 2.5 Pro für Reviewer (Cross-Vendor-Review)
- Gemini 2.5 Flash für Janitor (große Lese-Volumen)
- Konfiguration in `.env.local` (Google AI Studio Free-Tier reicht initial)

### Umgebaut

**`.claude/settings.json`:**
- Permissions erweitert für `pnpm run *`, `git push`, `gh pr create`, `aider`
- Hooks: PostToolUse Prettier-on-Save, PreToolUse git-push-Warnung
- `additionalDirectories` global erweitert um Repo-Pfad

**Backend-Stack:**
- Supabase wechselt zu **EU-Region** (`eu-central-1`, Frankfurt) statt Default
- Vercel-Region auf `fra1` (Frankfurt) in `vercel.json`
- AVVs (Auftragsverarbeitungsverträge) mit beiden Anbietern vor Pilot-Start
- Grund: DSGVO-Anforderung aus Masterarbeit-Interview-Studie (2-4 Unternehmen, personenbezogene Daten)

### Bewusst NICHT übernommen

**Keine Vendor-Lock-in-spezifischen Patterns:**
- Vercel-spezifische APIs (Edge Config, KV) werden vermieden
- Drizzle ORM statt Vercel-Postgres-Client (portierbar)

**Keine Upstream-Pflege:**
- Repo wurde via `git clone` + neuem Remote erstellt, nicht via `gh repo fork`
- Kein "forked from"-Tag in GitHub-UI
- Original-Repo (24 Commits, Prototyp-Phase) wird nicht für Updates gezogen
- Nach diesem Commit als eigener Code behandelt

## Consequences

**Positiv:**
- Stack-Setup ist Tag-1 produktionsreif (statt ~2h Greenfield-Aufwand)
- Klare Trennlinie zwischen "geerbt" und "selbst gebaut" durch diese ADR
- Multi-Vendor und EU-Datenschutz sind explizit, nicht implizit

**Negativ:**
- Doppelte Agent-Population (3 bestehende + 6 neue) erfordert Routing-Disziplin
- Bei Refactoring der bestehenden Skills muss diese ADR aktualisiert oder superseded werden
- Original-Repo-Updates müssen manuell evaluiert werden (kein automatisches Upstream-Tracking)

**Folgeentscheidungen (zukünftige ADRs):**
- ADR-002: Backend-Stack-Wahl mit EU-Region-Konfiguration (Session 4)
- ADR-003: Branch-Protection und Co-Founder-Workflow (nach Bendewar-Onboarding)
- ADR-004: Wann werden bestehende `frontend-dev`/`backend-dev`-Agents durch eigenen Coder-Agent ersetzt
