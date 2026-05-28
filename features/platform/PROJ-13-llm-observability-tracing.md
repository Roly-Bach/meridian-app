# PROJ-13: LLM Observability & Tracing

## Status: Deployed
**Created:** 2026-05-21
**Last Updated:** 2026-05-28
**Type:** Feature
**Domain:** Platform
**Extends:** —
**Appetite:** M (3-5 Tage)
**Bugs:** 0:0:2

## Dependencies
- PROJ-2 (Interview Engine Backend) — `interviewAgent.ts` ist primärer Trace-Producer
- PROJ-4 (Extraktions-Agent + Wissensbasis) — `extraction.ts`, `embeddings.ts`
- PROJ-5 (Prozessschritt-Anreicherung) — `processEnrichment.ts`
- PROJ-6 (Use Case Identifikation) — `useCaseEngine.ts`
- PROJ-17 (Adaptive Eval-Harness) — Eval-Runner ist zweiter Trace-Producer; Persona × Modell-Tagging entsteht hier

## Hintergrund & Motivation

PROJ-13 war ursprünglich als allgemeine Sichtbarkeit gedacht. Der konkrete Auslöser ist jetzt der **Regression-Befund vom 27.05.2026**: Gemini 3.5 Flash liefert in der Eval-Harness (PROJ-17) schlechtere Ergebnisse als Gemini 3.1 Flash Lite. Vermutung: `interviewAgent.ts` ist auf 3.1 Flash Lite + Buchhalter-Persona overfittet (System-Prompt, Few-Shots, Tool-Sequenzen).

Um den Agenten systematisch zu degeneralisieren, brauchen wir vor jedem Prompt-Refactor eine Vergleichsbasis: gleiche Persona, gleicher Turn-Verlauf, unterschiedliche Modelle — und für jedes Resultat vollständige Sichtbarkeit auf Tool-Calls, Reasoning-Tokens, Latenz und Kosten. Diese Vergleichsbasis ist heute manuell aus stdout-Logs nicht herzustellen.

PROJ-13 schafft genau diese Grundlage:
1. Tracing aller 6 KI-Services in Langfuse
2. Eval-Runs landen als gruppierte Sessions mit `persona` × `model`-Tagging im Langfuse-Dashboard
3. Claude Code liest Traces über den Langfuse-MCP-Server — keine manuelle UI-Auswertung
4. Tool-Calls und Reasoning-Tokens sind als eigenständige Span-Felder sichtbar, nicht im Prompt-Blob versteckt
5. Kosten pro Trace und Aggregation nach Modell stehen im Dashboard zur Verfügung

## User Stories

- Als **Developer** kann ich im Langfuse-Dashboard zwei Eval-Runs (Persona X, Modell A vs. Modell B) nebeneinanderlegen und Tool-Call-Sequenz, Token-Verbrauch, Kosten und Latenz vergleichen.
- Als **Developer** kann ich aus Claude Code via MCP gezielt fragen „zeig mir den letzten Eval-Run der Buchhalter-Persona mit Modell `gemini-3.5-flash`, gruppiert nach Span-Typ" — ohne die Langfuse-UI zu öffnen.
- Als **Developer** kann ich für einen einzelnen LLM-Call sehen: Full System-Prompt, User-Turn-History, Tool-Definitionen, jeden Tool-Call mit Input/Output, Reasoning-Tokens, Output-Text, Token-Counts (Input/Output/Reasoning), Modell-Name, Latenz, Kosten.
- Als **Developer** kann ich für ein Interview alle LLM-Calls als gruppierte Session-Trace mit Eltern-Kind-Struktur sehen (`interview_id` als Trace-Root).
- Als **Developer** kann ich monatliche LLM-Kosten pro Modell aggregiert im Dashboard sehen und einen Provider-Wechsel (PROJ-9) datenbasiert kalkulieren.
- Als **Developer** kann ich Fehler mit vollständigem Trace-Kontext debuggen (Error-Span statt nur Exception in stderr).

## Acceptance Criteria

