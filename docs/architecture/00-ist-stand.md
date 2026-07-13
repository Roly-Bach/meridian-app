# Ist-Stand-Inventar — `src/`

**Zweck:** Faktische, deskriptive Bestandsaufnahme von `src/` als Grundlage für den Cluster-Vorschlag (Schritt 2) und den späteren C4-Doku-Baum (Schritt 3). Dieses Dokument interpretiert noch nicht — keine Cluster, keine Architektur-Bewertung, nur "was ist da und wofür".

**Scope:** `src/` vollständig. `docs/`, `features/`, `README.md` bleiben Quellen/Referenzen, nicht Ziel dieser Inventur.

**Methode:** Datei-für-Datei-Exploration (Explore-Agenten) + `wc -l` für exakte Zeilenzahlen + `git ls-files src/` als Vollständigkeits-Referenz. Stand: 2026-07-12.

**Nicht einzeln aufgeführt:** die 35 unveränderten shadcn/ui-Primitives in `components/ui/` (vendored) und die 25 Eval-Fixture-Dateien unter `services/__evals__/interview/__fixtures__/` (generierte Transkript-/Baseline-Daten aus Eval-Läufen, keine Dokumentationsarbeit wert) — beide als Sammelzeile im Baum.

---

## Kennzahlen

| Ordner | Dateien | Zeilen (ts/tsx/css/json, ohne Fixtures) |
|---|---:|---:|
| `services/` (inkl. `__evals__/`, `turnStore/`) | 134 | 23.690 |
| `components/` | 63 | 6.979 |
| `app/` | 54 | 6.148 |
| `lib/` | 14 | 2.023 |
| `hooks/` | 6 | 1.293 |
| `test/` | 1 | 1 |
| `schemas/` | 1 | 124 |
| `middleware.ts` + `middleware.test.ts` | 2 | 111 |
| `instrumentation.ts` | 1 | 8 |
| **Gesamt** | **276** | **40.462** |

Weitere Kennzahlen: 66 Testdateien (`*.test.ts`/`*.test.tsx`, ~1 pro 2,8 Nicht-Testdateien), 25 Eval-Fixture-Dateien, Vitest mit jsdom, Pfad-Alias `@` → `src/`.

**10 größte Dateien:**

| Datei | Zeilen |
|---|---:|
| `services/__evals__/interview/runner.ts` | 1.287 |
| `components/ui/sidebar.tsx` (shadcn, vendored) | 773 |
| `services/interviewAgent.ts` | 762 |
| `services/useCaseEngine.ts` | 746 |
| `services/interviewAnalyst.ts` | 734 |
| `services/useCaseEngine.test.ts` | 688 |
| `components/ProcessStepsTable.tsx` | 685 |
| `services/interviewSemantic.ts` | 628 |
| `lib/supabase-types.ts` (generiert) | 626 |
| `services/runInterviewTurn.test.ts` | 613 |

---

## Baum

