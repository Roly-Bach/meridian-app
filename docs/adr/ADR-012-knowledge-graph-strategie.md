# ADR-012: Knowledge Graph Strategie — Bewertung und Defer-Entscheidung

**Status:** Deferred (2026-05-30)
**Author:** lyas53
**Repository:** Roly-Bach/meridian-app
**Auslöser:** Strategische Frage: Macht ein Knowledge Graph für Meridian Sinn — und wenn ja, in welcher Form?
**Verknüpft mit:** PROJ-20 (Prozessableitungs-Pipeline), PROJ-19 (Knowledge-Informed Interviewing), PROJ-23 (Adaptive Clarification Questions)

---

## Context

Meridian verfügt über eine Vektordatenbank (pgvector, 1024-dim Jina Embeddings) und ein flaches relationales Modell (`knowledge_objects`, `process_steps`, `process_clusters`). Die Frage war: Wo würde ein echter Knowledge Graph mit expliziten Kanten zusätzlichen Wert liefern — und welche Architektur wäre nötig?

### Aktueller Zustand (Stand: 2026-05-30)

**Vorhandene Infrastruktur:**
- pgvector-Embeddings auf `knowledge_objects` und `process_steps`
- `search_knowledge_objects` und `match_process_cluster` RPC-Funktionen — existieren, werden aber nur post-interview für Deduplication genutzt
- Vector Search **während Interview**: nie aufgerufen

**Das Kernproblem — implizite Relationen:**
Alle Beziehungen zwischen Entitäten sind heute implizit als freie Strings in JSONB gespeichert:
- `pain_point.content.step_ref = "Rechnungsprüfung"` — Text-String, kein FK
- `process_steps.role = "Buchhalter"` — kein FK zu roles
- Tools in `step_tracker.friction_tools` — ephemeres Array, nicht als Kante persistiert

Konsequenz: Kein Graph-Traversal möglich. Use Case Engine, Analyst und Interview Agent können nicht fragen: *"Welche anderen Prozessschritte im Workspace haben ähnliche Pain Points?"*

---

## Analyse: Wo Knowledge Graph Wert schafft

### Hoher Wert

**1. Cross-Interview ROI-Multiplikator**
Heute: ROI = freq × duration × rate × reduction — pro Step, pro Interview isoliert.
Problem: Process Cluster "Rechnungsprüfung" mit 5 Mitarbeitern → ROI wird 5× unabhängig berechnet, niemals aggregiert.
Mit KG: Cluster-Participant-Count multipliziert ROI → Use Case erhält korrekte Unternehmensdimension.

**2. Workspace-weite Qualitative Heuristiken**
Heute: P2-Regel "Tool Consolidation" zählt Tools pro Interview. 8 Mitarbeiter nutzen alle "SAP + Excel" → P2 wird 8× isoliert ausgelöst, nie workspace-weit aggregiert.
Mit KG: Tool-Frequenz über alle Interviews → stärkeres Integration-Signal.

### Mittlerer Wert

**3. Knowledge-Informed Interviewing (PROJ-19)**
Enabler-Voraussetzung: Explizite Kanten + aktivierte Vector Search during interview.
Pattern: `find_similar_steps(embedding)` → `traverse(pain_points, tools)` → Analyst-Briefing mit Workspace-Kontext.
Heute nicht umsetzbar ohne explizite Kanten.

**4. Provenance-Ketten im Dashboard**
`use_cases` haben `process_step_id` FK — UI nutzt ihn nicht. Pain Points die Use Case ausgelöst haben: unsichtbar für Berater.
Mit KG: vollständige Kette `Use Case ← Process Step ← Interview ← Pain Points`.

---

## Entscheidungen

### D1 — Kein dediziertes Graph-Datenbanksystem

Neo4j, Memgraph, TigerGraph und ähnliche dedizierte Graph-DBs werden für Meridian **nicht eingesetzt**.

**Begründung:**
- Solo-Developer-Constraint: neue Infra = neues Operations-Problem
- Sync zwischen Graph-DB und Supabase ist fehleranfällig und komplex
- Datenvolumen im MVP rechtfertigt keine Graph-Engine (< 10k Knoten erwartet)
- Supabase + pgvector + SQL-Joins reichen für die identifizierten Use Cases aus

