# PROJ-24: Cluster-aware Use Case Generation + Detail View

## Status: Approved
**Type:** Extension
**Domain:** Use Case Engine
**Extends:** PROJ-6
**Appetite:** L
**Bugs:** 0:0:2
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

### Komponentenstruktur (Frontend)

```
UseCaseBoardClient (existiert — selectedId State hinzufügen)
+-- UseCaseCard (existiert — onClick Handler + Cluster-Badge hinzufügen)
+-- UseCaseSheet (NEU — shadcn Sheet, bereits installiert)
    +-- SheetHeader
    |   +-- Titel + Typ-Badge + Quartal-Badge
    |   +-- ROI gesamt (fett, groß)
    +-- SummarySection
    |   +-- Template-generierte Zusammenfassung (sofort sichtbar)
    +-- ProcessSection
    |   +-- Einzel-UC: Prozessname + Mitarbeitername/-rolle + Originalzitat
    |   +-- Cluster-UC: Cluster-Titel + canonical_description Auszug
    +-- MetricsGrid (NEU)
    |   +-- Frequenz-Badge · Dauer-Badge · Fehlerrate-Badge
    +-- RoiBreakdown (NEU)
    |   +-- Formel-Darstellung: Freq × Dauer × Stundensatz × Reduktion = €/Monat
    |   +-- Bei Cluster-UC: + Teilnehmerzahl in Formel
    +-- InsightsSection (NEU)
    |   +-- Skeleton-Loader während LLM-Call (~2s)
    |   +-- Business Case Text
    |   +-- Implementierungsempfehlung + Komplexitäts-Indikator
    |   +-- Nächste Schritte (3 Bullets)
    |   +-- Risiko-Hinweis
    +-- ParticipantList (NEU — nur bei Cluster-UCs)
        +-- Anzahl Mitarbeiter + Headline
        +-- Pro Teilnehmer: Name, Rolle, Frequenz, ROI
```

**Wichtig:** `sheet.tsx` und `skeleton.tsx` sind bereits installiert (shadcn/ui). Keine neuen Pakete nötig.

---

### Datenbankänderungen

**Tabelle:** `use_cases` (existiert) — 4 neue Spalten:

| Spalte | Was gespeichert wird |
|--------|---------------------|
| `description` | Kurzzusammenfassung in Deutsch, template-generiert bei Use Case Erstellung (kein LLM) |
| `roi_breakdown` | Alle Zahlen für die ROI-Berechnung: Frequenz, Dauer, Stundensatz, Reduktionsrate, Teilnehmerzahl |
| `cluster_id` | Verweis auf den Prozess-Cluster (nur bei Cluster-Use-Cases gesetzt, sonst leer) |
| `llm_insights` | KI-Analyse: Business Case, Empfehlung, Nächste Schritte, Risiken — nur nach erstem Klick befüllt |

Keine neuen Tabellen. Keine Änderungen an anderen Tabellen.

---

### Backend — 3 Schichten

#### Schicht 1: Erweiterter Generate-Prozess

`POST /api/use-cases/generate` (existiert — erweitert)

**Was sich ändert:** Zwei zusätzliche Datenbankabfragen beim Start:
1. Lade alle Prozess-Cluster mit ≥ 2 Teilnehmern + deren Process Steps
2. Lade alle pain_points mit Embeddings (für P4-Clustering)

**Ablauf danach:**

```
Cluster-Regeln (C1–C3) zuerst auswerten
    ↓
Merken: welche Process Steps sind durch Cluster-UCs abgedeckt?
    ↓
Einzel-Regeln (R1–R8) auswerten — covered Steps überspringen
    ↓
P4: pain_points nach Ähnlichkeit gruppieren → Use Cases daraus
    ↓
P1–P3: normal pro Interview (unverändert)
    ↓
Für jeden Use Case: description + roi_breakdown berechnen und speichern
```

Idempotenz bleibt erhalten: Bei erneutem Aufruf werden alle Use Cases des Workspace gelöscht und neu berechnet (wie heute).

#### Schicht 2: Detail-Endpoint (neu)

`GET /api/use-cases/[id]`

Gibt einen Use Case mit allen verknüpften Daten zurück:
- Use Case Stammdaten (inkl. description, roi_breakdown)
- Process Step + Mitarbeiterdaten (falls Einzel-UC)
- Cluster-Daten + Sub-Use-Cases pro Teilnehmer (falls Cluster-UC)

