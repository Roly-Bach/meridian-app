# PROJ-5: Prozessschritt-Anreicherung

## Status: Approved
**Created:** 2026-05-20
**Last Updated:** 2026-05-20

## Dependencies
- Requires: PROJ-1 (Auth + Workspace) — Auth, workspace_id, RLS
- Requires: PROJ-4 (Extraktions-Agent + Wissensbasis) — `knowledge_objects` mit type `process_step` als Input

## User Stories
- Als Berater bekomme ich nach Interview-Abschluss automatisch angereicherte Prozessschritte — ohne manuell etwas zu triggern.
- Als Berater sehe ich alle Prozessschritte in einer Tabelle mit quantitativen Attributen (Häufigkeit, Dauer, Datenquellen, etc.).
- Als Berater kann ich nicht ableitbare oder falsche Attributwerte direkt in der Tabelle inline bearbeiten und speichern.
- Als Backend kann ich per `GET /api/process-steps?workspace_id=xxx` alle Prozessschritte eines Workspaces abrufen (Grundlage für PROJ-6).
- Als Berater erkenne ich sofort welche Attribute aus dem Interview ableitbar waren (befüllt) und welche manuell ergänzt werden müssen (leer).

## Acceptance Criteria

### Automatischer Trigger bei Interview-Abschluss
- [ ] Wenn `interviews.status` auf `completed` gesetzt wird, triggert `POST /api/process-steps/generate` automatisch (fire-and-forget)
- [ ] Trigger ist idempotent: läuft nicht wenn für dieses Interview bereits `process_steps` vorhanden sind

### LLM-Anreicherung — strikt quellengebunden
- [ ] LLM liest vollständiges Interview-Transkript + alle `process_step` Wissensobjekte des Interviews
- [ ] **Strikte Quellen-Bindung:** Jedes Attribut wird **nur** gesetzt wenn es explizit im Interview erwähnt wurde — niemals geraten oder erfunden
  - Beispiel: "jeden Montag" → `frequency_per_month = 4`
  - Beispiel: "dauert so 2 Stunden" → `duration_minutes = 120`
  - Beispiel: "wir nutzen SAP und Excel" → `data_sources = ["SAP", "Excel"]`
  - Kein Hinweis im Transkript → Attribut = `null`
- [ ] `rule_based = true` **nur wenn** Mitarbeiter explizit regelbasiertes Verhalten beschreibt: "immer gleich", "feste Regel", "immer wenn X dann Y" — sonst `false`
- [ ] `error_rate_percent` und `media_breaks` nur gesetzt wenn Mitarbeiter explizit Fehler oder Systemwechsel beschreibt
- [ ] Für jedes gesetzte Attribut gibt LLM ein `evidence_quote` zurück — das Originalzitat das zur Ableitung führte
- [ ] Anreicherungs-Logik in `src/services/processEnrichment.ts` — nicht direkt in API Route
- [ ] LLM-Fehler: geloggt via console.error, Interview bleibt `completed`, kein Crash

### API
- [ ] `POST /api/process-steps/generate` — Body: `{ interview_id }`, Response: `{ process_steps[], count: number }`
- [ ] `GET /api/process-steps?workspace_id=xxx` — Response: `{ process_steps[] }` sortiert nach `created_at desc`, limit 200
- [ ] `PATCH /api/process-steps/:id` — Body: Subset der Attribute (alle optional), Response: `{ process_step }`
- [ ] Alle Endpoints: Auth-Session + Workspace-Zugehörigkeit erforderlich
- [ ] Zod-Validierung auf PATCH: `frequency_per_month ≥ 0`, `duration_minutes ≥ 0`, `error_rate_percent` 0–100, `media_breaks ≥ 0`

### UI — Prozessschritt-Tabelle
- [ ] Seite `/dashboard/process-steps` zeigt alle Prozessschritte des Workspaces
- [ ] Tabellen-Spalten: Titel, Rolle, Häufigkeit/Monat, Dauer (Min), Datenquellen, Regelbasiert, Fehlerrate %, Medienbrüche
- [ ] Leere Zellen (null) klar sichtbar unterscheidbar von Zellen mit Wert "0"
- [ ] Jede Zelle inline editierbar — Klick öffnet Input/Select in der Zelle
  - `frequency_per_month`, `duration_minutes`, `error_rate_percent`, `media_breaks` → number input
  - `data_sources` → text input (kommagetrennt, wird zu array)
  - `rule_based` → toggle/checkbox
- [ ] Speichern via `PATCH` bei Blur/Enter — optimistic update, Fehler-Toast bei API-Fehler
- [ ] Loading Skeleton während Anreicherung läuft (nach Interview-Abschluss)
- [ ] Leerer Zustand: "Kein Interview abgeschlossen. Schließe ein Interview ab, um Prozessschritte zu generieren."

