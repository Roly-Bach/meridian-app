# PROJ-24: Cluster-aware Use Case Generation + Detail View

## Status: Planned
**Type:** Extension
**Domain:** Use Case Engine
**Extends:** PROJ-6
**Appetite:** L
**Bugs:** —
**Created:** 2026-05-31
**Last Updated:** 2026-05-31

## Dependencies
- Requires: PROJ-6 (Use Case Identifikation) — erweitert Heuristik-Engine + Use-Cases-Liste
- Requires: PROJ-20 (Prozessableitungs-Pipeline) — `process_clusters` mit `canonical_description` + `participant_count` müssen existieren
- Requires: PROJ-18 (Prozessschritt-Deduplication) — `process_steps.cluster_id` + Embeddings müssen korrekt gesetzt sein

## Problem

Die Use Case Engine (PROJ-6) arbeitet im Silo: Jeder Process Step wird isoliert bewertet. Bestehende Daten werden nicht genutzt:

| Existiert in DB | Wird von PROJ-6 genutzt |
|---|---|
| `process_clusters` (cross-employee LLM-Synthese) | ❌ nein |
| `process_clusters.participant_count` | ❌ nein |
| `knowledge_objects.embedding` (pain_points) | ❌ nein |
| `process_steps.cluster_id` | ❌ nein |

**Effekt:** Ein Prozess den 5 Mitarbeiter durchführen → 5 separate schwache Use Cases statt einem starken Workspace-Use-Case mit 5× ROI. Pain points verschiedener Mitarbeiter die dasselbe Problem beschreiben → zwei unverbundene P1-Use-Cases statt einem konsolidierten.

---

## User Stories

- Als **KI-Berater** möchte ich Use Cases sehen die Workspace-weit aggregiert sind, damit ich dem Kunden zeigen kann welche Automatisierungen den größten Impact über alle Mitarbeiter haben.
- Als **KI-Berater** möchte ich bei Cluster-Use-Cases sehen wie viele Mitarbeiter denselben Prozess durchführen (mit ihren individuellen Metriken), damit ich die Aussage gegenüber dem Kunden belegen kann.
- Als **KI-Berater** möchte ich auf einen Use Case klicken und eine vollständige Detailansicht öffnen — mit Originalzitat, ROI-Aufschlüsselung und einer KI-generierten Implementierungsempfehlung.
- Als **KI-Berater** möchte ich, dass Use Cases die denselben Prozess betreffen nicht mehrfach in der Liste erscheinen, damit die Liste übersichtlich bleibt.
- Als **KI-Berater** möchte ich pain points die mehrere Mitarbeiter ähnlich beschreiben zu einem konsolidierten Use Case zusammengefasst sehen, damit ich workspace-weite Problemmuster erkenne.

---

## Feature 1: Cluster-aware Use Case Rules (C1–C3)

### Neue Regeln

Laufen auf `process_clusters` mit `participant_count ≥ 2`. Ergänzen die bestehenden R1–R8 (per process_step) und P1–P3 (per interview).

| Rule | Trigger | Use Case Type | ROI-Logik |
|------|---------|--------------|-----------|
| **C1** | `participant_count ≥ 2` + avg_frequency ≥ 5/Monat | `automation_at_scale` | Σ(freq × duration) aller Teilnehmer × hourly_rate × reduction_rate |
| **C2** | `participant_count ≥ 2` + avg_error_rate ≥ 10% | `process_standardization` | Σ(freq × duration × error_rate) — Fehlerkorrekturkosten |
| **C3** | `participant_count ≥ 3` + canonical_description enthält search-keywords (RAG/search patterns) | `knowledge_rag_at_scale` | wie R5 aber workspace-aggregiert |

Score-Boost: `score = base_score × Math.log2(participant_count + 1)` — mehr Teilnehmer = höhere Priorität.

### Suppression-Logik

Wenn ein Cluster-Use-Case (C-Rule) für einen Cluster generiert wurde:
- Die individuellen R1–R8 Use Cases für **alle process_steps die zu diesem Cluster gehören** werden NICHT generiert
- Verhindert Duplikate in der Hauptliste
- Ausnahme: Process Steps in einem Cluster der **keine** C-Rule ausgelöst hat → individuelle R-Rules laufen normal

### Acceptance Criteria (C-Rules)

- [ ] `POST /api/use-cases/generate` fetcht `process_clusters` mit `participant_count ≥ 2` + zugehörige process_steps
- [ ] C1 feuert wenn avg_frequency ≥ 5/Monat über alle Cluster-Teilnehmer
- [ ] C2 feuert wenn avg_error_rate ≥ 10% über alle Cluster-Teilnehmer
- [ ] C3 feuert wenn canonical_description search-keywords enthält UND participant_count ≥ 3
- [ ] Pro Cluster maximal 1 Use Case (höchster Score gewinnt)
- [ ] ROI = Σ(frequency × duration) aller Teilnehmer × hourly_rate × reduction_rate
- [ ] Cluster-Use-Cases haben `cluster_id` gesetzt, `process_step_id` = null
- [ ] Individuelle R1–R8 Use Cases für geclusterte Steps werden unterdrückt wenn ein C-Rule feuerte
- [ ] Bestehende 174 Unit-Tests laufen durch (kein Breaking Change an R1–R8 + P1–P3)