```
src/
├── instrumentation.ts (8)          # Next.js-Hook, startet Langfuse-OTEL-SDK beim Serverstart
├── middleware.ts (81, +test)       # Auth-Gate + CSP-Nonce für alle Routen
├── app/
│   ├── api/
│   │   ├── interview/[token]/      # öffentliche, token-authentifizierte Interview-Endpoints
│   │   │   ├── chat/route.ts (125, +test)          # Turn-Endpoint, delegiert an runInterviewTurn
│   │   │   ├── clarification/route.ts (258, +test)  # Nachfrage-Antworten verarbeiten, Interview abschließen
│   │   │   ├── objects/route.ts (59, +test)         # Knowledge Objects eines Interviews (session-auth)
│   │   │   ├── reconnect/route.ts (136, +test)      # Wiedereinstieg nach Reload/Verbindungsabbruch
│   │   │   ├── route.ts (82, +test: token.test.ts)  # Interview-Metadaten + Turns + Clarification-Cards
│   │   │   ├── start/route.ts (114, +test)          # Kaltstart, persistiert Opener-Text
│   │   │   └── voice-token/route.ts (103, +test)    # kurzlebiges ElevenLabs-Scribe-Token
│   │   ├── interviews/             # Berater-verwaltete Interviews (session-auth)
│   │   │   ├── [id]/pdf/route.tsx (102, +test)      # PDF-Report-Generierung
│   │   │   ├── [id]/reextract/route.ts (138)        # Re-Extraktion über alle Turns
│   │   │   ├── [id]/route.ts (63)                   # DELETE (hard delete, kaskadiert)
│   │   │   └── route.ts (149, +test)                # GET Liste / POST Neuanlage
│   │   ├── knowledge/search/route.ts (65, +test)     # Vektor-Suche über knowledge_objects
│   │   ├── process-steps/
│   │   │   ├── [id]/route.ts (81, +test)             # PATCH einzelner Prozessschritt
│   │   │   ├── [id]/substeps/route.ts (73)           # Substep-Flow generieren/cachen
│   │   │   ├── generate/route.ts (77, +test)         # Prozessschritte aus Step-Tracker ableiten
│   │   │   └── route.ts (49, +test: process-steps.test.ts)  # GET Liste
│   │   └── use-cases/
│   │       ├── [id]/route.ts (131, +test: id.test.ts)      # Use-Case-Detail + ROI-Breakdown
│   │       ├── [id]/insights/route.ts (113, +test)          # LLM-Insights, cache-first
│   │       ├── generate/route.ts (181, +test)                # Heuristik-Engine ausführen
│   │       ├── roadmap/route.ts (61, +test)                  # Q1/Q2/Q3-Gruppierung
│   │       └── route.ts (50, +test: use-cases.test.ts)      # GET Liste + Gesamt-ROI
│   ├── auth/
│   │   ├── actions.ts (10)          # Server Action logout()
│   │   └── callback/route.ts (36)   # OAuth/Email-Callback
│   ├── dashboard/
│   │   ├── layout.tsx (44)                    # Sidebar-Shell, Redirect wenn nicht eingeloggt
│   │   ├── page.tsx (5)                       # rendert InterviewsClient
│   │   ├── process-steps/page.tsx (51)         # rendert ProcessStepsTable
│   │   ├── use-cases/page.tsx (53)             # rendert UseCaseBoardClient
│   │   └── use-cases/roadmap/page.tsx (112)    # Quartals-Roadmap-Board
│   ├── interview/[token]/page.tsx (128)  # Mitarbeiter-Oberfläche, State-Machine loading/error/clarification/ready
│   ├── login/ , signup/                  # je actions.ts (Server Action) + page.tsx (Formular)
│   ├── globals.css (85)                  # Tailwind + shadcn-Theme-Tokens
│   ├── layout.tsx (25)                   # Root-Layout, CSP-Nonce, Toaster
│   └── page.tsx (7)                      # Redirect zu /login
├── components/
│   ├── ui/                          # 35 unveränderte shadcn/ui-Primitives (vendored, "nie neu implementieren")
│   ├── interview/                   # Mitarbeiter-Chat-/Voice-UI (9 Dateien + 1 Test)
│   │   ├── ChatInterface.tsx (174)          # Top-Level-Chat, treibt useInterviewStream
│   │   ├── ChatInput.tsx (105, +test)        # Textarea + Send + Mic (nutzt useVoiceInput)
│   │   ├── MessageList.tsx (39) / MessageBubble.tsx (25)  # Nachrichtenverlauf
│   │   ├── MicButton.tsx (46)                # Voice-State-Icon
│   │   ├── ClarificationView.tsx (127) / ClarificationCards.tsx (211)  # Nachfrage-Flow
│   │   ├── ChatCompletedScreen.tsx (18) / ChatErrorScreen.tsx (22)     # Terminal-States
│   ├── interviews/                  # Berater-Interview-Verwaltung (9 Dateien)
│   │   ├── InterviewsClient.tsx (70)          # Top-Level-Container, fetch + State
│   │   ├── InterviewsTable.tsx (47) / InterviewRow.tsx (61) / StatusBadge.tsx (16)
│   │   ├── NewInterviewDialog.tsx (337)       # 2-Schritt-Dialog: Formular → Link
│   │   ├── CopyLinkButton.tsx (50) / DownloadPdfButton.tsx (57) / DeleteInterviewButton.tsx (85)
│   │   └── EmptyState.tsx (22)
│   ├── pdf/InterviewReport.tsx (476)  # react-pdf-Dokumentdefinition für den Report
│   ├── dashboard/SidebarNav.tsx (39)  # Nav-Liste mit Active-Route-Highlighting
│   └── (root)                        # Dashboard-Widgets für Prozessschritte + Use Cases
│       ├── ProcessStepsTable.tsx (685)    # Haupt-View Prozessschritte: Dept→Cluster-Gruppierung, Detail-Sheet
│       ├── UseCaseBoardClient.tsx (181)   # Use-Case-Board, 3 strategische Cluster
│       ├── UseCaseSheet.tsx (397)         # Use-Case-Detail-Sheet (fetch [id] + insights parallel)
│       ├── UseCaseCard.tsx (153) / MetricsGrid.tsx (33) / RoiBreakdown.tsx (37) / ParticipantList.tsx (65)
├── hooks/
│   ├── useVoiceInput.ts (308, +test)       # ElevenLabs-Scribe-Pipeline: Mic → PCM → WebSocket → Transkript
│   ├── useInterviewStream.ts (84, +test)   # Streaming-Fetch für /chat, /reconnect, /start
│   ├── use-mobile.tsx (19)                 # Viewport-Breakpoint-Hook (shadcn-Abhängigkeit)
│   └── use-toast.ts (194)                  # vendored shadcn Toast-State-Manager
├── lib/
│   ├── supabase.ts (8) / supabase-server.ts (27) / supabase-admin.ts (24)  # 3 Client-Varianten (Browser/Server/Service-Role)
│   ├── database.types.ts (409) / supabase-types.ts (626)  # generierte DB-Typen
│   ├── llm-provider.ts (109, +test)         # Modell-Routing "provider/model" → AI-SDK-Instanz
│   ├── ratelimit.ts (136, +test)            # Upstash-Redis-Rate-Limiting, fail-open ohne Redis
│   ├── langfuse.ts (66)                     # OTEL/Langfuse-Tracing-Bootstrap
│   ├── processStepsAggregation.ts (128, +test)  # reine Aggregations-Helper für ProcessStepsTable
│   ├── utils.ts (6)                         # cn() Tailwind-Merge (shadcn-Standard)
│   └── audio/pcm-worklet.ts (59)            # AudioWorklet-Source (Blob-URL) für useVoiceInput
├── schemas/prozessschritt-schema.json (124)  # kanonisches Schritt-Schema (SSoT: meridian-ma, gesynct)
├── services/
│   ├── (root, 24 Dateien)            # Interview-Turn-Engine, Extraktion, Use-Case-Engine — siehe Detail unten
│   ├── turnStore/ (9 Dateien)        # Persistenz-Port + Adapter (PROJ-34/ADR-018)
│   └── __evals__/interview/ (82 Dateien)  # Eval-Harness: Runner, Scorer, Personas, Replay, Validation
└── test/setup.ts (1)                 # Vitest/RTL Global-Setup
```