### D2 — Empfohlene Architektur: Hybrid Relational Graph in Supabase (DEFERRED)

Falls gebaut, besteht die Architektur aus zwei neuen Tabellen:

**`knowledge_object_relations`** — explizite Kanten zwischen knowledge_objects:
```sql
CREATE TABLE knowledge_object_relations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id),
  from_id       uuid NOT NULL REFERENCES knowledge_objects(id) ON DELETE CASCADE,
  to_id         uuid NOT NULL REFERENCES knowledge_objects(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN (
    'HAS_PAIN_POINT',   -- process_step → pain_point
    'USES_TOOL',        -- process_step → tool
    'PERFORMED_BY',     -- process_step → role
    'SIMILAR_TO'        -- cross-interview, vector-derived
  )),
  weight        numeric(4,2) DEFAULT 1.0,
  created_at    timestamptz DEFAULT now()
);
```

**`use_case_sources`** — Provenance: welche Steps/KOs haben diesen Use Case ausgelöst:
```sql
CREATE TABLE use_case_sources (
  use_case_id         uuid REFERENCES use_cases(id) ON DELETE CASCADE,
  process_step_id     uuid REFERENCES process_steps(id) ON DELETE SET NULL,
  knowledge_object_id uuid REFERENCES knowledge_objects(id) ON DELETE SET NULL,
  contribution_type   text NOT NULL CHECK (contribution_type IN (
    'heuristic_trigger', 'roi_base', 'pain_amplifier', 'tool_signal'
  ))
);
```

Zusätzlich: `process_clusters` erhält `pain_point_frequency jsonb`, `tool_frequency jsonb`, `aggregated_roi_eur numeric`.

### D3 — Build-Reihenfolge wenn die Entscheidung fällt zu bauen

| Phase | Scope | Appetite |
|-------|-------|----------|
| 1 | `knowledge_object_relations` Migration + Befüllung in extraction.ts | S |
| 2 | `use_case_sources` Migration + Provenance in useCaseEngine.ts | S |
| 3 | Cluster-Aggregation (pain/tool frequency, aggregated ROI) | M |
| 4 | Use Case Engine: Cluster-multiplied ROI + workspace-weite Heuristiken | M |
| 5 | Vector Search during interview → PROJ-19 enabler | M |

Phases 1+2 sind Vorbedingung für alles andere. Als PROJ-24 zu erfassen wenn Entscheidung fällt.

### D4 — Defer-Begründung: PROJ-23 zuerst

**Warum jetzt nicht bauen:**
- PROJ-23 (Adaptive Clarification Questions) verbessert Slot-Befüllung (`frequency_per_month`, `duration_minutes`) strukturell
- Bessere Slot-Daten = bessere Use Case ROI-Berechnung ohne Graph-Infrastruktur
- Knowledge Graph auf sparse/unvollständige Daten bringt wenig — erst PROJ-23 deployen, dann Datenqualität prüfen
- PROJ-22 ist noch nicht deployed (Prerequisite für PROJ-23)

**Wann revisiten:**
Nach PROJ-23 deployed und ≥10 abgeschlossene Interviews mit Clarification Phase. Dann prüfen: Wie viele Slots sind noch leer? Wie oft fehlt der ROI-Multiplikator? Wenn Use Cases immer noch isoliert bleiben → PROJ-24 aufsetzen.

---

## Nicht-Ziele

- Vollständige Ontologie (RDF/OWL) — kein akademisches Projekt
- Ersetzen von pgvector durch Graph-DB — Embeddings bleiben für Semantic Clustering
- Graph-Visualisierung als UI-Feature (Neo4j Bloom etc.) — kein Scope für MVP

---

## Verwandte Entscheidungen

- ADR-009 (Observable State) hat Voraussetzung für Cross-Interview-Wissen bereits teilweise gelegt
- PROJ-19 (Knowledge-Informed Interviewing) kann erst nach D3-Phase 1-2 sinnvoll gebaut werden
- PROJ-23 muss vor PROJ-24 deployed sein (Datenqualitätsvoraussetzung)