---

## Feature 2: Cross-Interview Pain Point Clustering (P4)

### Neue Regel P4

Ergänzt P1–P3. Gruppiert semantisch ähnliche `pain_points` über Interviews hinweg via Embedding-Similarity.

```
"Es dauert ewig die Rechnung zu finden"   → Embedding A
"Dokumente suchen kostet viel Zeit"       → Embedding B  
cosine_similarity(A, B) ≥ 0.78 → selbes Problem → 1 Workspace-Use-Case
```

**Logik:**
1. Lade alle `knowledge_objects` mit `type = 'pain_point'` + `embedding IS NOT NULL` für Workspace
2. Greedy-Clustering: Cosine Similarity ≥ 0.78 → selbe Gruppe
3. Gruppen mit ≥ 2 pain_points aus **verschiedenen Interviews** → P4-Use-Case
4. Severity-Aggregation: `max(severity)` der Gruppe bestimmt Priorität
5. Title: pain_point mit höchster Severity

| Rule | Trigger | Use Case Type | ROI-Logik |
|------|---------|--------------|-----------|
| **P4** | ≥2 semantisch ähnliche pain_points (cosine ≥ 0.78) aus verschiedenen Interviews | `cross_team_pain_resolution` | Σ(interview_count) × avg_duration_estimate × hourly_rate |

### Acceptance Criteria (P4)

- [ ] `clusterPainPointsByEmbedding()` gruppiert pain_points korrekt (cosine ≥ 0.78)
- [ ] P4 feuert nur wenn Gruppe pain_points aus ≥ 2 verschiedenen Interviews enthält
- [ ] Cosine < 0.78 → keine Gruppe, individuelle P1-P3 laufen normal
- [ ] Pain points ohne Embedding werden ignoriert (kein Fehler)
- [ ] P4-Use-Case hat `cluster_id = null`, `process_step_id = null`

---

## Feature 3: Use Case Detail View (Sheet/Drawer)

### DB Schema Erweiterung

Neue Spalten in `use_cases`:

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| `description` | text | Template-generierte Kurzzusammenfassung (bei Generation befüllt) |
| `roi_breakdown` | jsonb | `{freq, duration, hourly_rate, reduction_rate, participant_count, total_eur}` |
| `cluster_id` | uuid (nullable) | FK → process_clusters (nur bei C-Rules gesetzt) |
| `llm_insights` | jsonb (nullable) | Lazy-generated: `{business_case, implementation_approach, next_steps, risk_notes, complexity}` |

`description` ist template-generiert (kein LLM), befüllt bei `POST /api/use-cases/generate`. Beispiel:
- R1: `"Dieser Prozess läuft 20×/Monat und ist regelbasiert — Kandidat für vollständige Automatisierung. Einsparpotential: 20 × 45 Min × 45€/h = 675€/Monat."`
- C1: `"3 Mitarbeiter führen denselben Prozess durch. Workspace-weites Einsparpotential: 2.025€/Monat."`

### Neuer Endpoint: GET /api/use-cases/[id]

Enriched detail response:

```typescript
{
  use_case: { ...alle Spalten inkl. description, roi_breakdown, cluster_id, llm_insights },
  process_step: { title, description, source_quote, frequency_per_month, duration_minutes, 
                  error_rate_percent, rule_based, data_sources } | null,
  interview: { employee_name, employee_role, created_at } | null,
  cluster: {
    canonical_title, canonical_description, participant_count,
    sub_use_cases: [{  // Individuelle Analyse pro Teilnehmer (als Sub-Use-Cases)
      employee_name, employee_role,
      process_step: { title, source_quote, frequency_per_month, duration_minutes, error_rate_percent },
      roi_eur: number
    }]
  } | null
}
```

### LLM Insights — Lazy Generation

**Neuer Endpoint:** `POST /api/use-cases/[id]/insights`

1. Prüfe ob `use_cases.llm_insights IS NOT NULL` → return cached sofort
2. Falls null: LLM Call → speichere in DB → return

**LLM Output (strukturiertes JSON, auf Deutsch):**
```json
{
  "business_case": "3–4 Sätze überzeugender Business Case für den Berater",
  "implementation_approach": "Konkrete Empfehlung: Technologie + Tool + Begründung",
  "next_steps": ["Schritt 1", "Schritt 2", "Schritt 3"],
  "risk_notes": "1–2 Sätze zu Risiken und Voraussetzungen",
  "complexity": "niedrig | mittel | hoch"
}
```

