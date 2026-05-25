# Meridian

Meridian erhebt implizites Prozesswissen von Mitarbeitern durch KI-geführte Interviews, speichert es strukturiert mit Vektorsemantik in Supabase und leitet daraus priorisierte KI-Use-Cases mit ROI-Berechnung ab.

**Deployment:** [meridian-app-tau.vercel.app](https://meridian-app-tau.vercel.app)

---

## Schnellstart

```bash
git clone https://github.com/Roly-Bach/meridian-app.git
cd meridian-app
npm install
cp .env.local.example .env.local   # Werte eintragen
npm run dev
```

Alle erforderlichen Umgebungsvariablen sind in [.env.local.example](.env.local.example) dokumentiert.

---

## Technologiestack

| Kategorie | Tool |
|-----------|------|
| Framework | Next.js 16 (App Router), TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + pgvector + Auth) |
| AI-Stack | Vercel AI SDK v6, provider-agnostisch via `INTERVIEW_MODEL` (Anthropic / Google) |
| Embeddings | Jina Embeddings v3 (1024 dim), konfigurierbar per `EMBEDDING_MODEL` |
| Voice | ElevenLabs Scribe v2 Realtime (STT), optional |
| Rate Limiting | Upstash Redis |
| PDF | @react-pdf/renderer |
| Unit-Tests | Vitest |
| E2E-Tests | Playwright |

---

## Projektstruktur

```
meridian-app/
├── src/
│   ├── app/                    # Seiten und API-Routen (Next.js App Router)
│   │   ├── api/                # Backend-Endpoints
│   │   │   ├── interview/      # Interview-Engine-Routes (token-basiert, kein Auth)
│   │   │   ├── interviews/     # Interview-Verwaltung (Auth-geschützt)
│   │   │   ├── process-steps/  # Prozessschritt-API
│   │   │   └── use-cases/      # Use-Case-API
│   │   ├── dashboard/          # Admin-Oberfläche (Auth-geschützt)
│   │   └── interview/[token]/  # Mitarbeiter-Oberfläche (Token-only)
│   ├── components/             # React-Komponenten
│   │   └── ui/                 # shadcn/ui (nie neu implementieren)
│   ├── services/               # Business-Logik und KI-Calls
│   │   └── __evals__/          # Eval-Harness (Personas, Runner, Metriken)
│   ├── hooks/                  # Custom React Hooks
│   └── lib/                    # Utilities (supabase, ratelimit, llm-provider)
├── features/                   # Feature-Spezifikationen und Tracking
│   ├── platform/               # Auth, Infra, Security, Observability
│   ├── interview-engine/       # Agent-Backend, UI, Voice, Design, Eval
│   ├── wissensbank/            # Extraktion, Anreicherung, Embeddings
│   ├── use-case-engine/        # Use-Case-Ableitung, ROI
│   ├── dashboard-output/       # Reports, Exports
│   └── INDEX.md                # Zentrale Statusübersicht
├── docs/
│   ├── PRD.md                  # Product Requirements Document
│   ├── agent-procedures.md     # Interview-Methodik (Fragekatalog, Phasenmodell)
│   ├── design-system.md        # Farbpalette, Typografie
│   ├── adr/                    # Architecture Decision Records
│   └── evals/                  # Eval-Transcripts und Metriken
├── supabase/
│   └── migrations/             # SQL-Migrationsdateien
├── tests/                      # Playwright E2E-Tests
└── .claude/                    # Claude-Code-Workflow-Infrastruktur
    ├── rules/                  # Coding-Standards (auto-applied nach Dateipfad)
    ├── skills/                 # Domain-Rollen: führen Arbeit direkt aus (/write-spec, /backend, /eval-interview ...)
    ├── agents/                 # Sub-Agent-Konfigurationen (Architect, Coder, Reviewer, Verifier ...)
    └── commands/               # Pipeline-Orchestratoren: delegieren an Sub-Agents (/build, /quick, /cleanup ...)
```

Die Domain-Ordnerstruktur unter `features/` (fünf Unterordner statt flache Liste) ist in [ADR-004](docs/adr/ADR-004-feature-tracking-v2.md) begründet. Jede Feature-Spec liegt im Ordner der zugehörigen Domain.

---

## Feature-Tracking-System

Alle Features werden in [features/INDEX.md](features/INDEX.md) verfolgt. Das System basiert auf [ADR-004](docs/adr/ADR-004-feature-tracking-v2.md).

### Domains

| Domain | Inhalt |
|--------|--------|
| Platform | Auth, Workspace, Infrastruktur, LLM-Konfiguration, Observability, Security |
| Interview Engine | Interview-Führung: Agent-Backend, UI, Voice, Design, Eval |
| Wissensbank | Extraktion, Strukturierung und Speicherung von Prozesswissen |
| Use Case Engine | Ableitung, Priorisierung und ROI-Berechnung von Use Cases |
| Dashboard & Output | Admin-Übersicht, Reports, Exports |