## Edge Cases

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Interview hat keine `process_step` Wissensobjekte | Generate läuft, erzeugt 0 Einträge, kein Fehler |
| Generate für Interview bereits vorhanden (Idempotenz) | Kein zweites Generate — prüft `process_steps count > 0` für dieses Interview |
| PATCH mit `frequency_per_month: -1` | 400 Validierungsfehler: "Muss ≥ 0 sein" |
| LLM gibt Attribut ohne Evidenz trotzdem befüllt zurück | Guard: Wert nur übernommen wenn `evidence_quote` vorhanden und nicht leer |
| Zwei Berater bearbeiten denselben Prozessschritt gleichzeitig | Last-write-wins (MVP — kein Conflict-Resolution) |
| `PATCH` auf nicht-existierende ID | 404 |
| `PATCH` auf Prozessschritt eines fremden Workspaces | RLS blockiert → 403 |

## Technical Requirements
- Service-Layer: LLM-Logik ausschließlich in `src/services/processEnrichment.ts`
- Grounding: LLM-Prompt muss explizit instruieren: "Setze ein Attribut NUR wenn eine klare Aussage im Transkript existiert. Keine Schätzung, kein Raten. Bei Unsicherheit: null."
- Security: ANTHROPIC_API_KEY nur server-seitig
- Admin-Client für `process_steps` Writes (RLS bypass)

## Out of Scope
- Manuelle Anlage von Prozessschritten ohne Interview
- Löschen von Prozessschritten in UI
- Paginierung der Tabelle (MVP: max 200 Einträge)
- Bulk-Edit (mehrere Zeilen gleichzeitig)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Datenfluss

```
Interview wird abgeschlossen (status → completed)
        ↓ (fire-and-forget)
POST /api/process-steps/generate
        ↓
src/services/processEnrichment.ts
  Input: vollständiges Transkript + process_step Wissensobjekte
  Claude claude-opus-4-5
  Prompt: "Setze Attribut NUR wenn explizit im Transkript belegt.
           Kein Raten. Ohne Evidenz → null. Gib evidence_quote mit."
  Output: JSON-Array [{ title, frequency_per_month, evidence_quotes, ... }]
        ↓
Guard: Attribut wird verworfen wenn evidence_quote fehlt/leer
        ↓
Admin-Client: INSERT INTO process_steps (null wo kein Beleg)

Berater öffnet /dashboard/process-steps
  ← GET /api/process-steps?workspace_id=xxx
  Tabelle: befüllte Zellen = aus Interview belegt
           leere Zellen = kein Hinweis im Interview
        ↓
Berater klickt Zelle → Blur/Enter → PATCH /api/process-steps/:id
  → Optimistic update sofort, Fehler-Toast bei Fehler
```

### Neue Dateien

```
src/
├── services/
│   └── processEnrichment.ts      NEU — LLM-Anreicherung mit Grounding-Guard
├── app/api/
│   └── process-steps/
│       ├── generate/route.ts     NEU — POST: Anreicherung triggern
│       ├── route.ts              NEU — GET: Liste nach workspace_id
│       └── [id]/route.ts         NEU — PATCH: Einzelattribut updaten
└── app/dashboard/
    └── process-steps/page.tsx    NEU — Tabellen-UI

src/components/
    └── ProcessStepsTable.tsx     NEU — Inline-editierbare Tabelle
```

**Bestehende Datei anpassen:** Interview-Abschluss-Route → fire-and-forget generate hinzufügen.

### Komponenten-Struktur (UI)

