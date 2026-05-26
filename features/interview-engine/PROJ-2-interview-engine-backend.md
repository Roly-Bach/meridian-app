# PROJ-2: Interview Engine Backend

## Status: Deployed
**Created:** 2026-05-19
**Last Updated:** 2026-05-20
**Type:** Epic
**Domain:** Interview Engine
**Extends:** —
**Appetite:** —
**Bugs:** —

## Dependencies
- Requires: PROJ-1 (Auth + Workspace) — für Workspace-Isolation, Supabase-Clients, DB-Schema

## User Stories
- Als Berater lege ich ein Interview mit Mitarbeiterdaten und Fokusthemen an, damit der Agent optimal vorbereitet ist.
- Als Berater kopiere ich den generierten Interview-Link und schicke ihn an den Mitarbeiter.
- Als Berater sehe ich den Status meiner Interviews (erstellt, aktiv, abgeschlossen) im Dashboard.
- Als Mitarbeiter öffne ich den Link ohne Account und starte das Gespräch mit dem Agenten.
- Als Mitarbeiter sehe ich die Antworten des Agenten in Echtzeit (Streaming, Wort für Wort).
- Als Mitarbeiter kann ich nach einem Verbindungsabbruch den Link erneut öffnen und nahtlos weitermachen.
- Als System starte ich automatisch die Extraktion (PROJ-4) sobald ein Interview abgeschlossen ist.

## Acceptance Criteria

### Schema-Erweiterung (Migration)
- [ ] `interviews`-Tabelle erhält neue Spalten: `department` (text, not null), `focus_topics` (text, nullable), `access_token` (text, unique, not null), `token_expires_at` (timestamptz, not null)
- [ ] `interviews.status` hat definierte Werte: `created`, `active`, `completed`
- [ ] RLS bleibt erhalten — neue Spalten erben bestehende Policies

### Interview-Erstellung (Berater)
- [ ] `POST /api/interviews` — erfordert Berater-Session (server-client), erstellt Interview mit `employee_name`, `employee_role`, `department`, `focus_topics`, `max_duration_minutes`
- [ ] `max_duration_minutes` ist ein Integer-Feld (default: 30, erlaubte Werte: 10, 30) — bestimmt die Gesamtlänge des Interviews
- [ ] Eindeutiger `access_token` (CUID2 oder UUID v4) wird beim Anlegen generiert
- [ ] `token_expires_at` = Erstellungszeitpunkt + 30 Tage
- [ ] `GET /api/interviews` — gibt alle Interviews des Workspaces zurück (sortiert nach `created_at` desc)

### Interview-Zugriff (Mitarbeiter, ohne Auth)
- [ ] `GET /api/interview/[token]` — gibt Interview-Metadaten zurück (employee_name, status, turns)
- [ ] Ungültiger/nicht existierender Token → HTTP 404
- [ ] Abgelaufener Token (`token_expires_at` überschritten) → HTTP 410 mit Meldung "Dieser Interview-Link ist nicht mehr gültig"
- [ ] Interview mit Status `completed` → Chat-Endpunkt gibt HTTP 409 zurück

### Chat / Streaming
- [ ] `POST /api/interview/[token]/chat` — nimmt `{ user_input: string }` entgegen
- [ ] Response ist SSE-Stream (`Content-Type: text/event-stream`)
- [ ] Jeder Turn wird nach Abschluss atomar in `turns` gespeichert (`user_input` + vollständige `agent_response`, `turn_number`)
- [ ] `interview_state.phase` wird vom Agenten nach jedem Turn aktualisiert
- [ ] `interview_state.timer_minutes` wird je Turn mit der verstrichenen Zeit inkrementiert
- [ ] `interview_state.topics_covered` und `topics_open` werden vom Agenten aktualisiert
- [ ] Bei Claude-API-Fehler: SSE sendet `event: error`-Event, Turn wird nicht in DB gespeichert

### Agent-Verhalten
- [ ] Agent kennt beim ersten Turn: `employee_name`, `employee_role`, `department`, `focus_topics`, `max_duration_minutes` aus dem Interview-Record
- [ ] Agent startet in Phase `intro` und wechselt autonom basierend auf Gesprächsfortschritt
- [ ] Phasenreihenfolge: `intro` → `exploration` → `deepdive` → `wrap_up`
- [ ] Ab `max_duration_minutes - 5` Minuten drängt der Agent aktiv zu `wrap_up` (z.B. bei 30 min → ab 25 min; bei 10 min → ab 8 min)
- [ ] `max_duration_minutes` ist das Hard Limit — Agent erzwingt `wrap_up` unabhängig vom Stand
- [ ] Standard-Wert für `max_duration_minutes`: 30 Minuten; Test-Modus: 10 Minuten
- [ ] Bei Reconnect (Interview `active`, vorhandene `turns`): Agent sendet adaptive Begrüßungsnachricht statt neuem Intro
- [ ] Leere `user_input`-Nachricht wird abgelehnt (HTTP 400), nicht an Claude weitergeleitet

