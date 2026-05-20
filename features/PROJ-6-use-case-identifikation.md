# PROJ-6: Use Case Identifikation

## Status: Planned
**Created:** 2026-05-20
**Last Updated:** 2026-05-20

## Dependencies
- Requires: PROJ-1 (Auth + Workspace) — Auth, workspace_id, RLS
- Requires: PROJ-5 (Prozessschritt-Anreicherung) — `process_steps` mit quantitativen Attributen als Input

## User Stories
- Als Berater generiere ich aus Prozessschritten automatisch priorisierte KI Use Cases — ohne manuelle Analyse.
- Als Berater sehe ich Use Cases als Karten mit Typ, ROI €/Jahr, Aufwand und Priorität.
- Als Berater erkenne ich auf einen Blick welche Use Cases Quick Wins sind (hohes ROI, geringer Aufwand).
- Als Berater sehe ich den Gesamt-ROI aller Use Cases des Workspaces auf einen Blick.
- Als Berater sehe ich eine Quartals-Roadmap: welche Use Cases wann angegangen werden sollten.

## Acceptance Criteria

### Heuristik-Engine (regelbasiert — kein LLM)

Alle Regeln laufen serverbasiert auf `process_steps`. Pro Prozessschritt kann maximal ein Use Case pro Typ generiert werden — kein doppelter `automation`-Use-Case (Rules 1 und 4 schließen sich gegenseitig aus). Rules 2, 3 und 5 sind unabhängig und können gleichzeitig feuern.

**Regel 1 — Vollautomatisierung:**
- [ ] Trifft zu wenn: `frequency_per_month ≥ 20` UND `rule_based = true` UND (`error_rate_percent IS NULL` ODER `error_rate_percent < 10`)
- [ ] Typ: `automation`, Effort: `low`
- [ ] ROI: `(frequency_per_month × duration_minutes / 60) × 12 × 0.85 × hourly_rate`

**Regel 2 — LLM-Extraktion:**
- [ ] Trifft zu wenn: `data_sources` enthält eines von `['E-Mail', 'PDF', 'Word', 'email', 'pdf', 'word']` (case-insensitive) UND `duration_minutes ≥ 15`
- [ ] Typ: `llm_extraction`, Effort: `medium`
- [ ] ROI: `(frequency_per_month × duration_minutes / 60) × 12 × 0.40 × hourly_rate`

**Regel 3 — Entscheidungsunterstützung:**
- [ ] Trifft zu wenn: `rule_based = false` UND `duration_minutes ≥ 30` UND `error_rate_percent ≥ 10`
- [ ] Typ: `decision_support`, Effort: `high`
- [ ] ROI: `(frequency_per_month × duration_minutes / 60) × 12 × 0.40 × hourly_rate`

**Regel 4 — Medienbruch-Automatisierung:**
- [ ] Trifft zu wenn: `media_breaks ≥ 3` UND Regel 1 trifft NICHT zu (verhindert doppelten `automation`-Use-Case)
- [ ] Typ: `automation`, Effort: `low`
- [ ] ROI: `(frequency_per_month × duration_minutes / 60) × 12 × 0.60 × hourly_rate`

**Regel 5 — RAG Wissensassistent:**
- [ ] Trifft zu wenn: `description` oder `title` enthält eines von `['suchen', 'nachschlagen', 'klären', 'prüfen', 'finden', 'recherchieren']` (case-insensitive) UND `duration_minutes ≥ 10`
- [ ] Typ: `rag`, Effort: `medium`
- [ ] ROI: `(frequency_per_month × duration_minutes / 60) × 12 × 0.50 × hourly_rate`

### ROI-Berechnung (für alle Regeln gleich)
- [ ] `hourly_rate` kommt aus `workspaces.hourly_rate` (Default: 45 €/h)
- [ ] Wenn `frequency_per_month IS NULL` oder `duration_minutes IS NULL` → Regel trifft NICHT zu (kein Raten)
- [ ] ROI wird auf 2 Dezimalstellen gerundet

### Scoring + Priorisierung
- [ ] `score = roi_eur_per_year / effort_factor` (effort_factor: low=1, medium=2, high=3)
- [ ] `priority`: score > 5.000 → `high`, score 1.001–5.000 → `medium`, score ≤ 1.000 → `low`
- [ ] `quarter`: score > 5.000 → `Q1`, score 1.001–5.000 → `Q2`, score ≤ 1.000 → `Q3`
- [ ] Use Cases sortiert nach `score desc`

### Idempotenz + Re-Generierung
- [ ] `POST /api/use-cases/generate` löscht vorhandene Use Cases für den Workspace und generiert neu (idempotent)
- [ ] Threshold-Werte sind Konstanten im Code — änderbar ohne Datenmigration

### API
- [ ] `POST /api/use-cases/generate` — Body: `{ workspace_id }`, Response: `{ use_cases[], total_roi_eur }`
- [ ] `GET /api/use-cases?workspace_id=xxx` — Response: `{ use_cases[] }` sortiert nach score desc
- [ ] `GET /api/use-cases/roadmap?workspace_id=xxx` — Response: `{ Q1: [], Q2: [], Q3: [], total_roi_eur }`
- [ ] Alle Endpoints: Auth-Session + Workspace-Zugehörigkeit erforderlich

### UI — Use Case Board
- [ ] Seite `/dashboard/use-cases` mit Header (Gesamt-ROI oben)
- [ ] Use Case Karte zeigt: Typ-Icon, Titel, Prozessschritt-Quelle, ROI €/Jahr, Aufwand-Badge, Priorität-Badge
- [ ] **Quick Win Badge** auf Karte wenn `priority = high` UND `effort = low`
- [ ] Karten sortiert nach Score (höchster zuerst)
- [ ] "Use Cases generieren"-Button triggert `POST /api/use-cases/generate`
- [ ] Loading State während Generierung
- [ ] Leerer Zustand: "Keine Use Cases. Stelle sicher dass Prozessschritte angereichert sind, dann klicke Generieren."

### UI — Quartals-Roadmap
- [ ] Unterseite oder Tab `/dashboard/use-cases/roadmap`
- [ ] Spalten Q1 / Q2 / Q3 mit Use Case Karten je Quartal
- [ ] Gesamt-ROI pro Quartal-Spalte sichtbar

## Edge Cases

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Prozessschritt hat `frequency_per_month = null` | Keine Regel trifft zu — kein Use Case generiert |
| Mehrere Regeln treffen auf denselben Prozessschritt zu | Mehrere Use Cases werden erstellt (einer pro Regel) |
| Workspace hat keine Prozessschritte | Generate läuft, 0 Use Cases, kein Fehler |
| `hourly_rate` nicht gesetzt | Fallback auf Default 45 €/h |
| Workspace gehört nicht dem angemeldeten User | 403 |
| Generate erneut aufrufen | Vorherige Use Cases werden gelöscht und neu generiert |

## Technical Requirements
- Heuristik-Engine: pure TypeScript-Funktion in `src/services/useCaseEngine.ts` — kein LLM, kein External-Service
- Schwellenwerte als exportierte Konstanten (einfach anpassbar)
- Alle Berechnungen server-seitig — Client empfängt nur Ergebnisse
- Security: Auth + Workspace-Isolation auf allen Endpoints

## Out of Scope
- Manuelle Anlage von Use Cases
- Bearbeitung von Use Cases in UI (read-only in MVP)
- Drag & Drop zwischen Quartalen
- Export als PDF/Excel

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