Reine Datenbankabfrage — kein LLM, kein Warten. Ziel: < 300ms.

#### Schicht 3: Insights-Endpoint (neu, lazy)

`POST /api/use-cases/[id]/insights`

**Cache-first Logik:**
1. Ist `llm_insights` bereits befüllt? → Sofort zurückgeben
2. Nein → LLM Call mit vollem Kontext → In DB speichern → Zurückgeben

Der LLM erhält: Use Case Typ + Regel, Prozess-Beschreibung, Originalzitat, Metriken, Mitarbeiterdaten, und bei Cluster-UCs die cross-employee Analyse.

**Neuer Service:** `src/services/useCaseInsights.ts` — isoliert die LLM-Logik vom API-Endpoint. Nutzt `ENRICHMENT_MODEL` env var (google/gemini-3.1-flash-lite by default).

---

### Geänderte Dateien

| Datei | Art der Änderung |
|-------|-----------------|
| `supabase/migrations/YYYYMMDD_proj24_use_cases_enrichment.sql` | NEU — 4 neue Spalten in use_cases |
| `src/services/useCaseEngine.ts` | ERWEITERT — runClusterRules() + clusterPainPointsByEmbedding() hinzufügen |
| `src/app/api/use-cases/generate/route.ts` | ERWEITERT — Cluster- + pain_point-Fetch, Suppression-Logik |
| `src/app/api/use-cases/[id]/route.ts` | NEU — Detail-Endpoint |
| `src/app/api/use-cases/[id]/insights/route.ts` | NEU — Insights-Endpoint |
| `src/services/useCaseInsights.ts` | NEU — LLM Insights Service |
| `src/components/UseCaseBoardClient.tsx` | ERWEITERT — selectedId State + UseCaseSheet einbinden |
| `src/components/UseCaseCard.tsx` | ERWEITERT — onClick Handler + Cluster-Badge |
| `src/components/UseCaseSheet.tsx` | NEU — Sheet/Drawer Hauptkomponente |
| `src/components/MetricsGrid.tsx` | NEU — Metriken-Badges |
| `src/components/RoiBreakdown.tsx` | NEU — ROI-Formel Darstellung |
| `src/components/ParticipantList.tsx` | NEU — Sub-Use-Cases für Cluster-UCs |

---

### Technische Entscheidungen

**Suppression statt Deduplication bei Cluster-UCs**
Wenn ein Cluster-UC für einen Prozess existiert, werden individuelle UCs für dieselben Steps nicht generiert. Alternative wäre, alle zu generieren und bei der Anzeige zu deduplizieren — aber Suppression bei der Generierung ist deterministischer und einfacher zu testen.

**Template-Description statt LLM bei Generate**
Bei `POST /generate` werden ggf. 10–20 Use Cases auf einmal erstellt. Für jeden einen LLM-Call zu machen würde den Endpoint auf 30–60 Sekunden verlangsamen. Templates sind sofort und konsistent.

**Lazy Insights statt Eager**
Der KI-Berater öffnet in einer Session typischerweise 3–5 Use Cases im Detail, aber ein Workspace kann 15–30 Use Cases haben. Lazy Generierung spart ~75% der LLM-Calls. Caching in der DB stellt sicher, dass der Nutzer nur einmal wartet.

**Greedy In-Memory Clustering für P4 (Pain Points)**
Pain Points sind klein in der Anzahl (typisch < 50 pro Workspace im MVP). Ein einfaches In-Memory Verfahren mit Cosine-Similarity reicht — keine neue Datenbank-Infrastruktur oder RPC-Funktion nötig.

**Sheet statt Modal für Detail View**
Ein Sheet lässt die Use Case Liste im Hintergrund sichtbar. Der Berater kann den Sheet schließen und direkt den nächsten Use Case öffnen — besser für Vergleichsworkflows als ein blockierendes Modal.

---

### Neue Abhängigkeiten

Keine. Alle benötigten shadcn/ui Komponenten (Sheet, Skeleton, Badge, Card) sind bereits installiert.

## Implementation Notes (Backend)

### DB Schema
Migration `20260531000000_proj24_use_cases_enrichment.sql` applied:
- `process_step_id` dropped NOT NULL (cluster UCs have null)
- `cluster_id uuid` FK → process_clusters
- `roi_breakdown jsonb` — structured ROI data stored at generate time
- `llm_insights jsonb` — lazy-cached LLM analysis