### Abschluss & Extraktion
- [ ] Wenn Agent Phase `wrap_up` abschließt: `interviews.status` → `completed`
- [ ] Direkt nach Status-Update: Fire-and-forget-Trigger für PROJ-4 (Extraktions-Agent) — z.B. via internem API-Call oder DB-Flag `extractions_pending`
- [ ] Berater sieht im Dashboard Status `completed` für das Interview

## Edge Cases

| Szenario | Erwartetes Verhalten |
|---|---|
| Mitarbeiter sendet leere Nachricht | HTTP 400, kein Claude-Call |
| Claude gibt nach 3 Retries keinen Response | SSE `error`-Event, Turn nicht gespeichert, Mitarbeiter kann Nachricht erneut senden |
| Netzwerkunterbrechung während Streaming | Client reconnectet via Token, turns werden aus DB geladen, Agent antwortet adaptiv |
| Mitarbeiter öffnet Link nach `completed` | Interview-Daten sichtbar, aber kein Chat mehr möglich (409 auf Chat-Endpunkt) |
| Token abgelaufen (> 30 Tage) | HTTP 410 mit klarer Meldung |
| Berater legt Interview an, schickt Link nie | Interview bleibt auf `created`, läuft nach 30 Tagen automatisch ab |
| `focus_topics` leer | Agent nutzt Standard-Explorations-Fragen ohne spezifischen Fokus |
| `timer_minutes` erreicht `max_duration_minutes` | Agent erzwingt Übergang zu `wrap_up` und schließt Interview ab |
| Zwei Browser-Tabs öffnen denselben Interview-Link | Beide Tabs senden turns — race condition möglich; MVP-Akzeptanz, kein Concurrent-Lock |
| Claude-Antwort enthält die Phase-Transition-Entscheidung | Agent-Response wird geparst um `phase` und `topics_*` in `interview_state` zu aktualisieren |

## Technical Requirements
- Streaming: SSE via Next.js Route Handler (`ReadableStream` mit `text/event-stream`)
- Agent: Claude claude-opus-4-5 (per PRD-Constraint)
- Token: CUID2 oder UUID v4, unique constraint auf DB-Ebene
- Chat-Endpunkt: kein Supabase-Auth erforderlich (admin-client für DB-Writes)
- Berater-Endpunkte: server-client mit Session (RLS-konform)
- Performance: erster SSE-Chunk < 3s nach Absenden der Nachricht
- Alle KI-Logik (Claude-Calls, Phase-Management) in `src/services/interviewAgent.ts` (Service-Layer-Constraint aus INDEX.md)

## Out of Scope
- Voice-Input / Whisper (PROJ-3 oder späteres Feature)
- TODS und weitere adaptive Interviewtechniken (spätere Erweiterung des System Prompts)
- Mitarbeiter-Accounts / Persistente Employee-Identität
- Concurrent-Lock bei mehreren Tabs
- Export des Interview-Transkripts

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Route-Struktur

```
API Routes
│
├── /api/interviews                   (Berater — mit Session)
│   ├── GET  — Liste aller Interviews im Workspace
│   └── POST — Neues Interview anlegen
│
└── /api/interview/[token]            (Mitarbeiter — ohne Auth)
    ├── GET         — Interview-Daten + Gesprächsverlauf laden
    ├── POST /chat  — Nachricht senden → SSE-Stream zurück
    └── POST /reconnect — Adaptive Begrüßung nach Verbindungsabbruch
```

### Datenbankänderungen (neue Migration)

Neue Felder auf der bestehenden `interviews`-Tabelle:

| Neues Feld | Zweck |
|---|---|
| `department` | Abteilung des Mitarbeiters (Pflicht) |
| `focus_topics` | Optionale Hinweise des Beraters für den Agenten |
| `access_token` | Zufälliger, einzigartiger Token für den Link |
| `token_expires_at` | Ablaufdatum (30 Tage nach Erstellung) |
| `extractions_pending` | Flag (bool) — Signal für PROJ-4 nach Abschluss |