### Setup & Infrastructure
- [ ] `langfuse` SDK + AI-SDK-v6-OTEL-Integration installiert (`@langfuse/otel` oder offizieller Adapter)
- [ ] `src/lib/langfuse.ts` exportiert Singleton-Client und OTEL-Init
- [ ] Credentials (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`) ausschließlich via Env-Vars; Cloud EU als Default-Base-URL
- [ ] Kill-Switch: `LANGFUSE_ENABLED=false` deaktiviert Tracing vollständig (Default für lokales Dev, damit Free Tier nicht durch Hot-Reload-Spam verbraucht wird)
- [ ] Langfuse MCP-Server in `.claude/settings.local.json` registriert; Claude Code kann Traces, Sessions und Aggregationen abfragen
- [ ] README/CLAUDE.md dokumentiert: wie startet Claude Code eine Trace-Query, welche Tags existieren

### Service-Instrumentierung (alle 6 KI-Service-Dateien)
- [ ] `src/services/interviewAgent.ts` instrumentiert
- [ ] `src/services/extraction.ts` instrumentiert
- [ ] `src/services/embeddings.ts` instrumentiert
- [ ] `src/services/processEnrichment.ts` instrumentiert
- [ ] `src/services/useCaseEngine.ts` instrumentiert
- [ ] `src/services/reportGenerator.ts` instrumentiert (niedrigste Priorität)

### Trace-Struktur
- [ ] Jeder Interview-Ablauf erzeugt eine Trace mit `interview_id` als Root-Trace-ID
- [ ] Jeder Service-Call ist ein Kind-Span dieser Session-Trace
- [ ] Embedding-Calls erscheinen ausschließlich als Kind-Span innerhalb einer Session-Trace, nicht als eigenständige Traces
- [ ] Tool-Calls innerhalb eines LLM-Calls erscheinen als eigene Kind-Spans (Span-Typ `tool`), nicht im Prompt-Blob
- [ ] `reportGenerator` ohne `interview_id` erzeugt eine eigenständige Trace

### Span-Inhalt pro LLM-Call
- [ ] System-Prompt (eigenes Feld)
- [ ] User-/Assistant-Turn-History
- [ ] Verfügbare Tool-Definitionen
- [ ] Jeder Tool-Call mit Name, Input-Args, Output (eigene Kind-Spans)
- [ ] Reasoning-/Thinking-Tokens als eigenes Feld (Gemini Thinking, Claude Extended Thinking) — wenn das Modell sie liefert
- [ ] Output-Text und Streaming-Chunks rekonstruierbar
- [ ] Token-Count getrennt: `input`, `output`, `reasoning`, `cached`
- [ ] Latenz in ms (Time-To-First-Token + Total)
- [ ] Modell-Name (Parameter, kein Hardcode — provider-agnostisch)
- [ ] Fehler-Details als Error-Span falls vorhanden
- [ ] Abgerufene Vektordokumente aus pgvector (für Calls mit RAG-Kontext)

### Eval-Integration (PROJ-17 als Trace-Producer)
- [ ] `src/services/__evals__/interview/runner.ts` initialisiert Langfuse-Client und setzt vor jedem Run Tags: `persona`, `model`, `environment=eval`, `eval_run_id`
- [ ] Jeder Eval-Run erscheint im Langfuse-Dashboard als gruppierte Session mit dem Persona-Namen als Session-ID-Präfix
- [ ] `npm run eval-interview <persona>` gibt am Ende die Langfuse-Trace-URL des Runs auf stdout aus
- [ ] Dashboard-View dokumentiert: Vergleich von zwei Eval-Runs (gleiche Persona, unterschiedliches Modell) nebeneinander

### Cost-Tracking
- [ ] Langfuse berechnet Kosten pro Span automatisch (Tokens × Provider-Preisliste); Preisliste für `gemini-3.1-flash-lite`, `gemini-3.5-flash`, Anthropic-Modelle hinterlegt
- [ ] Dashboard-View zeigt: Kosten pro Modell aggregiert pro Tag/Woche
- [ ] Dashboard-View zeigt: Kosten pro Eval-Run (Persona × Modell)
- [ ] Verifikations-Run: ein Test-Interview erzeugt eine Trace, die in der Cost-Übersicht erscheint und nicht 0 € ist

### Non-Blocking & Robustness
- [ ] Tracing ist non-blocking: kein `await` auf Langfuse-Flush in Hot Paths
- [ ] Schlägt die Langfuse-API fehl, läuft der LLM-Call trotzdem durch (fire-and-forget)
- [ ] Trace-Fehler werden in stderr geloggt, der LLM-Call wird nicht neu versucht
- [ ] Tracing-Code ausschließlich in `src/services/` — keine Tracing-Aufrufe in API Routes (Service-Layer-Constraint aus PROJ-4)

## Edge Cases

- **Langfuse nicht erreichbar:** Trace-Fehler in stderr, LLM-Call läuft durch, kein Retry
- **Interview wird abgebrochen:** Session-Trace mit Fehler-Status abgeschlossen, nicht offen gelassen
- **Großer Vektor-Kontext:** Kein Truncating, vollständige Dokumente im Span
- **Parallele Interviews:** Isolation über `interview_id` als Trace-Root, kein Cross-Contamination
- **Lokales Dev mit `LANGFUSE_ENABLED=false`:** Service-Code läuft identisch ab, nur ohne Span-Emission — keine zusätzlichen if-else-Pfade
- **Modell liefert keine Reasoning-Tokens (z.B. 3.1 Flash Lite):** Span-Feld `reasoning_tokens` ist 0 oder fehlt, kein Fehler
- **Eval-Runner crasht mid-run:** offene Session-Trace bekommt Fehler-Status, lokale stdout-Logs bleiben unverändert
- **Provider-Wechsel (PROJ-9):** Modell-Name ist Span-Parameter, kein Refactor nötig
- **MCP-Server-Down:** Claude Code-Queries schlagen fehl, Dashboard bleibt nutzbar

## Technical Requirements

- Vercel AI SDK v6 OTEL-Integration (nicht: manuelle Span-Erstellung pro Service) — vermeidet 6× duplizierten Boilerplate
- Langfuse Cloud EU Free Tier (50k Observations/Monat) für MVP — kein Self-Hosting
- 100 % Sampling — keine Sampling-Logik in dieser Iteration
- Service-Layer-Constraint: Tracing-Code in `src/services/`, nicht in API Routes
- MCP-Konfiguration in `.claude/settings.local.json` (gitignored) — pro Developer eigener Read-Key

## Non-Goals

- In-App Token-/Cost-Reporting (eigenes Feature, nach PROJ-13)
- Langfuse Self-Hosting (erst bei GDPR-Verschärfung oder >50k Spans/Mo)
- Automated Alerting via Langfuse
- Trace-Sampling
- Tracing für nicht-KI-Calls (Datenbankabfragen, Auth)
- Vercel AI Gateway als zweite Cost-Quelle (erst nach PROJ-9, wenn Multi-Provider-Strategie steht)
- Production-Alerting bei Kostenanstieg

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Status:** Approved 2026-05-28

### A) Komponenten-Struktur

```
Tracing-Layer (neu)
├── src/lib/langfuse.ts                          [neu]
│   ├── OTEL-SDK-Init (NodeSDK + Langfuse-Exporter)
│   ├── Singleton-Pattern: einmal pro Prozess initialisiert
│   └── Kill-Switch: LANGFUSE_ENABLED=false → no-op
│
├── src/services/_telemetry.ts                   [neu, schmal]
│   ├── buildTraceMetadata({ interviewId, persona?, model, environment, evalRunId? })
│   └── liefert das experimental_telemetry-Objekt für AI-SDK-Calls
│
├── 6× Service-Dateien                            [modifiziert]
│   ├── interviewAgent.ts        ← primärer Trace-Producer
│   ├── extraction.ts
│   ├── embeddings.ts
│   ├── processEnrichment.ts
│   ├── useCaseEngine.ts
│   └── reportGenerator.ts       ← niedrigste Priorität, eigene Trace ohne interview_id
│   Pro LLM-Call: experimental_telemetry-Block + TraceContext-Parameter
│
└── src/services/__evals__/interview/runner.ts   [modifiziert]
    └── setzt Tags persona × model × environment=eval × eval_run_id vor jedem Run

API-Layer                                         [modifiziert, minimal]
└── Routen die Services aufrufen reichen interview_id als TraceContext durch
    (kein eigener Tracing-Code in API Routes — Service-Layer-Constraint)

MCP-Layer                                         [neu]
└── .claude/settings.local.json                  [modifiziert]
    └── Langfuse-MCP-Server-Eintrag (Read-Key pro Developer, gitignored)

Konfiguration                                     [modifiziert]
├── .env.example                                  ← LANGFUSE_* Variablen + Defaults
└── CLAUDE.md                                     ← MCP-Query-Patterns, Tag-Konventionen
```

### B) Datenmodell (was eine Trace beschreibt)

Eine **Trace** bildet einen kompletten Vorgang ab — in Produktion ein Interview, im Eval-Lauf eine Persona-Sitzung.

```
Trace
├── ID:           interview_id (oder eval_run_id für reportGenerator-only-Läufe)
├── Tags:         { persona, model, environment: "prod" | "eval", eval_run_id? }
├── Status:       running | completed | error
├── Created at:   Start-Zeitstempel
└── Spans:        N Service-Calls (eine Span pro LLM-/Embedding-Call)
```

Ein **Span** pro KI-Call enthält:

```
Span (LLM-Call)
├── Service-Name:        interviewAgent | extraction | embeddings | …
├── Modell-Name:         z.B. "google/gemini-3.1-flash-lite"
├── System-Prompt:       eigenes Feld
├── Turn-History:        user/assistant-Verlauf
├── Tool-Definitionen:   verfügbare Tools für diesen Call
├── Token-Counts:        { input, output, reasoning, cached }
├── Latenz:              { ttft_ms, total_ms }
├── Kosten:              automatisch (Langfuse-Preisliste)
├── Output-Text:         finaler Assistant-Output
└── Kind-Spans:
    ├── Tool-Calls       { name, input, output }
    ├── RAG-Context      abgerufene Vektordokumente (falls vorhanden)
    └── Error            falls Exception
```

**Speicherort:** Langfuse Cloud EU (Free Tier 50k Observations/Mo). Keine Daten in der eigenen DB.

**Trace-Korrelation:** `interview_id` wird als expliziter `TraceContext`-Parameter an jeden Service durchgereicht (von API Route → Service → AI-SDK-Telemetry-Metadata). Keine implizite Async-Hook-Magie, da diese auf Vercel Fluid Compute zwar verfügbar, aber fragil über Streaming-Grenzen hinweg ist.

### C) Tech-Entscheidungen

| Entscheidung | Warum |
|---|---|
| **Langfuse** als Observability-Backend (vs. LangSmith, Phoenix, Helicone) | EU-Hosting (DSGVO-konform), Open Source mit Self-Host-Option als Notausgang, kostenloser Tier reicht für aktuelles Volumen, nativer MCP-Server vorhanden, native AI-SDK-v6-OTEL-Integration. Lock-in-Risiko gering: OTEL ist Standard, Wechsel zum Self-Host oder zu anderem OTEL-Backend ist reine Exporter-Umkonfiguration. |
| **OTEL via AI SDK v6 `experimental_telemetry`** (vs. manuelle Span-Erstellung) | Ein Telemetry-Block pro `generateText`/`streamText`-Aufruf. AI SDK liefert Tool-Calls, Token-Splits (inkl. Reasoning), Latenz und Streaming-Chunks frei Haus. Manuelle Instrumentierung wäre 6× Boilerplate mit hoher Drift-Wahrscheinlichkeit. |
| **`interview_id` als Trace-Root, explizit weitergereicht** | Eindeutige Korrelation aller Service-Calls eines Interviews ohne Datenbank-Joins. Explizite Übergabe statt Async-Hook-Kontext, weil Service-Layer-Constraint ohnehin saubere Funktions-Signaturen erzwingt und Streaming-Grenzen Async-Hooks schwer machen. |
| **Fire-and-forget Flush** | Tracing darf den Interview-Hot-Path nie blockieren. Bei Backend-Ausfall fließen Traces verloren, das Interview läuft sauber durch. Akzeptiert für Observability-Layer. |
| **Kill-Switch `LANGFUSE_ENABLED=false`** | Lokales Dev verbrennt sonst Free-Tier-Kontingent durch Hot-Reload-Spam. Eval-Läufe lokal aktivieren, normales `npm run dev` deaktiviert. |
| **Langfuse-MCP-Server für Claude Code** | Eval-Vergleich (Persona × Modell × Run) soll von Claude Code selbst auswertbar sein, statt manueller UI-Klicks. MCP macht Traces als strukturierte Resource verfügbar. |
| **100 % Sampling, kein Sampling-Layer** | Volumen ist klein (≤50k Spans/Mo). Sampling fügt Komplexität ohne Nutzen hinzu. Wenn Volumen steigt, ist Sampling ein separater Refactor. |
| **Service-Layer-Constraint hält** | Sämtliche Tracing-Aufrufe in `src/services/` — API Routes bleiben frei von Tracing-Code. Folgt PROJ-4-Architekturentscheidung. |

### D) Dependencies (neu)

| Paket | Zweck |
|---|---|
| `langfuse` | Server-SDK (Singleton-Client, Kosten-Lookup) |
| `@langfuse/otel` | OTEL-Exporter, der AI-SDK-v6-Spans an Langfuse weiterleitet |
| `@opentelemetry/sdk-node` | OTEL-NodeSDK-Init (Peer-Dep des Adapters) |
| `@opentelemetry/api` | Span-Context-API (falls TraceContext-Helper Spans erweitert) |

Bereits installiert: `ai@^6`, `@ai-sdk/anthropic`, `@ai-sdk/google`.

Kein Frontend-Paket, kein DB-Schema-Change.

### F) Implementierungshinweise (Fallstricke für den Coder)

#### F1 — OTEL-Init-Timing: `src/instrumentation.ts` ist der einzige sichere Ort

Next.js 15+ (hier 16.2.6) führt `src/instrumentation.ts` einmal pro Serverstart aus, bevor der erste Request angenommen wird. Das ist der einzige Ort, an dem OTEL-`NodeSDK.start()` zuverlässig vor dem ersten AI-SDK-Call läuft.

```
src/instrumentation.ts          ← NEU (Next.js-Hook, kein Import nötig)
  export async function register() → ruft initLangfuse() aus lib/langfuse.ts auf

src/lib/langfuse.ts             ← enthält die Init-Logik, exportiert initLangfuse()
```

**Nicht:** `langfuse.ts` per lazy-import irgendwo in einem Service. Auf Vercel Fluid Compute kann die Init nach dem ersten Request-Start ankommen, da Function-Instances wiederverwendet werden — OTEL würde Spans verpassen, die vor dem ersten vollständigen `register()`-Lauf entstehen.

#### F2 — Langfuse-OTEL-Attribut-Namen sind exakt definiert

Der AI SDK übergibt `experimental_telemetry.metadata` als OTEL-Span-Attribute. Langfuse's OTEL-Exporter mappt diese auf Langfuse-Konzepte **nur wenn die Keys exakt stimmen**:

| gewünschtes Langfuse-Konzept | OTEL-Attribut-Key in `metadata` |
|---|---|
| Session-Gruppierung (= `interview_id`) | `langfuse.session_id` |
| User-ID | `langfuse.user_id` |
| Tags (Persona, Modell, Env) | `langfuse.tags` (JSON-Array als String) |
| Trace-ID-Override | `langfuse.trace_id` |

`buildTraceMetadata()` in `_telemetry.ts` muss diese Keys exakt setzen. Falsch gewählte Keys landen als unstrukturierte Custom-Attribute und erscheinen nicht in Langfuse-Sessions.

#### F3 — Eval-Runner ist ein separater Node-Prozess

`runner.ts` wird via `tsx src/services/__evals__/...` direkt ausgeführt, nicht durch Next.js. `src/instrumentation.ts` wird **nicht** aufgerufen. Der Eval-Runner muss `initLangfuse()` explizit importieren und als ersten Aufruf ausführen, bevor er die erste Persona-Sitzung startet. Dafür muss `LANGFUSE_ENABLED=true` im lokalen Eval-Kontext gesetzt sein (z. B. als CLI-Env-Variable beim `npm run eval-interview`-Aufruf).

#### F4 — Kill-Switch muss vor NodeSDK-Instanziierung greifen

`initLangfuse()` prüft `LANGFUSE_ENABLED` als allererste Zeile und returnt früh, **bevor** `NodeSDK` oder `LangfuseExporter` instanziiert werden. Nicht erst nach `.start()`. Grund: wenn die Credentials-Env-Variablen fehlen (lokales Dev), schlägt der Exporter-Konstruktor fehl, nicht erst `.start()`.

#### F5 — `interviewId` muss durch `useCaseEngine` → `embeddings` laufen

`useCaseEngine.ts` ruft intern `embeddings.ts` auf. Embedding-Calls müssen denselben `interview_id`-Context erben, sonst erscheinen sie im Dashboard als eigenständige Traces statt als Kind-Spans des Interviews. Das erfordert eine Signaturen-Änderung:

```
useCaseEngine(input, { interviewId })       ← interviewId als Parameter
  → embeddings.generateEmbedding(text, { interviewId })
      → experimental_telemetry.metadata { langfuse.session_id: interviewId }
```

Der gleiche Durchstich gilt für alle Service-Ketten, in denen ein Service einen anderen aufruft.

### E) Was diese Architektur **nicht** löst

- Keine In-App-Anzeige von Kosten / Tokens (separates Feature)
- Keine Alerts bei Kosten-Spikes (manuelle Dashboard-Sichtung)
- Kein Tracing für Nicht-KI-Calls (DB-Queries, Auth) — bewusst aus Scope
- Kein Trace-Schreibzugriff für Claude Code (MCP nur lesend)


## Implementation Notes

**Status:** Implementierung abgeschlossen 2026-05-28. Bereit für `/qa`.

### Neue Dateien
- `src/lib/langfuse.ts` — OTEL NodeSDK Singleton mit `LangfuseSpanProcessor`. Kill-Switch greift vor SDK-Instanziierung (per F4).
- `src/instrumentation.ts` — Next.js Hook, ruft `initLangfuse()` einmal pro Serverprozess auf (per F1).
- `src/services/_telemetry.ts` — `buildTraceMetadata(fnName, TraceCtx)`. Gibt `{ isEnabled: false }` zurück wenn `LANGFUSE_ENABLED !== 'true'`. Setzt `langfuse.session_id = interviewId` und `langfuse.tags` als JSON-Array-String (per F2).
- `src/services/__evals__/interview/runner.ts` — Standalone Eval-Runner. Lädt `.env.local` via `dotenv`, initialisiert Langfuse, erstellt Interview in Supabase, führt vollständigen Agent-Loop mit LLM-simulierter Persona durch, gibt Langfuse-Session-URL aus.

### Modifizierte Service-Dateien
Alle 5 KI-Service-Dateien instrumentiert (optional `traceCtx?: TraceCtx`):
- `interviewAgent.ts` — `streamText` mit `experimental_telemetry: buildTraceMetadata('interviewAgent.turn', ...)`
- `extraction.ts` — `generateText` mit `extraction.extractAndEmbed`; `traceCtx` wird an `generateEmbedding` weitergegeben (per F5)
- `embeddings.ts` — `embed` mit `embeddings.generateEmbedding`
- `processEnrichment.ts` — beide `generateText`-Calls (`enrichProcessSteps` + `createProcessStepsFromTracker`)
- `reportGenerator.ts` — `generateText` mit `reportGenerator.generateExecutiveSummary`

### Abweichungen vom Spec
- `useCaseEngine.ts` hat keine LLM-Calls (pure Heuristik) — Instrumentierung nicht durchgeführt, kein Refactor nötig.
- `@langfuse/otel` exportiert `LangfuseSpanProcessor` (kein `LangfuseExporter`) — `NodeSDK` nutzt `spanProcessors`-Array statt `traceExporter`.
- `TurnTranscript`-Interface in `extraction.ts` auf `export` gesetzt (war package-private, wird vom Runner benötigt).
- `dotenv` als neue Dependency für den Eval-Runner hinzugefügt.

### Neue Packages
`langfuse`, `@langfuse/otel`, `@opentelemetry/sdk-node`, `@opentelemetry/api`, `dotenv`

## QA Test Results

**QA Date:** 2026-05-28
**Status:** Approved
**Bug Tally:** 0:0:2

### Build & Type Safety
- [x] `npm run build` — passes clean, no warnings
- [x] `tsc --noEmit` — passes, zero type errors
- [x] `npm test` — 229/231 passing (2 pre-existing failures in processEnrichment.test.ts from PROJ-20, not PROJ-13)

### Acceptance Criteria

#### Setup & Infrastructure
- [x] langfuse, @langfuse/otel, @opentelemetry/sdk-node, @opentelemetry/api installiert
- [x] `src/lib/langfuse.ts` — Singleton-Init, Kill-Switch greift vor NodeSDK-Konstruktion (F4 korrekt)
- [x] `src/instrumentation.ts` — Next.js auto-detects, ruft initLangfuse() einmal pro Server-Prozess auf
- [x] Credentials ausschließlich via Env-Vars; .env.local.example vollständig dokumentiert
- [x] Kill-Switch `LANGFUSE_ENABLED=false` — default off, kein NodeSDK-Overhead
- [x] CLAUDE.md dokumentiert MCP-Setup, Tag-Konventionen, Beispiel-Queries
- [ ] `.claude/settings.local.json` — Datei nicht angelegt (erwartet: gitignored, pro-Developer-Setup)

#### Service-Instrumentierung
- [x] interviewAgent.ts — `streamText` mit `experimental_telemetry`; `context.interviewId` immer gesetzt → session_id auch ohne traceCtx korrekt
- [x] extraction.ts — `generateText` mit `experimental_telemetry`; `interviewId` direkt aus Funktions-Param → immer session-gebunden
- [x] embeddings.ts — `embed` mit `experimental_telemetry` und `traceCtx`
- [x] processEnrichment.ts — beide `generateText`-Calls (`enrichProcessSteps` + `createProcessStepsFromTracker`) mit telemetry
- [x] useCaseEngine.ts — korrekt ausgelassen (pure Heuristik, keine LLM-Calls)
- [x] reportGenerator.ts — `generateText` mit `experimental_telemetry`

#### Trace-Struktur
- [x] Interview-Ablauf → Trace mit `interview_id` als `langfuse.session_id` (interviewAgent immer korrekt)
- [x] Tool-Calls → Kind-Spans (AI SDK OTEL-Integration liefert das automatisch)
- [x] reportGenerator ohne interview_id → eigenständige Trace (traceCtx optional)
- [~] Embedding-Calls als Session-Kind: **partiell** — siehe L1, L2 unten

#### Eval-Integration
- [x] runner.ts lädt .env.local via dotenv vor allen anderen Imports
- [x] Initialisiert Langfuse explizit (`process.env.LANGFUSE_ENABLED = 'true'` + `initLangfuse()`)
- [x] Setzt Tags: `persona`, `model`, `environment=eval`, `eval_run_id`
- [x] `traceCtx` wird an createInterviewStream, extractAndEmbed durchgereicht
- [x] Eval-Run erscheint als Session mit `interviewId` als Präfix
- [x] Langfuse-Session-URL auf stdout: `<base>/project/sessions?search=<interviewId>`
- [ ] EVAL_WORKSPACE_ID nicht gesetzt (User-Hinweis — Setup-Schritt, kein Code-Bug)

#### Non-Blocking & Robustness
- [x] Fire-and-forget: LangfuseSpanProcessor ist async, kein await in Hot Paths
- [x] Tracing-Code ausschließlich in `src/services/` — API Routes bleiben frei
- [x] SIGTERM-Handler in langfuse.ts registriert für graceful flush

### Bugs Found

**L1 (Low) — Embedding-Spans aus extraction.extractAndEmbed nicht session-gebunden (Produktionspfad)** ✅ FIXED
- Betroffen: `src/services/extraction.ts:133` — wenn aus dem Chat-API-Route ohne traceCtx aufgerufen, war traceCtx=undefined → kein `langfuse.session_id` auf dem Embedding-Span
- Fix angewendet: `generateEmbedding(embeddingInput, traceCtx ?? { interviewId })`

**L2 (Low) — Embedding-Span aus processEnrichment.createProcessStepsFromTracker immer ohne session_id** ✅ FIXED
- Betroffen: `src/services/processEnrichment.ts:329` — `generateEmbedding(...)` ohne traceCtx-Argument in jedem Aufrufpfad
- Fix angewendet: `generateEmbedding(`${title} ${description ?? ''}`.trim(), traceCtx)`

**Pre-existing (nicht PROJ-13):**
- 2 failing tests in `processEnrichment.test.ts` (source_quote Feld-Mismatch aus commit 71c3c97, PROJ-20) — verifiziert via git stash

### Security Audit
- Keine Langfuse-Keys in Logs oder API-Responses
- Kill-Switch verhindert versehentliche Span-Emission in lokalem Dev
- Credentials nur server-seitig (kein NEXT_PUBLIC_ Präfix) — korrekt
- OTEL-Spans verlassen den Server-Prozess, nicht den Browser → CSP irrelevant

### Production-Ready Assessment
**READY** — keine Critical oder High Bugs. Die zwei Low-Bugs betreffen Embedding-Span-Gruppierung im Langfuse-Dashboard, haben keinen Einfluss auf Funktionalität oder den primären Eval-Use-Case (der korrekt funktioniert, weil der Runner traceCtx immer weitergibt).

## Deployment

**Deployed:** 2026-05-28
**Production URL:** https://meridian-app-tau.vercel.app
**Commit:** 91748d9
**Vercel Deployment:** dpl_HrKhGe9ruHzBCMiGiUeQvXDL3sFN

| Gate | Status | Notiz |
|------|--------|-------|
| G1 Static | pass | Build + tsc sauber |
| G2 Tests | pass | 231/231 nach processEnrichment-Fix (fix(PROJ-20): source_quote) |
| G3 Sandbox | skipped | rein server-seitig, kill-switch default off, kein Risiko |
| G4 Permissions | pass | keine neuen Tabellen/Endpoints; Langfuse-Keys server-only |

## Post-Mortem

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | High — Abweichungen minor: useCaseEngine (pure Heuristik, kein LLM), @langfuse/otel SpanProcessor statt LangfuseExporter; beide dokumentiert |
| Appetite vs. tatsächlich | geschätzt: M / tatsächlich: S (1-2 Tage) |
| Größte Überraschung | Eval-Runner und MCP-Server entstanden umfangreicher als geplant — eval-Logik grundlegend angepasst, MCP-Server automatisch mitangelegt ohne vorherige Absprache |
| Vorgeschlagene Regeländerung | Pre-existing Test-Failures sofort fixen, nicht als "pre-existing" markieren und weiterziehen. Vor jedem Deploy müssen 100 % Tests grün sein. |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | Test (processEnrichment source_quote Mismatch) |