### New / Changed Files
- `src/services/useCaseEngine.ts` — C1–C3 cluster rules, P4 pain point clustering, new types (`ClusterContext`, `RoiBreakdown`, `PainPointForP4`), `clusterPainPointsByEmbedding()` exported, removed score cap (DB is numeric(12,2))
- `src/app/api/use-cases/generate/route.ts` — fetches clusters + pain_point embeddings, passes to engine
- `src/app/api/use-cases/[id]/route.ts` — NEW: detail endpoint with process_step + interview + cluster sub-use-cases
- `src/app/api/use-cases/[id]/insights/route.ts` — NEW: cache-first LLM insights endpoint
- `src/services/useCaseInsights.ts` — NEW: LLM insights generation via `generateObject`
- `src/lib/ratelimit.ts` — added `insightsLimiter` (60 req/h) + `checkUserLimitInsights`

### Tests
318/318 tests pass. New: `id.test.ts` (5), `insights.test.ts` (5). Existing engine + generate tests updated for new fields.

### Deviations from Spec
- Score cap (999.99) removed since DB column already `numeric(12,2)` — test updated accordingly
- `roi_hours_per_year` computed for cluster UCs (Σ participant hours) rather than null

## Implementation Notes (Frontend)

### New Components
- `src/components/UseCaseSheet.tsx` — Sheet/Drawer that opens on card click. Fetches detail + insights in parallel. Shows skeleton while insights load. Gracefully handles LLM errors.
- `src/components/MetricsGrid.tsx` — Displays frequency/duration/error rate as metric tiles.
- `src/components/RoiBreakdown.tsx` — Renders ROI formula (freq × duration × rate × reduction = €/Mon → €/Jahr). Shows Σ participant count for cluster UCs.
- `src/components/ParticipantList.tsx` — Sub-use-case list per cluster participant (only shown for cluster UCs).

### Changed Components
- `src/components/UseCaseCard.tsx` — Added `onClick` prop, cluster badge (purple), new type icons + labels for C-rule types.
- `src/components/UseCaseBoardClient.tsx` — Added `selectedUseCase` state, `UseCaseSheet` integration.

### DB Types
- `src/lib/database.types.ts` — Updated `use_cases` table with 4 new columns: `cluster_id`, `roi_breakdown`, `llm_insights`, nullable `process_step_id`. Kept interface format (no `__InternalSupabase`) to preserve pre-existing type-check behavior.

### Deviations from Spec
- `roi_breakdown` typed as `unknown` in client-side UseCase types (DB returns `Json`), cast to `RoiBreakdownData` at the RoiBreakdown component boundary.
- `maxTokens` → `maxOutputTokens` in `useCaseInsights.ts` (backend bug fixed during frontend pass).

## QA Test Results

**Date:** 2026-05-31 (re-QA: 2026-05-31)
**Tester:** /qa  
**Status:** APPROVED — all High/Medium bugs fixed

### Acceptance Criteria

#### Feature 1: Cluster Rules (C1–C3)
| # | Criterion | Result |
|---|-----------|--------|
| 1 | `POST /generate` fetches `process_clusters` ≥2 | ✅ Pass |
| 2 | C1 fires when avg_frequency ≥ 5/month | ✅ Pass (unit tested) |
| 3 | C2 fires when avg_error_rate ≥ 10% | ✅ Pass (unit tested) |
| 4 | C3 fires when canonical_description has search keywords + participant_count ≥ 3 | ✅ Pass (unit tested) |
| 5 | Per cluster max 1 UC (highest score wins) | ✅ Pass (unit tested) |
| 6 | ROI = Σ(freq × duration) × hourly_rate × reduction_rate | ✅ Pass |
| 7 | Cluster UCs have `cluster_id` set, `process_step_id = null` | ✅ Pass |
| 8 | Indiv. R1–R8 for clustered steps suppressed | ✅ Pass (unit tested) |
| 9 | Existing 174 unit tests pass | ✅ Pass (318 now pass) |