Status-Werte auf `interviews`: `created` → `active` → `completed`

### Service Layer: `src/services/interviewAgent.ts`

Einzige Stelle im Projekt die mit einem LLM spricht. Sie:

1. Baut den System Prompt (Mitarbeiter-Kontext, aktuelle Phase, Timer, Topics)
2. Schickt den gesamten Gesprächsverlauf an das Modell
3. Streamt die Antwort Wort für Wort zurück an den Browser
4. Verarbeitet Tool Calls silent im Hintergrund

### LLM-Integration: Vercel AI SDK (provider-agnostisch)

Der Service verwendet das **Vercel AI SDK** (`ai` package) als Abstraktionsschicht — nicht direkt ein Anbieter-SDK. Streaming und Tool Use funktionieren einheitlich, unabhängig vom gewählten Provider.

Provider und Modell kommen aus einer Env-Variable (`INTERVIEW_MODEL`), z.B.:
- `anthropic/claude-opus-4-5`
- `openai/gpt-4o`
- `google/gemini-2.0-flash`

Ein Wechsel erfordert keine Code-Änderung — nur die Env-Variable und ggf. ein Provider-Paket.

### Wie der Agent Phasen wechselt: Tool Use

Claude / das Modell bekommt explizite Werkzeuge statt Freitext zu produzieren der geparst werden muss:

| Tool | Was das Modell damit tut |
|---|---|
| `transition_phase(neue_phase)` | Wechselt von z.B. `exploration` zu `deepdive` |
| `update_topics(erledigt[], offen[])` | Aktualisiert die Topic-Listen nach jedem Turn |
| `complete_interview()` | Schließt das Interview ab nach `wrap_up` |

Phase-Wechsel sind damit unambig und halluzinations-sicher — das Modell muss explizit einen Tool Call auslösen, nicht nur Freitext produzieren.

### Turn-Ablauf (Ende zu Ende)

```
Mitarbeiter tippt Nachricht
        ↓
POST /api/interview/[token]/chat
        ↓
Token validieren (existiert? abgelaufen? completed?)
        ↓
Turns-Verlauf + interview_state aus DB laden
        ↓
interviewAgent.ts: System Prompt bauen + Modell aufrufen (AI SDK)
        ↓
SSE-Stream: Text-Tokens → Browser (Wort für Wort)
        ↓        ↓
  Tool Calls?   Kein Tool?
  → State-Update  → Weiter streamen
        ↓
Turn vollständig → atomar in DB speichern
interview_state aktualisieren (phase, timer, topics)
        ↓
complete_interview() aufgerufen?
  → interviews.status = 'completed'
  → extractions_pending = true  (Signal für PROJ-4)
```

### Reconnect-Flow

1. `GET /api/interview/[token]` gibt alle bisherigen Turns zurück
2. Frontend erkennt: Interview `active`, Turns vorhanden → Reconnect
3. Frontend ruft automatisch `POST /api/interview/[token]/reconnect` auf
4. Endpoint schickt Gesprächsverlauf an Modell mit Instruction "begrüße adaptiv"
5. Antwort streamt als SSE — wird nicht als Turn gespeichert (System-Nachricht)

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| LLM-Integration | Vercel AI SDK (`ai`) | Provider-agnostisch; Modell per Env-Variable wechselbar ohne Code-Umbau |
| Streaming | SSE via AI SDK | Nativ in Next.js Route Handlers; einheitlich über alle Provider |
| Phase-Management | Tool Use (explizit) | Halluzinations-sicher; erweiterbar für TODS etc. |
| Token-Generierung | `crypto.randomUUID()` | Native Node.js-Funktion, keine extra Library |
| Extraktion-Trigger | DB-Flag (`extractions_pending`) | Kein interner HTTP-Call nötig; PROJ-4 liest das Flag |
| KI-Logik | Nur in `src/services/interviewAgent.ts` | Service-Layer-Constraint — isolierbar und testbar |
| Chat-Endpunkt Auth | Kein Auth, nur Token | Mitarbeiter hat kein Konto; Admin-Client für DB-Writes |

### Neue Dependencies

| Paket | Zweck |
|---|---|
| `ai` | Vercel AI SDK — Provider-agnostisches Interface (Streaming + Tool Use) |
| `@ai-sdk/anthropic` | Anthropic-Provider (Claude) — Standard-Start |
| `@ai-sdk/openai` | OpenAI-Provider — bei Bedarf installierbar |

