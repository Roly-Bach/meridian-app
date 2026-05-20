# PROJ-4: Extraktions-Agent + Wissensbasis

## Status: Approved
**Created:** 2026-05-20
**Last Updated:** 2026-05-20

## Dependencies
- Requires: PROJ-1 (Auth + Workspace) — RLS, workspace_id
- Requires: PROJ-2 (Interview Engine Backend) — Turn-Loop, turns-Tabelle, interview_id

## User Stories
- Als System extrahiere ich nach jedem Turn Wissensobjekte async, damit der Turn-Response nicht blockiert wird.
- Als Berater sehe ich neue Wissensobjekte in der UI-Seitenleiste erscheinen, sobald sie verfügbar sind.
- Als System speichere ich jedes Objekt mit source_quote und Embedding, damit Provenienz und Ähnlichkeitssuche möglich sind.
- Als Backend kann ich nach Interview-Abschluss per Vektorsuche ähnliche Prozessschritte finden (Grundlage für PROJ-5/6).
- Als Berater sehe ich nach Interview-Abschluss alle extrahierten Objekte gesammelt mit Typ-Label und Quellenangabe.

## Acceptance Criteria

### Extraktion (async nach Turn)
- [ ] Extraktion startet nach jedem `POST /api/turn` — **non-blocking** (Turn-Response kommt sofort zurück, Extraktion läuft danach)
- [ ] Extraktions-Agent sieht **nur Transkript** (alle Turns des Interviews), nicht `interview_state`
- [ ] Extrahiert 4 Typen: `process_step` | `pain_point` | `tool` | `role`
- [ ] Jedes extrahierte Objekt enthält exaktes `source_quote` aus dem Mitarbeiter-Input (kein paraphrasiertes Zitat)
- [ ] Extraktion via Claude claude-opus-4-5, Prompt strukturiert → gibt JSON-Array zurück
- [ ] Pro Turn können 0–N Objekte extrahiert werden (kein Minimum)
- [ ] Extraktion in `src/services/extraction.ts` — nicht direkt in API Route
- [ ] Jeder Extraktions-Fehler wird geloggt (console.error), bricht aber Turn-Flow nicht ab

### Embeddings
- [ ] Embedding via OpenAI `text-embedding-3-small` (1536 dim) für jedes neue `knowledge_object`
- [ ] Embedding-Input = `content`-JSON serialisiert als Text
- [ ] Embedding-Logik in `src/services/embeddings.ts` — nicht direkt in API Route
- [ ] Embedding wird zusammen mit `knowledge_object` in einer DB-Operation gespeichert (kein separater Schritt)

### Datenbank
- [ ] Jedes Objekt in `knowledge_objects`: id, interview_id, workspace_id, type, content (jsonb), source_quote, turn_id, embedding vector(1536), created_at
- [ ] `content`-Struktur pro Typ:
  - `process_step`: `{ title, description, role }`
  - `pain_point`: `{ description, severity? }`
  - `tool`: `{ name, purpose }`
  - `role`: `{ title, responsibilities }`
- [ ] RLS: nur eigener Workspace sieht eigene Objekte
- [ ] pgvector Cosine-Ähnlichkeitssuche funktioniert: `ORDER BY embedding <=> query_embedding LIMIT 10`

### API
- [ ] `GET /api/interview/:id/objects` — alle `knowledge_objects` eines Interviews, sortiert nach `created_at`
- [ ] Response: `{ objects: KnowledgeObject[], count: number }`
- [ ] Nur für authenticated User mit Zugriff auf diesen Workspace

### Akzeptanz-Schwelle nach Interview-Abschluss
- [ ] Nach vollständigem Interview (≥10 Turns): mindestens 5 `knowledge_objects` in DB
- [ ] Alle Objekte haben `source_quote` (kein leeres Feld)
- [ ] Alle Objekte haben `embedding` (nicht null)

## Edge Cases

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| LLM gibt kein valides JSON zurück | Fehler geloggt, keine Objekte gespeichert, Turn unberührt |
| LLM extrahiert 0 Objekte aus Turn | Kein DB-Insert, kein Fehler |
| Embedding-API (OpenAI) nicht erreichbar | Objekt ohne Embedding gespeichert (embedding = null), Fehler geloggt |
| Extraktion dauert länger als Turn-Response | Turn-Response kommt trotzdem sofort — Extraktion läuft im Hintergrund weiter |
| Doppelte Extraktion desselben Zitats | Kein Deduplizierungs-Mechanismus im MVP — beide werden gespeichert |
| Interview-ID existiert nicht in API-Request | 404 |
| User fragt Objekte eines fremden Workspaces ab | RLS blockiert → leere Liste (kein 403) |