---

## Detailbeschreibungen

### `app/` — Next.js App Router (54 Dateien, 6.148 Zeilen)

Dünne Route-Handler: parsen Request, rufen `services/` auf, geben Response zurück. 18 von 24 API-Routen haben eine Testdatei. Keine Tests für `interviews/[id]/route.ts`, `interviews/[id]/reextract/route.ts`, `process-steps/[id]/substeps/route.ts`, `auth/actions.ts`, `auth/callback/route.ts`, Pages/Layouts.

**`api/interview/[token]/`** (öffentlich, Token statt Session-Auth):
- `chat/route.ts` — validiert Input (Zod, max 10k Zeichen) + Token-Format, lädt Interview, Guards für 404/410 (abgelaufen)/409 (abgeschlossen), rate-limited, aktiviert `created→active`, delegiert an `runInterviewTurn`, streamt Talker-Antwort.
- `clarification/route.ts` — persistiert Nachfrage-Antworten, mappt Fixed-Option-Antworten auf `process_steps`-Felder, markiert Interview `completed`, triggert in `after()` Prozessschritt-Erstellung + Clustering + Dedup.
- `objects/route.ts` — Knowledge Objects eines Interviews, erfordert zusätzlich echte Session (nicht nur Token).
- `reconnect/route.ts` — Wiedereinstieg; seit KI-22-Fix: gibt bei unbeantworteter letzter Agent-Frage eine statische Zeile zurück (kein LLM-Call, kein Duplikat-Risiko), sonst adaptive Begrüßung.
- `route.ts` — GET Metadaten + Turns + ggf. Clarification-Cards, für Frontend-State-Detection.
- `start/route.ts` — Kaltstart, 409 wenn schon Turns existieren, persistiert Opener-Text via `onFinish`.
- `voice-token/route.ts` — kurzlebiges ElevenLabs-Realtime-Scribe-Token.

