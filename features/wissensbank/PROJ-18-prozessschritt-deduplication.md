# PROJ-18: Prozessschritt-Deduplication

## Metadata
- **ID:** PROJ-18
- **Type:** Feature
- **Domain:** Wissensbank
- **Extends:** PROJ-5
- **Status:** Deployed
- **Priority:** P1
- **Appetite:** M

## Problem

Mehrere Mitarbeiter beschreiben denselben Prozess (z.B. Nachkalkulation) → der Berater sieht N identische Cards im Prozessschritte-Tab. Kein Signal dass es sich um denselben Prozess handelt. Keine Information darüber wer alles beteiligt ist.

## Solution

Semantisches Clustering via pgvector: Nach jedem Interview-Abschluss werden neue `process_steps` anhand ihrer Embedding-Vektoren mit bestehenden Clustern verglichen. Ähnliche Schritte (Cosinus-Ähnlichkeit ≥ 0.85) werden einem Cluster zugeordnet. Im UI erscheint pro Cluster eine Sektion mit "N Personen"-Badge.

## Schema Changes

**Neue Tabelle `process_clusters`:**
- `id`, `workspace_id`, `canonical_title`, `canonical_description`
- `participant_count` (denormalisiert)
- `participants` (JSONB: `[{interview_id, employee_name, employee_role, process_step_id}]`)
- `representative_embedding vector(1024)` — erster Step des Clusters

**Neue Spalten in `process_steps`:**
- `cluster_id uuid REFERENCES process_clusters(id)` (nullable)
- `embedding vector(1024)` (kopiert aus `knowledge_objects` beim Enrichment)

## Implementation

### Services

**`src/services/processEnrichment.ts`** — beim INSERT: `embedding` aus `knowledge_objects` via `knowledge_object_id` mapping kopieren.

**`src/services/processClustering.ts`** (neu) — `clusterProcessSteps(workspaceId)`:
1. Lade alle `process_steps` ohne `cluster_id` (mit embedding) für den Workspace
2. Lade alle `process_clusters` mit `representative_embedding`
3. Für jeden Step: finde nächsten Cluster via Cosinus-Ähnlichkeit (in-memory)
4. Ähnlichkeit ≥ `CLUSTER_SIMILARITY_THRESHOLD` (default 0.85) → Cluster erweitern
5. Sonst → neuen Cluster anlegen
6. Update `process_steps.cluster_id`

**`src/app/api/interview/[token]/chat/route.ts`** — nach `enrichProcessSteps()`: `clusterProcessSteps()` fire-and-forget.

### UI

**`src/components/ProcessStepsTable.tsx`** — Toggle "Gruppiert / Einzeln":
- **Gruppiert** (default): Sektionen nach `cluster_id`. Header zeigt `canonical_title` + Badge "N Personen". Mehrfach-Cluster erscheinen zuerst.
- **Einzeln**: Bestehende Ansicht (Gruppierung nach Abteilung), unverändert.

**`src/app/dashboard/process-steps/page.tsx`** — Query mit `process_clusters(...)` JOIN.

## Configuration

```env
CLUSTER_SIMILARITY_THRESHOLD=0.85  # Cosinus-Ähnlichkeit für Cluster-Zuordnung
```

## Migration

`supabase/migrations/20260525000001_proj18_process_clustering.sql`

## Verifikation

1. Zwei Interviews abschließen, beide beschreiben "Rechnungsfreigabe"
2. Gruppiert-View: 1 Sektion mit Badge "2 Personen"
3. Einzeln-View: 2 separate Cards (Regression-Check)
4. Backfill: `clusterProcessSteps()` für existierende Workspaces manuell ausführen

## Out of Scope

- Teilprozess-Hierarchie (Sub-Steps eines Oberprozesses)
- Manuelles Merge/Split von Clustern
- Cluster-Confidence-Score im UI

## QA Test Results

**Date:** 2026-05-26  
**Status:** Approved — 0 Critical, 0 High bugs

### Automated Tests
| Suite | Result |
|-------|--------|
| Vitest unit tests (216 total, 8 new for `cosineSim`) | ✅ 216/216 pass |
| E2E Playwright — auth guard + API guards | ✅ 6/6 pass |
| E2E UI toggle tests | ⚠ Blocked by BUG-E2E-1 (pre-existing signup allowlist issue) |

### Acceptance Criteria
| AC | Result | Notes |
|----|--------|-------|
| `process_clusters` table created, RLS enabled | ✅ Pass | Migration applied, all 3 policies verified |
| `process_steps` gains `cluster_id` + `embedding` columns | ✅ Pass | Types updated in `database.types.ts` |
| Clustering fires fire-and-forget after interview completion | ✅ Pass | `chat/route.ts:209` confirmed |
| Grouped view: sections by cluster, multi-participant first | ✅ Pass | Code review verified sort logic |
| "N Personen" badge on multi-participant clusters | ✅ Pass | Badge renders when `clusterSteps.length > 1` |
| Einzeln view: department grouping unchanged | ✅ Pass | Separate render path, original logic intact |
| Toggle persists within session | ✅ Pass | `useState('grouped')` client-side |
| `cosineSim` correct for identical/orthogonal/zero vectors | ✅ Pass | 8 unit tests |
| Auth guard on /dashboard/process-steps | ✅ Pass | Redirects to /login |

### Bugs Found
| Severity | Description |
|----------|-------------|
| Low | `process_steps.cluster_id` link update errors silently dropped — self-healing on next clustering run |
| Low | `viewMode` not persisted across page navigations (back/forward resets to Gruppiert) |

### Security Audit
- ✅ `process_clusters` RLS: SELECT/INSERT/UPDATE restricted to workspace members
- ✅ Service role used server-side → correct RLS bypass
- ✅ No user input in clustering path (all from DB)
- ✅ No XSS vectors in React rendering

### Production-Ready: YES

## Deployment

- **Production URL:** https://meridian-app.vercel.app
- **Deployed:** 2026-05-26
- **G1 (Static):** pass — build, lint, tsc clean
- **G2 (Tests):** pass — 216/216 unit, 6/6 E2E
- **G3 (Sandbox):** pass — auto-deploy via git push to main
- **G4 (Permissions):** pass — RLS verified, no new LLM endpoints

## Post-Mortem

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | Medium — Migration-Repair-Schritt fehlte in Spec |
| Appetite vs. tatsächlich | geschätzt: M (3-5d) / tatsächlich: M |
| Größte Überraschung | Supabase Migration History Mismatch — `supabase migration repair` nötig weil frühere Migrationen direkt applied worden waren |
| Vorgeschlagene Regeländerung | Spec-Template: Migrations-Sektion um "migration repair"-Warnung erweitern falls remote DB divergiert |
| Build-Loop-Iterationen | tatsächlich: 1 (direkt grün) |
| Häufigste Fehlerkategorie | Tool-Call (supabase CLI auth) |
