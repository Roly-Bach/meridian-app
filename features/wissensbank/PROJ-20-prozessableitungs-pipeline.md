# PROJ-20: Prozessableitungs-Pipeline

## Status: Deployed
**Created:** 2026-05-27
**Last Updated:** 2026-05-27
**Type:** Epic
**Domain:** Wissensbank
**Extends:** —
**Appetite:** —
**Bugs:** 0:0:4 (alle Low, alle behoben)

> **Pipeline-Update 2026-05-27:** Schritt [3] auf `createProcessStepsFromTracker()` umgestellt. Slot-Werte kommen jetzt direkt aus `interview_state.step_tracker` (authoritative), LLM generiert nur noch description + source_quote. Failsafe: `ensureCompletedIfFarewell` setzt `status=completed` wenn Modell `[complete_interview]` als Text statt Tool-Call ausgibt.

> Konsolidiert: PROJ-4 (Extraktion), PROJ-5 (Anreicherung), PROJ-14 (Embedding-Modell), PROJ-18 (Clustering/Deduplication)

## Dependencies
- Requires: PROJ-1 (Auth + Workspace) — RLS, workspace_id
- Requires: PROJ-2 (Interview Engine Backend) — Turn-Loop, turns-Tabelle, interview_id
- Requires: PROJ-3 (Interview UI) — `interviews.department` muss aus vordefinierter Dropdown-Liste kommen
- Enables: PROJ-6 (Use Case Engine) — liest `process_steps`

---

## Pipeline-Übersicht

```
Interview (status → completed)
        ↓
[1] extractAndEmbed()           extraction.ts
    ├─ LLM: 4 Typen aus Transkript (process_step, pain_point, tool, role)
    ├─ Jina Embedding: 1024-dim Vektor pro Objekt
    └─ INSERT INTO knowledge_objects
        ↓
[2] deduplicateKnowledgeObjects()   extraction.ts (fire-and-forget, jeder Turn)
    └─ Cosine-Similarity > 0.92 + gleiche Rolle → Duplikat löschen
        ↓
[3] enrichProcessSteps()        processEnrichment.ts
    ├─ LLM: quantitative Attribute ableiten (Frequenz, Dauer, Fehlerrate, …)
    ├─ Grounding Guard: Attribut nur setzen wenn evidence_quote vorhanden
    └─ INSERT INTO process_steps
        ↓
[4] clusterProcessSteps()       processClustering.ts (fire-and-forget)
    ├─ Cosine-Similarity ≥ 0.85 → in bestehendem Cluster einordnen
    ├─ Sonst → neuen Cluster anlegen
    └─ UPDATE process_steps.cluster_id + process_clusters
```

**Trigger:** `onFinish` in `src/app/api/interview/[token]/chat/route.ts`  
**Re-run:** `POST /api/interviews/[id]/reextract`

---

## Datenmodell

### `knowledge_objects`
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | uuid | PK |
| interview_id | uuid | FK → interviews |
| workspace_id | uuid | FK → workspaces |
| type | enum | `process_step \| pain_point \| tool \| role` |
| content | jsonb | `{ title, description, role }` (process_step) etc. |
| source_quote | text | Exaktes Zitat aus Mitarbeiter-Input |
| turn_id | uuid | FK → turns |
| embedding | vector(1024) | Jina jina-embeddings-v3 |
| created_at | timestamptz | |

### `process_steps`
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | uuid | PK |
| interview_id | uuid | FK → interviews |
| workspace_id | uuid | FK → workspaces |
| knowledge_object_id | uuid | FK → knowledge_objects |
| cluster_id | uuid | FK → process_clusters (nullable) |
| embedding | vector(1024) | Kopiert aus knowledge_objects beim Insert |
| frequency_per_month | integer | null = im Interview nicht erwähnt |
| duration_minutes | integer | null = im Interview nicht erwähnt |
| data_sources | text[] | z.B. ["SAP", "Excel"] |
| rule_based | boolean | true nur bei explizitem Regelhinweis |
| error_rate_percent | numeric | null = kein Hinweis |
| media_breaks | integer | null = kein Hinweis |
| step_type | enum | `action \| decision` |
| condition_text | text | Bei step_type = decision |
| created_at | timestamptz | |

### `process_clusters`
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| canonical_title | text | Repräsentativer Titel |
| canonical_description | text | Beschreibung des Clusters |
| participant_count | integer | Denormalisiert |
| participants | jsonb | `[{interview_id, employee_name, employee_role, process_step_id}]` |
| representative_embedding | vector(1024) | Embedding des ersten Steps |

---

## Services

| Service | Datei | Funktion |
|---------|-------|---------|
| Extraktion + Embedding | `src/services/extraction.ts` | `extractAndEmbed()`, `deduplicateKnowledgeObjects()` |
| Embedding-Provider | `src/services/embeddings.ts` | `generateEmbedding()` — Jina jina-embeddings-v3 |
| Anreicherung | `src/services/processEnrichment.ts` | `enrichProcessSteps()` |
| Clustering | `src/services/processClustering.ts` | `clusterProcessSteps()` |

### Service-Layer-Constraint
KI-Logik (LLM-Calls, Embedding-Calls, Vektor-Operationen) ausschließlich in `src/services/` — nicht direkt in API Routes.

---

## API Routes