**`api/interviews/`** (Berater, Session-Auth):
- `[id]/pdf/route.tsx` — nur bei `status==='completed'`, rendert `InterviewReport` zu PDF-Buffer.
- `[id]/reextract/route.ts` — Bearer-JWT-Auth, re-extrahiert alle Turns idempotent, löscht+erstellt `process_steps` neu, reclustered Workspace.
- `[id]/route.ts` — DELETE, Workspace-Ownership-Check, hard delete (kaskadiert).
- `route.ts` — GET Liste (bis 100) / POST Neuanlage (Zod-validiert, 30-Tage-Token, Rollback bei State-Insert-Fehler).

**`api/knowledge/search/route.ts`** — Vektor-Suche via `generateEmbedding` + `search_knowledge_objects`-RPC.

**`api/process-steps/`**: `[id]/route.ts` (PATCH, Zod-validiert), `[id]/substeps/route.ts` (GET cached / POST generiert via LLM), `generate/route.ts` (aus Step-Tracker ableiten), `route.ts` (GET Liste bis 200).

**`api/use-cases/`**: `[id]/route.ts` (Detail + ROI-Breakdown, workspace-übergreifend gesucht), `[id]/insights/route.ts` (cache-first LLM-Insights), `generate/route.ts` (Heuristik-Engine R1–R8/P1–P4/C1–C3, insert-then-delete), `roadmap/route.ts` (Q1/Q2/Q3-Gruppierung), `route.ts` (GET Liste bis 500 + Gesamt-ROI).

**Auth/Pages:** `auth/actions.ts` (logout), `auth/callback/route.ts` (OAuth-Exchange), `dashboard/layout.tsx` (Sidebar-Shell + Redirect-Guard), `dashboard/page.tsx`/`process-steps/page.tsx`/`use-cases/page.tsx`/`use-cases/roadmap/page.tsx` (Server Components, laden Daten, rendern Client-Container), `interview/[token]/page.tsx` (State-Machine loading/error/completed/clarification/ready), `login/`+`signup/` (Server Action + Formular, Invite-Only-Allowlist bei Signup), `layout.tsx` (Root, CSP-Nonce, Toaster), `page.tsx` (Redirect `/`→`/login`), `globals.css` (Tailwind+shadcn-Theme).

### `components/` — React-Komponenten (63 Dateien, 6.979 Zeilen)

Nur 1 Testdatei im gesamten Ordner (`interview/ChatInput.test.tsx`) — UI ist der am dünnsten getestete Teil der Codebase.