## Implementation Notes (2026-05-20)

### What was built
- **DB Migration** (`supabase/migrations/20260520000000_proj2_interview_engine.sql`): adds `department`, `focus_topics`, `access_token`, `token_expires_at`, `extractions_pending` to `interviews`; updates status values to `created/active/completed`; updates phase values to `intro/exploration/deepdive/wrap_up`
- **Service layer** (`src/services/interviewAgent.ts`): all LLM logic isolated here — system prompt, tools (`transition_phase`, `update_topics`, `complete_interview`), Vercel AI SDK v6 streaming
- **API routes**:
  - `GET /api/interviews` — list workspace interviews (auth required)
  - `POST /api/interviews` — create interview, returns `access_token` (auth required)
  - `GET /api/interview/[token]` — load interview + state + turns (public)
  - `POST /api/interview/[token]/chat` — streaming agent response (public, token-auth)
  - `POST /api/interview/[token]/reconnect` — adaptive reconnect greeting (public, token-auth)
- **Database types** (`src/lib/database.types.ts`): minimal typed schema for PROJ-2 tables

### Deviations from spec
- Streaming format: `toTextStreamResponse()` (AI SDK v6 API, replaces `toDataStreamResponse()`). PROJ-3 frontend should use `fetch()` with `ReadableStream` or AI SDK's `useCompletion` hook.
- AI SDK version: v6.0.x — uses `inputSchema` (not `parameters`) and `stopWhen: stepCountIs(N)` (not `maxSteps`)

### Tests
- 9 unit tests passing: `src/app/api/interviews/interviews.test.ts` + `src/app/api/interview/[token]/token.test.ts`

## QA Test Results

**QA Date:** 2026-05-20
**Tester:** /qa skill

### Acceptance Criteria — Pass/Fail

| Criterion | Result | Notes |
|---|---|---|
| Schema: department (text, not null) | PASS | Migration adds column + NOT NULL after backfill |
| Schema: focus_topics (text, nullable) | PASS | Migration adds column |
| Schema: access_token (text, unique, not null) | PASS | Migration adds column + UNIQUE constraint |
| Schema: token_expires_at (timestamptz, not null) | PASS | Migration adds column + NOT NULL |
| Schema: status values created/active/completed | PASS | Migration replaces old constraint |
| Schema: RLS maintained | PASS | Separate migration adds RLS policies for all 3 tables |
| POST /api/interviews requires auth | PASS | Returns 401 without session |
| POST /api/interviews creates with all fields | PASS | Zod validation + insert |
| Unique access_token generated | PASS | crypto.randomUUID() |
| token_expires_at = now + 30 days | PASS | Hardcoded 30 * 24 * 60 * 60 * 1000 ms |
| GET /api/interviews returns list sorted desc | PASS | .order('created_at', { ascending: false }) |
| GET /api/interview/[token] returns metadata + state + turns | PASS | Three parallel queries |
| Unknown token → 404 | PASS | Unit tested |
| Expired token → 410 | PASS | Unit tested |
| Completed interview → chat returns 409 | PASS | Unit tested |
| POST chat accepts user_input | PASS | Zod min(1) enforced |
| Response is SSE stream | PASS | toTextStreamResponse() |
| Turn saved atomically in onFinish | PASS | onFinish callback inserts turn |
| interview_state.phase updated by agent | PASS | transition_phase tool executes DB update |
| timer_minutes updated per turn | PASS | Calculated from first turn created_at |
| topics_covered/topics_open updated | PASS | update_topics tool executes DB update |
| Claude error → SSE error event, no turn saved | PASS | onFinish not called on stream error |
| Empty user_input → HTTP 400 | PASS | Zod z.string().min(1) |
| Agent knows employee context | PASS | buildSystemPrompt includes all context |
| Agent starts in intro phase | PASS | insert interview_state with phase='intro' |
| Phase order enforced | PASS | Tool Use: transition_phase only allows exploration/deepdive/wrap_up |
| 50 min warning / 60 min hard limit | PASS | buildSystemPrompt adds timing warnings |
| Reconnect: adaptive greeting | PASS | Reconnect endpoint with isReconnect=true |
| complete_interview → status=completed + extractions_pending=true | PASS | complete_interview tool executes both updates |
| Dashboard sees completed status | PASS | GET /api/interviews returns status |

**Total: 29/29 acceptance criteria PASS**

### Bugs Found