**Model:** `ENRICHMENT_MODEL` env var (default: `google/gemini-3.1-flash-lite`)

### Sheet/Drawer UI

Click auf Use Case Card → Sheet öffnet von rechts. Sektionen (in Reihenfolge):

```
┌─────────────────────────────────────────────┐
│ [×]  Rechnungs-Automatisierung (Cluster)    │
│      Q1 · automation_at_scale · ROI 14.2k€  │
├─────────────────────────────────────────────┤
│ Zusammenfassung                              │
│  "3 Mitarbeiter führen denselben Prozess..." │
├─────────────────────────────────────────────┤
│ Prozess / Quelle                             │
│  Rechnungsbearbeitung                        │
│  Sarah Müller · Buchhaltung                 │
│  ❝ "Ich muss jeden Monat alle Rechnungen..." │
├─────────────────────────────────────────────┤
│ Metriken                                     │
│  20×/Mon   45 Min   8% Fehler               │
├─────────────────────────────────────────────┤
│ ROI-Berechnung                               │
│  20 × 45min × 45€/h × 70% = 472€/Mon       │
│  → 5.664€/Jahr                              │
├─────────────────────────────────────────────┤
│ KI-Analyse  [Skeleton → Text nach ~2s]      │
│  Business Case: "..."                        │
│  Empfehlung: UiPath + SAP-Connector         │
│  Komplexität: ●●○ Mittel                   │
│  Nächste Schritte:                          │
│  ✓ Prozess dokumentieren                   │
│  ✓ IT-Abteilung einbeziehen                │
│  ⚠ Risiken: Abhängig von SAP-Version      │
├─────────────────────────────────────────────┤
│ 3 Mitarbeiter · Sub-Use-Cases               │  ← nur bei Cluster-UCs
│  • Sarah Müller — 20×/Monat · ROI 4.733€  │
│  • Tom Schmidt — 15×/Monat · ROI 3.550€   │
│  • Lisa Wang — 18×/Monat · ROI 4.266€     │
└─────────────────────────────────────────────┘
```

### Acceptance Criteria (Detail View)

- [ ] Klick auf Use Case Card öffnet Sheet/Drawer von rechts
- [ ] Sheet öffnet sofort ohne Warten auf LLM
- [ ] Alle Template-Daten (Zusammenfassung, Prozess, Metriken, ROI) sofort sichtbar
- [ ] KI-Analyse Sektion zeigt Skeleton-Loader bis `POST /[id]/insights` antwortet
- [ ] Zweiter Klick auf selben Use Case → KI-Analyse sofort (gecacht, kein zweiter LLM Call)
- [ ] Bei LLM-Fehler: KI-Analyse Sektion graceful ausgeblendet, kein Crash
- [ ] Cluster-Use-Cases zeigen Sub-Use-Cases Sektion mit Teilnehmer-Liste
- [ ] Einzel-Use-Cases zeigen Sub-Use-Cases Sektion nicht
- [ ] `GET /api/use-cases/[id]` erfordert Auth + Workspace-Membership
- [ ] `POST /api/use-cases/[id]/insights` erfordert Auth + Workspace-Membership

---

## Edge Cases

- **Cluster mit nur uncompleted steps:** `participant_count ≥ 2` aber alle steps status = 'exploring' → C-Rules nicht auslösen, Steps wurden nie zu process_steps
- **Cluster-UC ohne verknüpfte process_steps:** Wenn `participants[].process_step_id` null ist → Sub-Use-Cases Sektion weglassen
- **Pain point ohne embedding:** `embedding IS NULL` in knowledge_objects → von P4-Clustering ignorieren, keine Fehler
- **Insight-Generierung für Cluster-UC ohne process_step:** LLM Input kommt aus `cluster.canonical_description` + `participants` statt aus process_step
- **Gleichzeitiger Generate-Call:** Idempotenz durch delete-then-insert Pattern (wie PROJ-6 heute) — Cluster-UCs werden bei jedem Generate-Aufruf neu berechnet
- **Leerer Workspace (keine Cluster):** C-Rules laufen nicht, R-Rules + P-Rules laufen wie bisher → kein Fehler
- **Alle pain_points ohne Embeddings:** P4 generiert keine Use Cases, P1–P3 laufen normal

---

## Technical Requirements

- `POST /api/use-cases/generate` Performance: < 5s (bisher < 2s, neue Fetches + P4-Clustering akzeptieren etwas mehr)
- `GET /api/use-cases/[id]`: < 300ms (reiner DB-Join, kein LLM)
- `POST /api/use-cases/[id]/insights`: < 8s (LLM Call, Skeleton zeigt Fortschritt)
- Rate Limiting: `/insights` Endpoint nutzt bestehende Rate-Limiting-Infrastruktur (PROJ-12)
- Bestehende 174 Unit-Tests müssen weiterhin bestehen

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

## Post-Mortem
_To be added by /deploy_

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: L / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
