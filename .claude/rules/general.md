# General Project Rules

## New Project Detection (MANDATORY)
Before starting ANY work, check if the project has been initialized:
1. Read `docs/PRD.md` - if it still contains placeholder text like "_Describe what you are building_", the project is NOT initialized
2. Read `features/INDEX.md` - if the features table is empty, no features have been defined

**If the project is not initialized:**
- Do NOT write any code or create any components
- Do NOT skip ahead to implementation
- Instead, tell the user: "This project hasn't been set up yet. Let's start by defining what you want to build. Run `/init` with a description of your idea (e.g. `/init I want to build a task management app`)."
- If the user already described their idea in the current message, run `/init` automatically with their description

**If the project is initialized but the user requests a feature not yet in INDEX.md:**
- Guide them to run `/write-spec` first to create the feature spec before any implementation

## Feature Tracking

### Domains (5)

Jedes Feature gehört zu genau einer dieser 5 Domains:

| Domain | Beschreibung |
|--------|-------------|
| **Platform** | Auth, Workspace, Infrastruktur, LLM-Konfiguration, Observability, Security |
| **Interview Engine** | Interview-Führung: Agent-Backend, UI, Voice, Design, Eval |
| **Wissensbank** | Extraktion, Strukturierung und Speicherung von Prozesswissen |
| **Use Case Engine** | Ableitung, Priorisierung und ROI-Berechnung von Use Cases |
| **Dashboard & Output** | Admin-Übersicht, Reports, Exports |

Grenze Wissensbank / Use Case Engine: Wissensbank speichert *was ist* (Prozesse, Schritte, Tools). Use Case Engine leitet *was tun wir damit* ab (KI-Use-Cases, ROI).

### Feature-Typen (4)

| Typ | Definition |
|-----|-----------|
| **Epic** | Foundational, eigene DB-Tabellen + Service, andere bauen darauf auf |
| **Feature** | Neue nutzersichtbare Fähigkeit innerhalb einer Domain |
| **Extension** | Ergänzt ein bestehendes Feature ohne dessen Verhalten zu ersetzen |
| **Revision** | Überarbeitet/ersetzt Verhalten eines bestehenden Features |

`Extends` ist immer genau ein PROJ-X. Cross-Cutting-Features (Observability, Rate Limiting, Security) bekommen Type=Feature und Extends=—.

### Status-Modell

Lifecycle (linear): `Roadmap → Planned → Architected → In Progress → In Review → Approved → Deployed`

**Blocked** ist ein orthogonaler Zustand, erreichbar von Planned/Architected/In Progress. Bedeutet: Arbeit pausiert wegen externem Faktor. Spec dokumentiert was blockt und wann erneut prüfen. Resolution geht zurück zum vorherigen Status oder weiter zu Deployed.

| Status | Erreicht durch |
|--------|---------------|
| Roadmap | /init |
| Planned | /write-spec |
| Architected | /architecture |
| In Progress | /frontend oder /backend startet |
| In Review | /qa startet |
| Approved | /qa passt (keine Critical/High Bugs) |
| Deployed | /deploy |

### INDEX.md-Format (10 Spalten)

```
| ID | Feature | Type | Domain | Extends | Status | Spec | Priority | Appetite | Bugs |
```

| Feld | Definition |
|------|-----------|
| `Type` | Epic / Feature / Extension / Revision |
| `Domain` | eine der 5 Domains |
| `Extends` | PROJ-X bei Extension/Revision, sonst `—` |
| `Appetite` | S (1-2d) / M (3-5d) / L (1-2w) / XL (>2w), Schätzung vor Implementierung |
| `Bugs` | H:M:L nach QA (z.B. `0:2:1`), vor QA `—` |

### Bookkeeping-Regeln

| Feld | Erstmals gesetzt durch | Zuständige Skill |
|------|----------------------|------------------|
| ID | INDEX.md "Next Available ID" | jede schreibende Skill |
| Feature | /write-spec | write-spec |
| Type | /write-spec | write-spec |
| Domain | /write-spec | write-spec |
| Extends | /write-spec | write-spec |
| Status | jeder Lifecycle-Event | jeweilige Skill |
| Spec | Filename-Konvention | write-spec |
| Priority | /init oder /write-spec | init / write-spec |
| Appetite | /write-spec | write-spec |
| Bugs | /qa (am Ende, H:M:L) | qa |

### Hard Rules

1. `Appetite` muss spätestens beim Übergang zu Status=Architected gefüllt sein.
2. `Bugs` muss spätestens beim Übergang zu Status=Approved gefüllt sein.
3. `Type`, `Domain`, `Extends` müssen ab Status=Planned gefüllt sein.
4. Eine Skill, die einen Status-Übergang vollzieht, muss vorher prüfen, ob alle Hard Rules erfüllt sind. Wenn nicht: abbrechen und User informieren.
5. Eine Skill, die ein Feld setzt, muss das Write-Then-Verify-Muster befolgen (Read → Edit → Re-read).