| Route | Methode | Funktion |
|-------|---------|---------|
| `/api/interview/[token]/chat` | POST | Haupt-Trigger (onFinish) |
| `/api/interview/[token]/objects` | GET | knowledge_objects eines Interviews |
| `/api/process-steps` | GET | Alle Steps eines Workspace (`?workspace_id=`) |
| `/api/process-steps/generate` | POST | Manuelle Anreicherung (`{ interview_id }`) |
| `/api/process-steps/[id]` | PATCH | Einzelattribut editieren |
| `/api/process-steps/[id]/substeps` | GET | Sub-Steps eines Steps |
| `/api/interviews/[id]/reextract` | POST | Vollständigen Pipeline-Lauf wiederholen |

---

## Embedding-Provider

**Aktuell:** Jina AI jina-embeddings-v3 (1024 dim, EU DPA via Elastic)  
**Env:** `JINA_API_KEY`, `EMBEDDING_MODEL=jina-embeddings-v3`  
**Integration:** `@ai-sdk/openai` mit custom `baseURL: 'https://api.jina.ai/v1'`

**DSGVO-Fallback (bei Bedarf):** Qwen3-Embedding-0.6B via HuggingFace Inference Endpoints (EU-Region, AWS eu-west-1) — gleiche API-Signatur, nur andere `baseURL`.

---

## Clustering-Konfiguration

```env
CLUSTER_SIMILARITY_THRESHOLD=0.85  # Cosinus-Ähnlichkeit für Cluster-Zuordnung
```

Threshold-Änderung erfordert Backfill via `clusterProcessSteps()`.

---

## UI

- `/dashboard/process-steps` — Prozessschritte gruppiert nach Abteilung + Cluster
- Cluster-Karte: `canonical_title`, Badge "N Interviews" (blau wenn >1), gemittelte Metriken
- Cluster Detail Sheet: Warum geclustert, Interviews-Liste, Steps aufklappbar
- Inline-Edit: Number-Zellen (Enter/Blur), Tags-Zelle (kommagetrennt), Switch (rule_based)
- Optimistic Updates + Fehler-Toast (sonner)

---

## Bekannte Bugs (alle behoben)

| # | Severity | Beschreibung | Behoben |
|---|----------|-------------|---------|
| B1 | Low | Kein Typ-Allowlist-Check vor DB-Insert in extraction.ts | ✅ 2026-05-20 |
| B2 | Low | Unauthentifizierter Zugriff auf objects-Route (nur Token, keine Session) | ✅ 2026-05-20 |
| B3 | Low | `process_steps.cluster_id` Update-Fehler werden silent dropped (self-healing) | Akzeptiert MVP |
| B4 | Low | `viewMode` nicht über Page-Navigation persistiert | Akzeptiert MVP |

---

## Migrations

| Migration | Inhalt |
|-----------|--------|
| `...proj4_knowledge_objects.sql` | knowledge_objects Tabelle + RLS + pgvector Index (1024 dim) |
| `...proj5_process_steps.sql` | process_steps Tabelle + RLS + Zod-kompatible Constraints |
| `...proj18_process_clustering.sql` | process_clusters Tabelle + RLS + cluster_id/embedding Spalten in process_steps |

---

## Out of Scope

- Manuelle Anlage von Prozessschritten ohne Interview
- Löschen von Prozessschritten in UI (MVP: read-only löschen)
- Paginierung (MVP: max 200 Einträge)
- Manuelles Merge/Split von Clustern
- Cluster-Confidence-Score im UI
- Hybrid Search (Sparse + Dense)
- Wissensobjekt-Deduplication über den Turn hinaus (nur process_step-Ebene)
- Use Case Ableitung → PROJ-6
- PDF Reports → PROJ-11

---

## Deployment

**Deployed:** 2026-05-26 (PROJ-18 war letztes Modul — alle Phasen live)  
**Production URL:** https://meridian-app.vercel.app

---

## QA Test Results — 2026-05-27

**Getestete Änderungen:** `createProcessStepsFromTracker` (processEnrichment.ts), `ensureCompletedIfFarewell` failsafe (chat/route.ts), reextract + process-steps/generate Route-Updates.

### Automated Tests
| Suite | Ergebnis |
|-------|---------|
| Vitest Unit (231 Tests) | ✅ 231/231 passed |
| E2E Playwright | ⚠️ 12 failed (pre-existing Signup-Redirect-Fehler, unrelated zu diesen Änderungen — verifiziert via git stash) |

### Unit Tests neu geschrieben
`createProcessStepsFromTracker` — 8 neue Tests in `src/services/processEnrichment.test.ts`:
- Idempotency Guard ✅
- Exploring-Filter ✅
- Leerer step_tracker ✅
- Slot-Werte direkt aus Tracker (kein LLM-Rounding) ✅
- LLM-Fallback bei Fehler ✅
- LLM-Fallback bei Non-Array-Response ✅
- Markdown-Code-Fence-Stripping ✅
- step_type=decision + condition_text ✅

### Security Audit
- `ensureCompletedIfFarewell`: Pattern-Match auf LLM-Output (kein User-Input), idempotent → kein Risiko
- `createProcessStepsFromTracker`: LLM-Response in try/catch, Idempotency-Guard, admin client → kein Risiko
- reextract delete: UUID-validiert + Workspace-Ownership-Check davor → kein unbefugtes Delete

**Keine Security-Findings.**

### Bugs
Keine neuen Bugs in diesen Änderungen gefunden.

**Bugs gesamt: 0:0:0** (neue Änderungen)  
**Production-Ready: YES**