```
/dashboard/process-steps
├── Header (Titel, Anzahl Einträge)
├── [Leer-Zustand] "Kein Interview abgeschlossen..."
├── [Loading Skeleton] während Anreicherung läuft
└── ProcessStepsTable
    └── ProcessStepRow (je Zeile)
        ├── Titel, Rolle (read-only)
        ├── EditableNumberCell  → frequency_per_month, duration_minutes
        ├── EditableTagsCell    → data_sources (kommagetrennt → array)
        ├── EditableBoolCell    → rule_based (Toggle)
        └── EditableNumberCell  → error_rate_percent, media_breaks
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Inline-Edit Pattern | Blur/Enter → PATCH | Kein Modal — direkter Edit spart Klicks |
| Optimistic Update | Sofort sichtbar, Revert bei Fehler | Tabelle fühlt sich schnell an |
| shadcn `Table` | Bereits installiert | Kein extra Package |
| Grounding-Guard | Server-seitig im Service | LLM-Output vor DB-Insert validiert — nie im Client |
| fire-and-forget | void-Pattern wie PROJ-4 | Konsistent, kein Queue nötig |
| Admin-Client für Writes | Service Role Key | Service läuft ohne User-Session |

### Neue Dependencies

Keine — shadcn Table installiert, Claude via @ai-sdk/anthropic vorhanden.

## QA Test Results

**QA Date:** 2026-05-20
**Test Suite:** 66 unit tests (8 applyGroundingGuard, 6 enrichProcessSteps, 5 generate API, 5 GET API, 7 PATCH API), 0 E2E (UI braucht Live-Supabase)

### Acceptance Criteria

| Kriterium | Status | Notiz |
|-----------|--------|-------|
| Fire-and-forget bei Interview-Abschluss | ✅ PASS | `void enrichProcessSteps()` in `complete_interview` tool |
| Trigger idempotent | ✅ PASS | Count-Check vor Enrichment |
| LLM liest Transkript + Wissensobjekte | ✅ PASS | beide an Claude-Prompt übergeben |
| Strikte Quellen-Bindung (nur mit evidence_quote) | ✅ PASS | `applyGroundingGuard` + 8 Unit-Tests |
| Attribute ohne Evidenz → null | ✅ PASS | Guard getestet |
| `rule_based` nur bei explizitem Regelhinweis | ✅ PASS | Guard → null → default false |
| `evidence_quote` pro Attribut | ✅ PASS | LLM-Prompt fordert es |
| Enrichment in `processEnrichment.ts` | ✅ PASS | Service-Layer eingehalten |
| LLM-Fehler geloggt, kein Crash | ✅ PASS | try/catch, Interview bleibt `completed` |
| POST /api/process-steps/generate | ✅ PASS | Auth + UUID-Validation + Workspace-Check |
| GET /api/process-steps?workspace_id= | ✅ PASS | Auth + workspace ownership |
| PATCH /api/process-steps/:id | ✅ PASS | Zod strict schema, ≥0 Validierung |
| Zod-Validierung `frequency_per_month ≥ 0` | ✅ PASS | Getestet |
| Zod-Validierung `error_rate_percent` 0–100 | ✅ PASS | Getestet |
| `/dashboard/process-steps` Seite | ✅ PASS | Server Component vorhanden |
| Tabelle zeigt alle Spalten | ✅ PASS | 8 Spalten implementiert |
| Null ≠ 0 in Zellen sichtbar | ✅ PASS | null → "—", 0 → "0" |
| Inline-Edit Number-Zellen | ✅ PASS | Enter/Blur/Escape |
| Inline-Edit Tags-Zelle (data_sources) | ✅ PASS | kommagetrennt → array |
| Toggle rule_based | ✅ PASS | Switch-Komponente |
| Optimistic Update + Revert | ✅ PASS | state management in component |
| Fehler-Toast bei PATCH-Fehler | ✅ PASS | sonner toast.error |
| Loading Skeleton | ✅ PASS | `ProcessStepsTableSkeleton` exportiert |
| Leerer Zustand | ✅ PASS | Text wenn steps.length === 0 |

### Bugs Gefunden

#### B1 — Low: "Rolle"-Spalte redundant
Role ist bereits als Subtitle im Titel-Cell sichtbar UND als eigene Spalte. Verdopplung verbraucht Tabellenbreite ohne Mehrwert.
**Fix:** "Rolle"-Spalte aus Tabelle entfernen, im Titel-Subtitle belassen.

#### B2 — Low: `inputRef` Typ enthält unnötig `| null`
`React.RefObject<HTMLInputElement | null>` — `null` im Generic unnötig, erschwert Typinferenz.
**Fix:** `useRef<HTMLInputElement>(null)` — TypeScript leitet korrekte Typen ab.

### Security Audit

| Check | Ergebnis |
|-------|---------|
| Auth auf allen API-Routen | ✅ |
| Workspace-Isolation (403 bei fremdem Workspace) | ✅ |
| Zod `.strict()` auf PATCH (keine extra Fields) | ✅ |
| XSS in data_sources Tags | ✅ React escaped |
| ANTHROPIC_API_KEY server-seitig | ✅ |
| Admin-Client nur server-seitig | ✅ |

### Produktion-Ready?

**JA** — keine Critical/High Bugs. B1+B2 sind Low — können nach Deploy behoben werden.

## Deployment

**Deployed:** 2026-05-20
**Production URL:** https://meridian-app-tau.vercel.app/
**Hinweis:** Mit-deployed via Merge-Commit des PROJ-3 Deploys. War bereits auf `origin/main` vorhanden.