#### Feature 2: P4 Cross-Interview Pain Point Clustering
| # | Criterion | Result |
|---|-----------|--------|
| 1 | `clusterPainPointsByEmbedding()` groups correctly (cosine ≥ 0.78) | ✅ Pass (unit tested) |
| 2 | P4 fires only when ≥2 different interviews | ✅ Pass (unit tested) |
| 3 | Cosine < 0.78 → no group | ✅ Pass (unit tested) |
| 4 | Pain points without embedding ignored | ✅ Pass (unit tested) |
| 5 | P4-UC has `cluster_id = null`, `process_step_id = null` | ✅ Pass (fixed in re-QA) |

#### Feature 3: Detail View (Sheet)
| # | Criterion | Result |
|---|-----------|--------|
| 1 | Click on card opens Sheet from right | ✅ Pass (impl. verified) |
| 2 | Sheet opens immediately without LLM | ✅ Pass (parallel fetch) |
| 3 | Template data (summary, process, metrics, ROI) immediately visible | ✅ Pass |
| 4 | KI-Analyse shows skeleton until insights respond | ✅ Pass |
| 5 | Second click on same UC → KI-Analyse cached (no second LLM call) | ✅ Pass (cache-first endpoint) |
| 6 | LLM error → KI-Analyse section gracefully hidden, no crash | ✅ Pass (`insightsError` state) |
| 7 | Cluster-UCs show Sub-Use-Cases section | ✅ Pass |
| 8 | Individual UCs → Sub-Use-Cases section absent | ✅ Pass |
| 9 | `GET /api/use-cases/[id]` requires auth + workspace membership | ✅ Pass (unit + E2E) |
| 10 | `POST /api/use-cases/[id]/insights` requires auth + workspace membership | ✅ Pass (unit + E2E) |

### Bugs Found

#### BUG-1 (High): TypeScript build failure — regression in process-steps/page.tsx ✅ FIXED
- **File:** `src/lib/database.types.ts`, `src/components/ProcessStepsTable.tsx`
- **Fix applied:** Added `process_steps_cluster_id_fkey` to `process_steps.Relationships`. Also widened `ProcessStep.substeps` and `ProcessCluster.participants` to `unknown` (DB returns `Json`; cast preserved at usage).
- **Verification:** `npm run lint` passes, `npm test` 338/338 green.

#### BUG-2 (Medium): P4 use cases had wrong `process_step_id` ✅ FIXED
- **File:** `src/services/useCaseEngine.ts`, Phase 4
- **Fix applied:** `p4uc.process_step_id = null` override after `makeQualitativeUC`. Spec AC now verified by existing unit test.
- **Verification:** `npm test` 338/338 green; P4 AC row updated to ✅ Pass.

#### BUG-3 (Low): Minor IDOR information leak in new endpoints
- **Files:** `src/app/api/use-cases/[id]/route.ts`, `src/app/api/use-cases/[id]/insights/route.ts`
- **Symptom:** Admin client fetches UC before checking workspace membership. Authenticated users from other workspaces see 403 (UC exists) vs 404 (UC doesn't exist) — leaks UC existence.
- **Impact:** Low — UUIDs are hard to guess; consistent with other project endpoints.
- **Fix:** Use `supabase` (user client with RLS) instead of `admin` for the initial UC fetch, or combine workspace check into the query.

#### BUG-4 (Low): E2E signup flow fails in test environment
- **Symptom:** Playwright signup test times out waiting for `/dashboard` redirect (15s)
- **Pre-existing?** Yes — same failure in PROJ-6 E2E tests; API auth guard tests pass correctly
- **Impact:** UI regression tests can't auto-run in CI without fixing the auth flow setup

### Test Artifacts
- **Unit tests:** 20 new tests added to `src/services/useCaseEngine.test.ts` covering C1-C3, suppression, `clusterPainPointsByEmbedding`, and P4 rules. 338/338 pass.
- **E2E tests:** `tests/PROJ-24-cluster-use-case-detail.spec.ts` — 3/8 API auth guard tests pass; 4 UI tests skip due to pre-existing signup environment issue.

### Security Audit
- Auth guards: ✅ Both new endpoints require authentication
- Workspace membership: ✅ Both endpoints verify membership
- Rate limiting: ✅ `/insights` uses `checkUserLimitInsights` (60 req/h)
- Input validation: ✅ UUID params validated by Next.js dynamic routes
- Minor IDOR: see BUG-3 (Low)

### Production-Ready Decision
**READY** — BUG-1 and BUG-2 fixed. Remaining: 2 Low bugs (BUG-3 minor IDOR, BUG-4 pre-existing E2E env). Both acceptable for MVP deploy.

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