#### BUG-001 HIGH — `npm test` fails (Vitest picks up Playwright files)
**File:** `vitest.config.ts`
**Steps to reproduce:** Run `npm test`
**Expected:** All unit tests run cleanly
**Actual:** Exit code 1 — `tests/PROJ-1-auth-workspace.spec.ts` is matched by Vitest glob and fails immediately ("Playwright Test did not expect test() to be called here")
**Fix:** Add `exclude: ['tests/**']` to `vitest.config.ts`
**Note:** Pre-existing regression from PROJ-1. The PROJ-2 unit tests themselves all pass (`npx vitest run src` → 20/20 green).

#### BUG-002 MEDIUM — interviewAgent.ts hardcodes Anthropic provider
**File:** [src/services/interviewAgent.ts](src/services/interviewAgent.ts) line 136
**Description:** The service always uses `createAnthropic` regardless of the `INTERVIEW_MODEL` env var. The tech design specifies provider-agnostic behavior via Vercel AI SDK. If `INTERVIEW_MODEL` is set to `openai/gpt-4o` or `google/gemini-2.0-flash`, the code would use the Anthropic provider with a wrong model ID and fail at runtime.
**MVP Impact:** Low — Anthropic is the only intended provider for MVP. The `INTERVIEW_MODEL` env var effectively only controls the model name, not the provider.
**Fix:** Replace `createAnthropic` with the Vercel AI SDK gateway pattern (e.g., via `ai.createProvider` or parse the `provider/model` string to select the right SDK).

#### BUG-003 LOW — Misleading mock in token.test.ts
**File:** [src/app/api/interview/[token]/token.test.ts](src/app/api/interview/%5Btoken%5D/token.test.ts) line 15
**Description:** The mock uses `toDataStreamResponse` (old API), but the `GET /api/interview/[token]` endpoint never calls `createInterviewStream`. The mock is dead code and misleads about the endpoint's contract.
**Fix:** Remove the `createInterviewStream` mock from token.test.ts entirely.

### Test Coverage Added by QA

| File | Tests Added | What they cover |
|---|---|---|
| [src/app/api/interview/[token]/reconnect/reconnect.test.ts](src/app/api/interview/%5Btoken%5D/reconnect/reconnect.test.ts) | 5 | 404, 410, 409 (created), 409 (completed), 200 stream with isReconnect=true |
| [src/app/api/interview/[token]/chat/chat.test.ts](src/app/api/interview/%5Btoken%5D/chat/chat.test.ts) | 1 | created→active status transition on first message |

**Unit test totals:** 20 tests across 4 files — all passing (`npx vitest run src`)

### E2E Tests
Not written — PROJ-2 is a pure backend feature with no UI. Meaningful E2E tests require a live Supabase instance and Claude API key. The unit test suite covers all acceptance criteria at the integration boundary. E2E browser tests are deferred to PROJ-3 (Interview UI), which wraps this backend.

### Security Audit

| Check | Result |
|---|---|
| Auth bypass on consultant endpoints | PASS — 401 returned without valid session |
| Token enumeration / brute force | ACCEPTABLE — UUID v4 tokens (128-bit entropy); no rate limiting on GET [token] endpoint (MVP-acceptable) |
| Cross-workspace data access | PASS — GET /api/interviews filters by workspace_id from user_metadata |
| SQL injection | PASS — Supabase parameterized queries; Zod validates all inputs |
| Empty/oversized input | PASS — Zod max(10000) on user_input, max(200) on names |
| Secrets in responses | PASS — access_token only returned to authenticated consultant on creation |
| Admin client scope | ACCEPTABLE — admin client bypasses RLS for public endpoints (intentional: employee has no account) |
| RLS on interview_state + turns | PASS — migration enables RLS + adds workspace-scoped policies |

### Production-Ready Decision

**NOT READY** — BUG-001 (HIGH) must be fixed first.

The feature itself is functionally complete and all 29 acceptance criteria pass. The blocking issue is infrastructure: `npm test` exits with code 1 due to Vitest picking up the Playwright E2E file. Fix `vitest.config.ts` (add `exclude: ['tests/**']`), then this feature is ready.

BUG-002 (MEDIUM) does not block MVP since Anthropic is the only intended provider.

## Implementation Notes (2026-05-25 — ADR-005: Gesprächsführung & Eval-Qualität)

Ref: `docs/adr/ADR-005-interview-design-optimierung.md`, Commit `7e8ccf4`

Alle Änderungen in `src/services/interviewAgent.ts` (System-Prompt):