### Feature-Typen

| Typ | Definition |
|-----|-----------|
| Epic | Foundational, eigene DB-Tabellen und Service, andere bauen darauf auf |
| Feature | Neue nutzersichtbare Fähigkeit innerhalb einer Domain |
| Extension | Ergänzt ein bestehendes Feature ohne dessen Verhalten zu ersetzen (`Extends: PROJ-X`) |
| Revision | Überarbeitet oder ersetzt Verhalten eines bestehenden Features |

### Status-Lifecycle

```
Roadmap → Planned → Architected → In Progress → In Review → Approved → Deployed
```

`Blocked` ist ein orthogonaler Zustand — erreichbar von Planned, Architected oder In Progress. Bedeutet: Arbeit pausiert wegen externem Faktor. Die Spec dokumentiert was blockt und wann erneut zu prüfen ist.

### INDEX.md-Format

```
| ID | Feature | Type | Domain | Extends | Status | Spec | Priority | Appetite | Bugs |
```

| Feld | Definition |
|------|-----------|
| `Appetite` | Geschätzter Aufwand: S (1-2d) / M (3-5d) / L (1-2w) / XL (>2w) |
| `Bugs` | Bug-Tally nach QA: H:M:L (z.B. `0:2:1`) |
| `Extends` | PROJ-X bei Extension/Revision, sonst `—` |

### Entwicklungs-Workflow

```
/init          → PRD + Feature Map (einmalig)
/write-spec    → Feature Spec (Type, Domain, Appetite festlegen)
/refine        → Bestehende Spec überarbeiten
/architecture  → Technisches Design
/frontend      → UI-Komponenten
/backend       → API + DB
/qa            → Tests + Security Audit (Bug-Tally H:M:L)
/deploy        → Vercel Deploy + Post-Mortem
/retro         → Lernmechanismus (alle ≥3 Deploys)
```

Jede Skill liest `features/INDEX.md` zu Beginn und aktualisiert Status und Felder nach Abschluss. Handoffs sind immer nutzerinitiiert.

---

## Interview Engine

### Zweck

Meridian führt strukturierte Interviews mit Mitarbeitern, um implizites Prozesswissen zu erheben. Der KI-Agent identifiziert Prozessschritte und erfasst deren Attribute gezielt — das Ergebnis fließt in eine nachgelagerte Pipeline: Extraktion, Prozessanreicherung und Use-Case-Generierung mit ROI-Berechnung.

Mitarbeiter brauchen keinen Account. Der Admin legt das Interview an und schickt dem Mitarbeiter einen Token-Link mit 30 Tagen Laufzeit.

### Interview-Methodik

Der Agent folgt einem methodisch fundierten Ansatz. Die vollständige Dokumentation liegt in [docs/agent-procedures.md](docs/agent-procedures.md).

- **Critical Incident Technique (CIT):** Mitarbeiter schildern einen konkreten Vorfall statt abstrakt zu beschreiben — "Was ist beim letzten Mal passiert?" statt "Was machen Sie normalerweise?"
- **Cognitive Task Analysis (CTA) — Walkthrough:** Schritt für Schritt durch einen typischen Prozessdurchlauf, mit Nachfragen an Entscheidungspunkten
- **Contextual Inquiry:** Nachfragen in der Sprache des Mitarbeiters, nicht in Fachterminologie
- **TODS Slot-Filling:** Strukturierte Erfassung definierter Attribute pro Prozessschritt

### Slot-Inventar

Pro identifiziertem Prozessschritt erhebt der Agent sechs Attribute. Die drei Pflicht-Slots sind direkte Inputs für die Use-Case-Heuristiken der Use Case Engine:

| Slot | Typ | Pflicht | Frage |
|------|-----|---------|-------|
| `frequency_per_month` | int | ja | "Wie oft kommt das vor?" |
| `duration_minutes` | int | ja | "Wie lange dauert ein Durchlauf?" |
| `rule_based` | bool | ja | "Läuft das immer gleich oder hängt es vom Fall ab?" |
| `data_sources` | string[] | nein | "Mit welchen Systemen arbeiten Sie dabei?" |
| `error_rate_percent` | int | nein | "Wie oft geht etwas schief oder muss nachgearbeitet werden?" |
| `media_breaks` | int | nein | "Wie oft wechseln Sie manuell zwischen Systemen?" |

Pflicht-Slots werden immer mit einem wörtlichen Zitat aus der Antwort des Mitarbeiters belegt (`evidence_quote`). Ohne diesen Beleg weist der Agent den Slot-Eintrag intern ab — der Grounding-Guard sitzt auf Tool-Ebene, nicht im Prompt.

### Phasen-Architektur

Das Interview läuft in vier Phasen ab:

```
intro
  ↓
process_loop  (wiederholt für jeden identifizierten Prozessschritt)
  ├─ explore_step     Narrativ, CIT/CTA-Walkthrough — Schritt identifizieren
  ├─ quantify_step    Gezieltes Slot-Filling (max. 2 Slots pro Turn)
  └─ bottleneck_probe Pain Point erfassen und am Schritt verorten
  ↓
coverage_check        Agent prüft globale Coverage; holt fehlende Pflicht-Slots nach
  ↓
wrap_up               Zusammenfassung mit identifizierten Schritten und Bottlenecks
```

Übergang zu `coverage_check`: erst wenn alle bekannten Schritte den Quantifizierungs-Loop durchlaufen haben. Direkt nach `wrap_up` wird das Interview als `completed` markiert und die Extraktionspipeline angestoßen.

### Output-Kontrakt

MVP-Ziel pro Interview-Run:

| Metrik | Schwelle |
|--------|----------|
| Identifizierte Prozessschritte | ≥ 3 |
| Pflicht-Slot-Coverage pro Schritt | ≥ 80 % |
| Optionale-Slot-Coverage pro Schritt | ≥ 50 % |
| Bottlenecks am Prozessschritt verortet | ≥ 1 |

### Nachgelagerte Pipeline

```
Interview completed
  → PROJ-4: Extraktion       LLM extrahiert strukturierte Wissensobjekte + Embeddings
  → PROJ-5: Anreicherung     Attribute validiert und mit Kontext angereichert
  → PROJ-6: Use Cases        8 Heuristik-Regeln, ROI-Berechnung (frequency × duration × rate × reduction)
```

---

## Evaluation

### Was ist der Eval-Harness?

Kein automatischer CI-Test. Der `/eval-interview`-Skill führt eine vollständige Interview-Session durch — Claude Code übernimmt dabei die Mitarbeiter-Persona und antwortet auf Agent-Turns auf Basis strukturierter Persona-Daten. Fakten werden ausschließlich aus dem `processKnowledge`-Schema der Persona bezogen, nie spekulativ ergänzt.

Dieser Ansatz löst den früheren Keyword-Selektor-Mechanismus ab (dokumentiert in [PROJ-17](features/interview-engine/PROJ-17-adaptive-eval-harness-start-endpoint.md)): Claude Code interpretiert Agent-Fragen kontextuell und gibt keine repetitiven Slot-keyed Antworten zurück.

### Ablauf

1. Persona-Datei lesen (`buchhalter`, `vertriebler` oder `it-support`)
2. Interview-Record in Supabase anlegen (via Supabase MCP)
3. `/api/interview/[token]/start` aufrufen — Agent-Opener streamen
4. Claude Code generiert Persona-Antwort aus `processKnowledge`
5. `/api/interview/[token]/chat` aufrufen — nächste Agent-Antwort
6. Loop bis `register_step`-Tool-Call (Success), stilles Tool-only-Turn (Error) oder Interview-Abschluss (max. 20 Turns)
7. Transcript als Markdown in `docs/evals/interview/YYYY-MM-DD-<persona>.md`
8. Interview-Record bleibt in DB für manuelle Verifikation und Downstream-Tests

### Voraussetzungen

- Dev-Server läuft: `npm run dev`
- Supabase MCP verbunden
- Aufruf: `/eval-interview buchhalter` (oder `vertriebler` / `it-support`)

### Was Evals messen

| Messen | Nicht messen |
|--------|-------------|
| Korrekte Tool-Calls bei realistischer Persona | Verhalten unter Last |
| Korrekte Phasenwechsel | Echte Mitarbeiterantworten |
| Coverage-Check-Logik | Latenz |
| Ob Output-Kontrakt (Pflicht-Slot-Coverage ≥ 80 %) erreicht wird | CI/CD-Kompatibilität (LLM-Kosten) |

### Personas

Drei strukturierte Personas in [src/services/__evals__/interview/personas/](src/services/__evals__/interview/personas/):

| Persona | Rolle | Stil |
|---------|-------|------|
| `buchhalter` | Finanzbuchhaltung | detailliert, zahlenorientiert |
| `vertriebler` | Vertriebsinnendienst | erzählend, springt zwischen Themen |
| `it-support` | IT-Support | wortkarg, technisch präzise |

Jede Persona enthält `identity` (Name, Rolle, Abteilung), `style` (Verbosity, Ton, Tendenz) und `processKnowledge` (Prozesse, Schritte, verwendete Systeme, Kontext).

---

## Tests

```bash
npm test          # Vitest — Unit- und Integrationstests (co-located *.test.ts)
npm run test:e2e  # Playwright — E2E-Tests (tests/)
npm run test:all  # Beide Suiten
```

---

## Build-Befehle

```bash
npm run dev       # Dev-Server auf localhost:3000
npm run build     # Produktions-Build
npm run lint      # TypeScript-Check (tsc --noEmit)
npm run start     # Produktions-Server
```