- **`ui/`** — 35 unveränderte shadcn/ui-Primitives (vendored, laut `CLAUDE.md` "nie neu implementieren").
- **`interview/`** (Mitarbeiter-Chat-UI): `ChatInterface.tsx` treibt `useInterviewStream`, zeigt Reconnect-Banner, pollt Status für Clarification/Completed-Übergänge. `ChatInput.tsx` verdrahtet `useVoiceInput`. `ClarificationView.tsx`/`ClarificationCards.tsx` — Nachfrage-Flow mit `localStorage`-Zwischenspeicherung. `MessageList.tsx`/`MessageBubble.tsx`/`MicButton.tsx` — Darstellung. `ChatCompletedScreen.tsx`/`ChatErrorScreen.tsx` — statische Terminal-Screens.
- **`interviews/`** (Berater-Verwaltung): `InterviewsClient.tsx` (Top-Level-Container, fetch+State), `InterviewsTable.tsx`/`InterviewRow.tsx`/`StatusBadge.tsx` (Tabelle), `NewInterviewDialog.tsx` (2-Schritt Formular→Link, größte Datei hier mit 337 Zeilen), `CopyLinkButton.tsx`/`DownloadPdfButton.tsx`/`DeleteInterviewButton.tsx` (Aktionen), `EmptyState.tsx`.
- **`pdf/InterviewReport.tsx`** — react-pdf `Document`/`Page`-Definition (Header, Executive Summary, Prozessschritte, Pain Points, Tools, Use Cases, Footer).
- **`dashboard/SidebarNav.tsx`** — Nav mit Active-Route-Highlighting.
- **Root-Widgets:** `ProcessStepsTable.tsx` (685 Zeilen, größte Nicht-shadcn-Komponente — Dept→Cluster-Gruppierung via `lib/processStepsAggregation`, Detail-Sheet mit Substep-Diagramm), `UseCaseBoardClient.tsx` (Board, 3 strategische Cluster via `services/useCaseEngine`), `UseCaseSheet.tsx` (397 Zeilen, Detail-Sheet, paralleler Fetch von Detail+Insights), `UseCaseCard.tsx`, `MetricsGrid.tsx`, `RoiBreakdown.tsx`, `ParticipantList.tsx`.

### `hooks/` — Custom React Hooks (6 Dateien, 1.293 Zeilen)

- `useVoiceInput.ts` (308 Zeilen) — vollständige ElevenLabs-Scribe-v2-Realtime-Pipeline: Mic-Permission → AudioWorklet/ScriptProcessor-Fallback → 16kHz-PCM-Resampling → WebSocket → Partial/Committed-Transkript → Auto-Token-Refresh vor 900s-Ablauf.
- `useInterviewStream.ts` (84 Zeilen) — Streaming-Fetch-State für `/chat`, `/reconnect`, `/start`; Abort bei neuem Call oder 90s-Timeout.
- `use-mobile.tsx` / `use-toast.ts` — vendored shadcn-Hooks (Breakpoint-Detection, Toast-State-Manager).

### `lib/` — Infrastruktur/Utilities (14 Dateien, 2.023 Zeilen)

- `supabase.ts`/`supabase-server.ts`/`supabase-admin.ts` — 3 Client-Konstruktoren (Browser/Server mit Cookie-Wiring/Service-Role mit RLS-Bypass, `server-only`).
- `database.types.ts` (409)/`supabase-types.ts` (626) — generierte DB-Typen, zwei parallele generierte Dateien.
- `llm-provider.ts` — `resolveModel()`: zentrales Modell-Routing `"provider/model"` → AI-SDK-Instanz für Anthropic/Google/Nebius/Fireworks (Produktion) + OpenRouter (Eval-only, mit HTTP/1.1-Workaround für H2-Stalls).
- `ratelimit.ts` — Upstash-Redis-Rate-Limiting, lazy-init, fail-open ohne Redis-Env-Vars.
- `langfuse.ts` — OTEL/Langfuse-Bootstrap inkl. eigenem `MetadataAttributeEnricher`-Span-Processor.
- `processStepsAggregation.ts` — reine Aggregations-Helper (Dept/Cluster-Gruppierung, Summary-Stats) für `ProcessStepsTable`.
- `utils.ts` — `cn()` (shadcn-Standard-Utility).
- `audio/pcm-worklet.ts` — AudioWorkletProcessor-Source-String für `useVoiceInput`.