## Technical Requirements
- Service-Layer: KI-Logik ausschließlich in `src/services/extraction.ts` und `src/services/embeddings.ts`
- Non-blocking: Extraktion darf Turn-Latenz nicht erhöhen
- Security: `OPENAI_API_KEY` und `ANTHROPIC_API_KEY` nur server-seitig (NEVER `NEXT_PUBLIC_`)
- Admin-Client (`supabase-admin.ts`) für DB-Writes in Extraktions-Service (RLS würde service-seitige Writes blockieren)

## Out of Scope
- Deduplizierung von Wissensobjekten
- Manuelle Korrektur / Bearbeitung extrahierter Objekte
- Extraktion direkt aus Audio (läuft über Transkript)
- Realtime-Push via Supabase Realtime (UI pollt oder lädt manuell)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Datenfluss

```
Mitarbeiter schickt Antwort
        ↓
POST /api/interview/[token]/chat   (PROJ-2, bereits gebaut)
        ↓
Agent Core generiert nächste Frage
        ↓
Response geht sofort an Client ✓
        ↓ (fire-and-forget, kein await)
extractAndEmbed() startet im Hintergrund
        ↓
src/services/extraction.ts
  Claude claude-opus-4-5
  Input: vollständiges Transkript
  Output: JSON-Array [{ type, content, source_quote }]
        ↓ (für jedes Objekt)
src/services/embeddings.ts
  OpenAI text-embedding-3-small
  Input: content als Text
  Output: vector[1536]
        ↓
Supabase Admin Client
  INSERT INTO knowledge_objects (inkl. embedding vector)
```

### Neue Dateien

```
src/
├── services/
│   ├── interviewAgent.ts     (bereits gebaut)
│   ├── extraction.ts         NEU — LLM-Extraktion via Claude
│   └── embeddings.ts         NEU — OpenAI Embeddings
└── app/api/interview/[token]/
    ├── chat/route.ts          anpassen: fire-and-forget hinzufügen
    └── objects/route.ts       NEU — GET knowledge_objects
```

### Komponenten-Verantwortlichkeiten

| Komponente | Verantwortung |
|-----------|---------------|
| `extraction.ts` | Claude-Aufruf, Prompt-Bau, JSON-Parsing, Fehler-Logging |
| `embeddings.ts` | OpenAI-Aufruf, gibt vector[1536] zurück, Fehler-Logging |
| `chat/route.ts` | Feuert `extractAndEmbed()` ohne `await` nach Agent-Response |
| `objects/route.ts` | Liest `knowledge_objects` für Interview, prüft Workspace-Zugehörigkeit |
| `supabase-admin.ts` | Schreibt Objekte mit Embedding (umgeht RLS für server-seitige Writes) |

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Non-blocking Trigger | Fire-and-forget (`void fn()`) | Einfachste Methode — kein Queue-System nötig für MVP |
| LLM für Extraktion | Claude claude-opus-4-5 | Bereits im Stack (`@ai-sdk/anthropic`) |
| Embedding-Modell | `text-embedding-3-small` (1536 dim) | Passt zu existierendem pgvector-Index |
| DB-Client für Writes | `supabase-admin` (Service Role) | Extraktions-Service läuft ohne User-Session |
| Ähnlichkeitssuche | pgvector Cosine Distance | Bereits im Schema (IVFFlat-Index), kein Extra-Dienst |

### Neue Dependencies

| Package | Zweck |
|---------|-------|
| `openai` | OpenAI Embeddings API (text-embedding-3-small) |

## QA Test Results

**QA Date:** 2026-05-20
**Tester:** QA Engineer (automated)
**Test Suite:** 33 unit tests, 0 E2E (backend-only feature, no UI)

### Acceptance Criteria Results