Ein `—` ist nur erlaubt, solange das Lifecycle-Event noch nicht erreicht wurde.

### Basis-Tracking-Regeln
- All features are tracked in `features/INDEX.md` - read it before starting any work
- Feature specs live in `features/<domain>/PROJ-X-feature-name.md` (domain subfolder matches the feature's Domain field: `platform/`, `interview-engine/`, `wissensbank/`, `use-case-engine/`, `dashboard-output/`)
- Feature IDs are sequential: check INDEX.md for the next available number
- One feature per spec file (Single Responsibility)
- Never combine multiple independent functionalities in one spec

## Git Conventions
- Commit format: `type(PROJ-X): description`
- Types: feat, fix, refactor, test, docs, deploy, chore
- Check existing features before creating new ones: `ls features/ | grep PROJ-`
- Check existing components before building: `git ls-files src/components/`
- Check existing APIs before building: `git ls-files src/app/api/`

## Human-in-the-Loop
- Always ask for user approval before finalizing deliverables
- Present options using clear choices rather than open-ended questions
- Never proceed to the next workflow phase without user confirmation

## Status Updates (MANDATORY - Write-Then-Verify)
After completing work on any feature, you MUST update tracking files. Follow this exact sequence:

1. **Read** the feature spec (path from `features/INDEX.md`, e.g. `features/<domain>/PROJ-X-*.md`) and `features/INDEX.md` BEFORE editing
2. **Write** your changes using the Edit tool — do NOT just describe what you would write
3. **Re-read** the file AFTER editing to verify the changes are actually present
4. **If changes are missing**, repeat step 2 — never claim updates were made without verifying

**What to update in the feature spec:**
- Status field in the header (Planned → In Progress → In Review → Deployed)
- Implementation notes: what was built, what changed, any deviations from the original spec
- Bug fixes or design changes discovered during implementation

**What to update in `features/INDEX.md`:**
- Feature status column must match the feature spec header
- Valid statuses: Roadmap → Planned → Architected → In Progress → In Review → Approved → Deployed
  - **Roadmap**: after `/init` — feature identified, no spec file yet
  - **Planned**: after `/write-spec`
  - **Architected**: after `/architecture`
  - **In Progress**: after `/frontend` or `/backend` starts
  - **In Review**: after `/qa` starts
  - **Approved**: after `/qa` passes (no critical/high bugs)
  - **Deployed**: after `/deploy`

**NEVER do this:**
- Do NOT say "I've updated the feature spec" without actually calling the Edit tool
- Do NOT summarize changes in chat as a substitute for writing them to the file
- Do NOT skip updates because "it's obvious" or "minor"

## File Handling
- ALWAYS read a file before modifying it - never assume contents from memory
- After context compaction, re-read files before continuing work
- When unsure about current project state, read `features/INDEX.md` first
- Run `git diff` to verify what has already been changed in this session
- Never guess at import paths, component names, or API routes - verify by reading

## Handoffs Between Skills
- After completing a skill, suggest the next skill to the user
- Format: "Next step: Run `/skillname` to [action]"
- Handoffs are always user-initiated, never automatic

## Approval Gates

Die folgenden Operationen erfordern zwingend User-Approval **vor** der Ausführung:

| Operation | Begründung |
|-----------|-----------|
| Supabase Schema-Änderung (`apply_migration`, direkte SQL-Writes über Service Role) | Unumkehrbar oder nur mit Datenmigration rollbackbar |
| Production-Deploy (Vercel `--prod`, Domain-Promote) | Unmittelbar nutzersichtbar, Rollback mit Latenz |
| Löschen oder Umbenennen von Dateien in `features/`, `docs/`, `.claude/`, `src/` | Risiko von Datenverlust und Workflow-Bruch |
| `git push --force`, Branch-Delete, `git reset --hard` mit lokalen Änderungen | Datenverlust |
| API-Key-Rotation, Änderung von Environment-Variablen in Produktion (`vercel env`) | Auswirkung auf Live-System |
| Dependency-Major-Upgrade in `package.json` | Breaking-Change-Risiko |
| Skip von Pre-Commit-Hooks (`--no-verify`) | Umgeht Qualitäts-Gates |

**Hard Rule:** Eine Skill, die eine dieser Operationen ausführen will, muss vorher per Tool (`AskUserQuestion` oder explizite Bestätigungsabfrage) eine Freigabe einholen. Eine einmalige Freigabe gilt nur für den aktuellen Aufruf, nicht für nachfolgende gleichartige Aufrufe.