### `schemas/prozessschritt-schema.json` (124 Zeilen)

JSON-Schema (draft-07), definiert die kanonische "Prozessschritt"-Form. Gesynctes Duplikat der SSoT `meridian-ma/schemas/prozessschritt-schema.json` (v1.2) — Kommentar im File: "SYNC REQUIRED when SSoT changes". Definitions-Library: `SlotString`/`SlotStringArray`/`SlotNumber` (Wert+Konfidenz+Nicht-Befund-Envelope), `Abhaengigkeiten`, `GovernanceSlot`, `Potenzial`, Top-Level `Schritt`-Objekt.

### `services/` — Business-/KI-Logik (134 Dateien, 23.690 Zeilen)

Der mit Abstand größte und komplexeste Teil der Codebase — siehe eigene Tiefenanalyse unten, da er allein so groß ist wie der Rest von `src/` zusammen.

#### `services/` (root, 24 Dateien) — Interview-Turn-Engine, Extraktion, Use-Case-Engine

**Dual-Loop-Interview-Kern:**
- `interviewAgent.ts` (762) — Tool-Definitionen (`register_step`, `record_slot`, ...) für Talker+Analyst, Step-Dedup/Normalisierung.
- `interviewAnalyst.ts` (734) — asynchrone Wissens-Extraktion (läuft via `after()`), ruft Tools auf, erzeugt Turn-Briefing, generiert keinen User-Text.
- `interviewTalker.ts` (345) — User-facing Turn-Generator; Buffer-then-stream (`generateText` statt `streamText`), damit der Grounding-Guard vor Auslieferung prüfen kann.
- `interviewOrchestrator.ts` (428) — reine Phasen-/Lifecycle-Logik (Phasenübergänge, fehlende Pflicht-Slots, Wrap-up-Entscheidung).
- `runInterviewTurn.ts` (576) — Deep-Module-Orchestrierungs-Naht (PROJ-33/ADR-016): load → orchestrate → talker-stream + Background-Analyst, identisch genutzt von Prod-Route und Eval-Runner via injizierte `ports`.
- `interviewQuickExtract.ts` (221) — synchrone Vor-Talker-Schnellextraktion (verhindert Re-Frage nach gerade genannten Werten).
- `interviewSemantic.ts` (628) — reine Typen/Utilities (Phase, Slot-Namen, Step-Gruppierung), server-only-frei für Eval-Replay/CI. Höchster interner Fan-in (11) — das gemeinsame semantische Fundament.
- `interviewTypes.ts` (71) — reine Interaktionstypen (`InterviewContext`, `TurnMessage`, `AnalystBriefing`).
- `talkerPrompt.ts` (493) — baut statischen + dynamischen Talker-System-Prompt.
- `conversationSignals.ts` (357) — 7 reine Konversations-Signal-Detektoren hinter `analyzeConversationSignals`.
- `talkerGroundingGuard.ts` (212) — Live-Per-Turn-Guard: klassifiziert/erzwingt Regeneration bei fabrizierten Talker-Callbacks (KI-18).
- `slotConflictResolver.ts` (35) — Writer-Prioritäts-Hierarchie (analyst_catchup > analyst_online > quick > backfill).
- `slotWriteTrail.ts` (126) — Observability-Emitter für Slot-Write-Events (nie werfend).
- `stepIdentity.ts` (75) — Embedding-basierte (Jina v3) Duplikat-Step-Erkennung, degradiert ohne `JINA_API_KEY`.