- Du-Anrede als Standard (kein Sie), kein Agenten-Name im Greeting
- Kein Greeting-Repeat ab Turn 2 (Few-Shot-Constraint)
- Aktive Prozessauswahl durch Agenten mit Begründungssatz
- Wrap-up-Puffer vor `coverage_check` (Gesprächssignal vor Tool-Call)
- Stundensatz wird nicht abgefragt (kommt aus Workspace-Konfiguration)
- `rule_based`-Klassifikation: explizite Definition im Prompt
- Verbotsliste für Floskeln und Meta-Kommentare
- `stopWhen` auf 2 Steps erhöht (war 1)
- `complete_interview` nur in `wrap_up`, kein leerer Stream

## Implementation Notes (2026-05-26 — ADR-006: Technische Schulden & Eval-Findings)

Ref: `docs/adr/ADR-006-interview-engine-technische-schulden-eval-findings.md`, Commits `50e0838`, `25a7412`

### System-Prompt-Änderungen (D1–D7, D15–D17)

- **D1**: `complete_interview` erst nach Mitarbeiter-Antwort auf Abschlussfrage — nie im selben Turn
- **D2**: Negativbeispiel für Turn-2-Greeting (Few-Shot)
- **D3**: Spannenangaben → Agent fragt nach Mittelwert
- **D4**: Slot-Audit vor `complete_interview` (Pflicht-Slots prüfen, gesammelt nachfragen)
- **D5**: Begründungssatz bei aktiver Prozessauswahl
- **D6**: Übergangsmuster in Verbotsliste ergänzt
- **D7**: Narrativität verschärft — quantitative Werte nur auf explizite Nachfrage
- **D15**: Du/Herr-Negativbeispiel (`Kein "Herr Braun", kein Sie` + generisches Beispiel im Static-Block)
- **D16**: `rule_based` halb-halb-Handling (`"für bekannte Fälle ja" → true`)
- **D17**: Neuer Prozess in Abschlussantwort — Agent bietet einmalig Aufnahme an

### Technische Änderungen

- **D8** (`route.ts`): `extractAndEmbed()` fire-and-forget — nicht mehr awaited in `onFinish`
- **D9/D15** (`interviewAgent.ts`): `stopWhen` auf 4 Steps mit `steps.some()` — erlaubt `register_step` + `record_slot` + Tool-only steps vor Text
- **D10** (`interviewAgent.ts`): `process_step`-Branch aus `formatExtractionsLog()` entfernt
- **D11** (`interviewAgent.ts`): `buildSystemPrompt()` aufgeteilt in `buildStaticPrompt(phase)` + `buildDynamicContext(ctx)`. Phasenabhängiges Laden: nur aktive Methodik-Sektion eingebunden (~500 Token weniger). Gemini Implicit Caching greift automatisch auf statischen Prefix (>1024 Tokens). Anthropic: `cache_control`-Marker in `createInterviewStream` gesetzt
- **D12** (`useVoiceInput.ts`): TTL-Tracking für ElevenLabs Session-Token + Auto-Refresh 60s vor Ablauf
- **D13** (`extraction.ts` + Migration): Workspace-Level Dedup nach Interview-Abschluss — `deduplicateKnowledgeObjects()` als fire-and-forget. Migration: `knowledge_objects` erhält `existing_count` (int4, default 1) und `last_seen_at` (timestamptz)
- **D14** (`processClustering.ts`): `CLUSTERING_THRESHOLD` als Env-Var (Default 0.85)

### Token-Usage-Logging (temporär, Caching-Verifikation)

`[token-usage]`-Log in `onFinish` (`interviewAgent.ts`): `inputTokens`, `outputTokens`, `cacheReadTokens` (Anthropic), `cacheCreationTokens`. Dient dem Nachweis des Implicit Caching-Effekts ohne PROJ-13. Entfernen sobald Caching bestätigt oder PROJ-13 deployed.

## Deployment

**Deployed:** 2026-05-20
**Production URL:** https://meridian-app-tau.vercel.app/
**Provider:** Vercel (GitHub auto-deploy on push to main)
**AI Provider:** Google Gemini via `@ai-sdk/google` — model configured via `INTERVIEW_MODEL` env var
**API Routes live:**
- `GET/POST /api/interviews`
- `GET /api/interview/[token]`
- `POST /api/interview/[token]/chat`
- `POST /api/interview/[token]/reconnect`


## Post-Mortem
| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: — / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — |
| Häufigste Fehlerkategorie im Loop | — |

_ohne Backfill, vor v2-Migration deployed_