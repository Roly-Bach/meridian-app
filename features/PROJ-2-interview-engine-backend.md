# PROJ-2: Interview Engine Backend

## Status: In Progress
**Created:** 2026-05-19
**Last Updated:** 2026-05-20

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
- [ ] `POST /api/interviews` — erfordert Berater-Session (server-client), erstellt Interview mit `employee_name`, `employee_role`, `department`, `focus_topics`
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
- [ ] Agent kennt beim ersten Turn: `employee_name`, `employee_role`, `department`, `focus_topics` aus dem Interview-Record
- [ ] Agent startet in Phase `intro` und wechselt autonom basierend auf Gesprächsfortschritt
- [ ] Phasenreihenfolge: `intro` → `exploration` → `deepdive` → `wrap_up`
- [ ] Ab 50 Minuten (`timer_minutes >= 50`) drängt der Agent aktiv zu `wrap_up`
- [ ] 60 Minuten (`timer_minutes >= 60`) ist das Hard Limit — Agent erzwingt `wrap_up` unabhängig vom Stand
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
| `timer_minutes` erreicht 60 | Agent erzwingt Übergang zu `wrap_up` und schließt Interview ab |
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
_To be added by /qa_

## Deployment
_To be added by /deploy_