**Extraktion/Anreicherung/Clustering:**
- `extraction.ts` (260) — LLM-Extraktion Pain Points/Tools aus Transkript → `knowledge_objects`. Wird sowohl inline aus `runInterviewTurn` als auch eigenständig von 4 API-Routen + allen `turnStore/`-Adaptern importiert — echter Kopplungspunkt zwischen Interview-Engine und Extraktions-Pipeline.
- `processEnrichment.ts` (229) — Post-Interview-Enrichment: Slot-Coercion-Netz, Embedding-Generierung für Steps.
- `processClustering.ts` (305) — Cosine-Similarity-Clustering von Prozessschritten über Interviews hinweg.
- `embeddings.ts` (36) — dünner Jina-Embeddings-Wrapper (direkter fetch wegen AI-SDK-Schema-Inkompatibilität).

**Use-Case-Engine (empirisch komplett isoliert, 0 interne Kanten zu anderen Root-Services-Dateien):**
- `useCaseEngine.ts` (746) — reine, LLM-freie Heuristik-Engine (Regeln R1–R8/P1–P4/C1–C3).
- `useCaseInsights.ts` (106) — LLM-generierte narrative Insights auf Basis der Heuristik-Scores.

**Reporting & Querschnitt:**
- `reportGenerator.ts` (119) — LLM-Executive-Summary für den PDF-Report.
- `substepGenerator.ts` (72) — LLM-Zerlegung eines Prozessschritts in Substeps.
- `schemaValidator.ts` (22) — AJV-Validator gegen `prozessschritt-schema.json`, geteilt zwischen Prod und Eval-Scorern.
- `_telemetry.ts` (39) — `TraceCtx`/`buildTraceMetadata`, in praktisch jedem LLM-aufrufenden Modul verdrahtet (höchster Cross-File-Fan-in nach `interviewSemantic`/`interviewTypes`: 8).

#### `services/turnStore/` (9 Dateien) — Persistenz-Port + Adapter (PROJ-34/ADR-018)

- `port.ts` (211) — `TurnStore`-Contract (`openTurn`→Snapshot, `stage`→Intent anwenden, `commit`→persistieren).
- `intents.ts` (238) — `WriteIntent`-Vokabular; die 8 Wissens-Tools liefern Intents statt direkt zu schreiben.
- `applyIntent.ts` (478) — reiner Konflikt-/Apply-Kern hinter `stage()`, wortgetreu aus der Legacy-`interviewAgent.ts`-Logik übernommen (Verhaltens-Neutralität).
- `supabaseTurnStore.ts` (220) — Produktions-Adapter (server-only, RPC/`.update()`).
- `pgliteTurnStore.ts` (341) — Eval-Adapter: lokales In-Process-Postgres (PGlite/WASM), lädt echte Migrationen, stubbt Supabase-only-Konstrukte.
- `memoryTurnStore.ts` (98) — In-Memory-Test-Double, nicht in Prod/Eval genutzt.

#### `services/__evals__/interview/` (82 Dateien) — Eval-Harness

Der elaborierteste Teil der Codebase.