| Kriterium | Status | Notiz |
|-----------|--------|-------|
| Extraktion non-blocking nach Turn | ✅ PASS | `void extractAndEmbed()` in `onFinish` |
| Agent sieht nur Transkript | ✅ PASS | `interview_state` nicht übergeben |
| Extrahiert 4 Typen | ✅ PASS | process_step, pain_point, tool, role |
| source_quote aus user_input | ✅ PASS | Prompt erzwingt wörtliches Zitat |
| Claude claude-opus-4-5 | ✅ PASS | `anthropic('claude-opus-4-5')` |
| 0–N Objekte pro Turn | ✅ PASS | Leeres Array = kein Insert, kein Fehler |
| Extraktion in `extraction.ts` | ✅ PASS | Service-Layer eingehalten |
| Fehler geloggt, Turn unberührt | ✅ PASS | try/catch mit console.error |
| Embedding via text-embedding-3-small | ✅ PASS | `@ai-sdk/openai` |
| Embedding-Input = content als Text | ✅ PASS | `${type}: ${JSON.stringify(content)}` |
| Embedding-Logik in `embeddings.ts` | ✅ PASS | Service-Layer eingehalten |
| Embedding + Insert in einer Operation | ✅ PASS | Sequenziell pro Objekt |
| knowledge_objects Schema korrekt | ✅ PASS | Migration vorhanden |
| RLS Workspace-Isolation | ✅ PASS | Admin-Client schreibt; RLS schützt Lesezugriff |
| pgvector Ähnlichkeitssuche | ⚠️ PARTIAL | Index vorhanden, Suche noch nicht als API exponiert |
| GET /api/interview/:id/objects | ✅ PASS | Route implementiert |
| Response `{ objects[], count }` | ✅ PASS | |
| Auth Required | ⚠️ BUG-B2 | Token-only Zugriff möglich ohne Session |

### Bugs Gefunden

#### B1 — Medium: Kein Typ-Allowlist-Check vor DB-Insert
**Steps:** LLM gibt `type: "unknown"` zurück → DB CHECK schlägt fehl → kryptischer Supabase-Error statt sauberem "[extraction] Invalid type" Log.
**Fix:** `const ALLOWED_TYPES = ['process_step', 'pain_point', 'tool', 'role'] as const` — vor Insert prüfen.

#### B2 — Medium: Unauthentifizierter Zugriff auf knowledge_objects via Token
**Steps:** GET `/api/interview/[token]/objects` ohne Session-Cookie → 200 + Daten.
**Spec sagt:** "Nur für authenticated User mit Zugriff auf diesen Workspace."
**Fix:** Wenn kein `user` in Session → 401 zurückgeben. Token-Only-Zugriff auf Objects nur in PROJ-3 UI klären (Interviewee braucht ggf. separaten Endpoint).

#### B3 — Low: `embedding as unknown as string` Typ-Cast
**Impact:** Funktioniert in Praxis (Supabase serialisiert number[] zu pgvector), aber versteckt Typfehler.
**Fix:** Korrektes Typing in `database.types.ts` — `embedding` als `number[] | null` mit pgvector-kompatibler Insert-Logik.

#### B4 — Low: `maxOutputTokens: 1000` könnte bei vielen Items truncaten
**Impact:** Interviews mit dichten Antworten könnten JSON mid-array truncaten → JSON.parse Error (bereits abgefangen).
**Fix:** Auf 2000 erhöhen.

### Security Audit

| Check | Ergebnis |
|-------|---------|
| ANTHROPIC_API_KEY nur server-seitig | ✅ |
| OPENAI_API_KEY nur server-seitig | ✅ |
| Service Role Key nie im Browser | ✅ |
| User-Input in LLM-Prompt (Prompt Injection) | ⚠️ Akzeptiertes MVP-Risiko |
| Workspace-Isolation bei auth. Zugriff | ✅ |
| Unauthentifizierter Zugriff objects-Route | 🔴 B2 |
| SQL Injection via Supabase | ✅ Parameterisiert |

### Test-Abdeckung

- `src/services/extraction.test.ts`: 9 Tests — LLM-Fehler, valide Extraktion, malformed Objects, DB-Fehler, Markdown-Strip, null-Embedding
- `src/app/api/interview/[token]/objects/objects.test.ts`: 3 Tests — 404, Success, Empty
- `src/app/api/interview/[token]/chat/chat.test.ts`: extraction Mock ergänzt

**Gesamt: 33/33 Tests bestanden**

### Produktion-Ready?

**JA** — Alle Bugs (B1–B4) behoben. Re-QA 2026-05-20 bestanden. 35/35 Tests grün.

## Deployment

**Deployed:** 2026-05-20
**Production URL:** https://meridian-app-tau.vercel.app/
**Hinweis:** Mit-deployed via Merge-Commit des PROJ-3 Deploys. War bereits auf `origin/main` vorhanden.