- `runner.ts` (1.287, größte Datei in `src/`) — Haupt-CLI-Einstiegspunkt (`npm run eval:interview`); Single-Runs, Modell-Matrizen, Multi-Run mit Seeds, isolierte Kriterien, Auto-Langfuse.
- `evalStore.ts` (381) — Runner-Persistenz-Naht, Supabase- oder PGlite-Backend.
- `compare.ts` (287) — A/B-Vergleich zweier Eval-Runs, scannt `docs/evals/interview/**/*.md`.
- `perturbation.ts` (122) — geseedete Persona-Perturbation (Feld-Shuffle + LLM-Paraphrase).
- `paraphrase-test.ts` (246) — Robustheits-Test über Original + 3 paraphrasierte Transkripte.
- `pricingCheck.ts` (76) — druckt aufgelöste `MODEL_PRICING` vor Lauf-Start.
- **`personas/`** (6 Dateien) — `buchhalter.ts`/`it-support.ts`/`vertriebler.ts` (synthetische Personas), `disclosure.ts` (Offenheits-Faktor), `loadPersona.ts` (lazy Map), `types.ts`.
- **`replay/`** (4 Dateien) — `runReplay.ts` (239, Frozen-Transcript-Replay gegen Fixtures, offline), `parseEvalMd.ts` (139, parst Eval-Markdown zu Fixtures), `types.ts`.
- **`scorers/`** (~24 Dateien) — ein File pro Metrik: `hallucinationRate.ts`, `slotCoverage.ts`, `slotDepth.ts`, `dialogNaturalness.ts` (LLM-as-Judge, Cross-Vendor), `talkerFactualGrounding.ts`, `conversationalEfficiency.ts`, `dependencyCapture.ts`, `potenzialCoverage.ts`, `costSummary.ts`, `toolCallPlausibility.ts`, `textOverlap.ts`, `anchoringViolations.ts`, `confidenceTrigger.ts`, `completionCorrectness.ts`, `schemaConformanceRate.ts`, `stepRegistrationCoverage.ts`, `phaseAdherence.ts`, `types.ts`, `index.ts` (Barrel), `depth-rubric.md` (einziges Nicht-Fixture-Markdown in `src/`). Höchste interne Kohäsion aller Eval-Unterordner (29 interne Kanten).
- **`validation/`** (6 Dateien) — `judgeCalibration.ts` (539), `testerStability.ts` (449), `selectCalibrationSample.ts` (263).
- **`__fixtures__/`** (25 Dateien) — gefrorene Transkript-/Baseline-JSON für 6 UUID-Runs + Paraphrase-Varianten + Depth-Falsification-Set.

### `test/setup.ts` (1 Zeile) + `middleware.ts` (81, +test) + `instrumentation.ts` (8)

- `middleware.ts` — Auth-Gate (Redirect zu `/login` bzw. 401-JSON für `/api/*`) + CSP-Nonce-Generierung für alle Routen außer `PUBLIC_ROUTES`.
- `instrumentation.ts` — Next.js-Hook, startet `initLangfuse()` einmalig beim Serverstart (nur `nodejs`-Runtime).
- `test/setup.ts` — Vitest/RTL Global-Setup (`@testing-library/jest-dom`).

---

## Test-Abdeckung — Zusammenfassung

| Ordner | Testabdeckung |
|---|---|
| `app/api/` | dicht — 18/24 Routen haben eine Testdatei |
| `services/` (root + turnStore) | dicht — Kernlogik durchgehend getestet, inkl. 2 Testdateien ohne Source-Pendant (`stepRevisionIntegrity.test.ts`, `slotWriteRace.test.ts`) für Cross-Cutting-Regressionen |
| `services/__evals__/` | gemischt — Scorer/Personas/TurnStore-Adapter getestet, `runner.ts`/`compare.ts`/`pricingCheck.ts` selbst nicht (sind CLI-Einstiegspunkte, verifiziert über echte Eval-Läufe statt Unit-Tests) |
| `hooks/` | vollständig (2/2 nicht-vendored Hooks) |
| `lib/` | teilweise — `llm-provider.ts`, `ratelimit.ts`, `processStepsAggregation.ts` getestet; Supabase-Client-Wrapper, generierte Typen, `langfuse.ts`, `utils.ts`, `audio/` ungetestet |
| `components/` | dünn — nur 1 von 63 Dateien (`ChatInput.test.tsx`) |
| `app/` (Pages/Layouts/Actions) | ungetestet |

---

## Nächster Schritt

Cluster-Vorschlag (Schritt 2 der vereinbarten Methodik) auf Basis dieses Inventars + eines empirischen Import-Graphen (`madge` über `src/`, tsconfig-Pfad-Alias-aufgelöst) — wird separat zur Diskussion vorgelegt, bevor der C4-Doku-Baum (Level 1–4) entsteht.
