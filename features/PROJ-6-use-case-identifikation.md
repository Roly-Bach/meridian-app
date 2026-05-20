# PROJ-6: Use Case Identifikation

## Status: Approved
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

Alle Regeln laufen serverbasiert auf `process_steps`. Pro Prozessschritt und Typ maximal ein Use Case — bei Konflikt gewinnt die Regel mit höherem ROI. Ein Prozessschritt kann mehrere Use Cases unterschiedlichen Typs bekommen.

**Regel 1 — Vollautomatisierung:**
> Gleichförmige, häufige Prozesse können vollständig durch Software übernommen werden.
> 85% Zeitersparnis weil kein menschliches Eingreifen mehr nötig.
> Effort `low` weil RPA/Scripting-Tools dafür ausgereift sind.
- [ ] Trifft zu wenn: `frequency_per_month ≥ 20` UND `rule_based = true` UND (`error_rate_percent IS NULL` ODER `error_rate_percent < 10`)
- [ ] Typ: `automation`, Effort: `low`
- [ ] ROI: `(frequency_per_month × duration_minutes / 60) × 12 × 0.85 × hourly_rate`

**Regel 2 — LLM-Extraktion:**
> Unstrukturierte Dokumente (E-Mails, PDFs, Word) enthalten Informationen die manuell herausgelesen werden.
> Ein LLM kann das automatisch — spart ~40% der Bearbeitungszeit (Rest: Prüfung + Ausnahmen).
> Effort `medium` weil Prompt-Engineering + Validierungslogik nötig ist.
- [ ] Trifft zu wenn: `data_sources` enthält eines von `['E-Mail', 'PDF', 'Word', 'email', 'pdf', 'word']` (case-insensitive) UND `duration_minutes ≥ 15`
- [ ] Typ: `llm_extraction`, Effort: `medium`
- [ ] ROI: `(frequency_per_month × duration_minutes / 60) × 12 × 0.40 × hourly_rate`

**Regel 3 — Entscheidungsunterstützung:**
> Prozesse ohne feste Regel brauchen menschliches Urteil — aber KI kann Empfehlungen geben und Fehler reduzieren.
> Hohe Fehlerrate (≥10%) zeigt: hier läuft etwas schief, KI kann helfen.
> Effort `high` weil Change Management + Modell-Training + Validierung aufwändig sind.
> 40% Ersparnis = kürzere Entscheidungszeit + weniger Nacharbeit durch Fehler.
- [ ] Trifft zu wenn: `rule_based = false` UND `duration_minutes ≥ 30` UND `error_rate_percent ≥ 10`
- [ ] Typ: `decision_support`, Effort: `high`
- [ ] ROI: `(frequency_per_month × duration_minutes / 60) × 12 × 0.40 × hourly_rate`

**Regel 4 — Medienbruch-Automatisierung:**
> Medienbruch = Mitarbeiter überträgt Daten manuell zwischen zwei Systemen die nicht verbunden sind.
> ("Ich schaue in SAP nach und tippe das in Excel ab" = 1 Medienbruch)
> Ab 3 Medienbrüchen: Schnittstellen-Automatisierung oder RPA lohnt sich klar.
> 60% statt 85%: Prozess nicht vollständig regelbasiert, aber Datentransfer automatisierbar.
> Bei Konflikt mit Regel 1 (selber Typ `automation`): höherer ROI gewinnt.
- [ ] Trifft zu wenn: `media_breaks ≥ 3`
- [ ] Typ: `automation`, Effort: `low`
- [ ] ROI: `(frequency_per_month × duration_minutes / 60) × 12 × 0.60 × hourly_rate`

**Regel 5 — RAG Wissensassistent:**
> Mitarbeiter verbringen Zeit mit Suchen: in Handbüchern, Datenbanken, Kolleginnen fragen.
> Ein RAG-System (Retrieval-Augmented Generation) beantwortet diese Fragen sofort aus dem Unternehmenswissen.
> 50% Ersparnis = Hälfte der Suchzeit entfällt, Rest bleibt für komplexe Fragen.
> Effort `medium` weil Wissensbasis aufgebaut und gepflegt werden muss.
- [ ] Trifft zu wenn: `description` oder `title` enthält eines von `['suchen', 'nachschlagen', 'klären', 'prüfen', 'finden', 'recherchieren']` (case-insensitive) UND `duration_minutes ≥ 10`
- [ ] Typ: `rag`, Effort: `medium`
- [ ] ROI: `(frequency_per_month × duration_minutes / 60) × 12 × 0.50 × hourly_rate`

**Regel 6 — Fehlerhafte Regelautomatisierung:**
> Prozess hat feste Regeln — aber trotzdem hohe Fehlerrate. Symptom: Regeln werden nicht konsequent eingehalten oder sind zu komplex für manuelle Durchführung.
> KI setzt Regeln strenger und konsistenter durch als Menschen — eliminiert Flüchtigkeitsfehler.
> Unterschied zu R1: R1 schließt error_rate ≥ 10 aus. R6 deckt genau diesen Fall ab.
> Effort `medium` weil die bestehende Logik analysiert und korrigiert werden muss.
- [ ] Trifft zu wenn: `rule_based = true` UND `frequency_per_month ≥ 5` UND `error_rate_percent ≥ 10`
- [ ] Typ: `automation`, Effort: `medium`
- [ ] ROI: `(frequency_per_month × duration_minutes / 60) × 12 × 0.60 × hourly_rate`

**Regel 7 — KI-unterstützte Routinearbeit:**
> Wiederkehrende Tätigkeiten ohne feste Regel die gut funktionieren — aber manuell aufwändig sind.
> Kein Fehler-Signal → KI muss nicht korrigieren, sondern unterstützen und beschleunigen.
> Unterschied zu R3: R3 braucht error_rate ≥ 10. R7 deckt gut laufende, repetitive Arbeit ab.
> 30% weil kein vollständiges Regelwerk → KI übernimmt Teile, Mensch bleibt im Loop.
- [ ] Trifft zu wenn: `rule_based = false` UND `frequency_per_month ≥ 10` UND `duration_minutes ≥ 20` UND `(error_rate_percent IS NULL ODER error_rate_percent < 10)`
- [ ] Typ: `llm_extraction`, Effort: `medium`
- [ ] ROI: `(frequency_per_month × duration_minutes / 60) × 12 × 0.30 × hourly_rate`

**Regel 8 — Daten-Aggregation für Entscheidungen:**
> Lange Entscheidungsprozesse die gut funktionieren — aber viel Zeit geht fürs Zusammensuchen der Datenbasis drauf.
> KI aggregiert alle relevanten Daten und bereitet die Entscheidungsgrundlage vor — Mensch entscheidet weiterhin.
> Unterschied zu R3: R3 braucht error_rate ≥ 10. Unterschied zu R5: R5 braucht Suchbegriffe im Titel/Beschreibung.
- [ ] Trifft zu wenn: `rule_based = false` UND `duration_minutes ≥ 30` UND `(error_rate_percent IS NULL ODER error_rate_percent < 10)` UND KEIN Suchwort-Match aus Regel 5
- [ ] Typ: `rag`, Effort: `medium`
- [ ] ROI: `(frequency_per_month × duration_minutes / 60) × 12 × 0.40 × hourly_rate`

### Coverage-Matrix — alle relevanten KI-Fälle

| Praxisfall | Regel |
|------------|-------|
| Täglich gleiche Aufgabe, fehlerfrei | R1 — Vollautomatisierung |
| Täglich gleiche Aufgabe, trotzdem Fehler | R6 — Fehlerhafte Regelautomatisierung |
| Dokumente lesen und Infos herausziehen | R2 — LLM-Extraktion |
| Daten manuell zwischen Systemen übertragen | R4 — Medienbruch-Automatisierung |
| Komplexe Entscheidung mit hoher Fehlerrate | R3 — Entscheidungsunterstützung |
| Komplexe Entscheidung, gut, aber dauert lang | R8 — Daten-Aggregation |
| Suchen, Nachschlagen, Klären | R5 — RAG Wissensassistent |
| Wiederkehrend, nicht regelbasiert, läuft gut | R7 — KI-unterstützte Routinearbeit |

### ROI-Berechnung (für alle Regeln gleich)
> Stunden/Jahr = wie viel Arbeitszeit dieser Prozess jährlich bindet.
> Reduktionsrate = wie viel davon KI übernehmen kann (je nach Automatisierbarkeit).
> Ergebnis in € = direkt vergleichbar mit Implementierungskosten.
- [ ] `hourly_rate` kommt aus `workspaces.hourly_rate` (Default: 45 €/h)
- [ ] Wenn `frequency_per_month IS NULL` oder `duration_minutes IS NULL` → Regel trifft NICHT zu (kein Raten ohne Datenbasis)
- [ ] ROI wird auf 2 Dezimalstellen gerundet

### Scoring + Priorisierung
> Score normiert ROI auf den Implementierungsaufwand — zeigt welche Use Cases das beste Verhältnis haben.
> Wer viel spart und wenig kostet, kommt zuerst.
- [ ] `score = roi_eur_per_year / effort_factor` (effort_factor: low=1, medium=2, high=3)
- [ ] `priority`: score > 5.000 → `high`, score 1.001–5.000 → `medium`, score ≤ 1.000 → `low`
- [ ] `quarter`: score > 5.000 → `Q1` (Quick Win, sofort starten), score 1.001–5.000 → `Q2`, score ≤ 1.000 → `Q3`
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

### Datenfluss

```
Berater klickt "Use Cases generieren"
        ↓
POST /api/use-cases/generate
        ↓
Workspace-Autorisierung
        ↓
Alle process_steps des Workspaces laden
        ↓
src/services/useCaseEngine.ts (pure TypeScript, kein LLM)
  Für jeden process_step: alle 8 Regeln prüfen
  Pro Typ nur ein Use Case (höchster ROI gewinnt)
  ROI berechnen → Score berechnen → Quarter zuweisen
  Output: use_cases[]
        ↓
Vorhandene Use Cases des Workspaces löschen
        ↓
Neue Use Cases in DB schreiben
        ↓
Response: { use_cases[], total_roi_eur }
```

### Neue Dateien

```
src/
├── services/
│   └── useCaseEngine.ts          NEU — 8 Regeln, ROI/Score/Quarter-Logik
│                                       exportierte Konstanten (Schwellenwerte)
├── app/api/
│   └── use-cases/
│       ├── generate/route.ts     NEU — POST: Generate + Delete + Insert
│       ├── route.ts              NEU — GET: Liste nach workspace_id
│       └── roadmap/route.ts      NEU — GET: Q1/Q2/Q3 gruppiert
└── app/dashboard/
    ├── use-cases/page.tsx        NEU — Use Case Board
    └── use-cases/roadmap/page.tsx NEU — Quartals-Roadmap
```

### Komponenten-Struktur (UI)

```
/dashboard/use-cases
├── Header: Titel + Gesamt-ROI + Generieren-Button + Roadmap-Link
├── [Leer-Zustand] "Keine Use Cases..."
├── [Loading Skeleton]
└── Use Case Karten-Grid (3 Spalten)
    └── UseCaseCard
        ├── Typ-Icon (⚡/📄/🎯/🔍) + Typ-Label
        ├── Titel + Prozessschritt-Quelle
        ├── ROI €/Jahr
        ├── Aufwand-Badge + Priorität-Badge
        └── [Quick Win Badge] wenn priority=high UND effort=low

/dashboard/use-cases/roadmap
└── 3-Spalten: Q1 / Q2 / Q3
    ├── Spalten-ROI je Quartal
    └── UseCaseCard (mini) je Quartal
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Engine in Service | Pure TypeScript-Funktion | Kein LLM nötig — Regeln deterministisch, testbar, keine API-Kosten |
| Delete-before-insert | Vorher löschen, dann neu | Idempotenz: sauberer Stand bei jedem Generate |
| Schwellenwerte als Konstanten | Exportierte Variablen | Änderung = 1 Zeile Code, kein DB-Eingriff |
| Roadmap als eigene Route | `GET /api/use-cases/roadmap` | Backend liefert fertig Q1/Q2/Q3 — Client muss nicht gruppieren |

### Neue Dependencies

Keine — shadcn Card, Badge, Skeleton bereits installiert.

## QA Test Results

**QA Date:** 2026-05-20
**Test Suite:** 104 unit/integration tests (23 engine pure-function tests, 5+5+5 API route tests, 5 roadmap route tests)

### Acceptance Criteria

| Kriterium | Status | Notiz |
|-----------|--------|-------|
| R1 Vollautomatisierung — Bedingungen | ✅ PASS | freq≥20, rule_based=true, error<10 |
| R1 — ROI 85% | ✅ PASS | Getestet: 22×1h×12×0.85×45 = 10.098€ |
| R2 LLM-Extraktion — Dokumentquellen | ✅ PASS | Case-insensitive E-Mail/PDF/Word |
| R2 — ROI 40% | ✅ PASS | |
| R3 Entscheidungsunterstützung | ✅ PASS | rule_based=false, duration≥30, error≥10 |
| R3 — ROI 40%, Effort high | ✅ PASS | |
| R4 Medienbruch-Automatisierung | ✅ PASS | media_breaks≥3 |
| R4 — ROI 60% | ✅ PASS | |
| R5 RAG Wissensassistent — Keywords | ✅ PASS | Case-insensitive, title+description |
| R5 — ROI 50% | ✅ PASS | |
| R6 Fehlerhafte Regelautomatisierung | ✅ PASS | rule_based=true, freq≥5, error≥10 |
| R6 — ROI 60%, Effort medium | ✅ PASS | |
| R7 KI-unterstützte Routinearbeit | ✅ PASS | rule_based=false, freq≥10, duration≥20, error<10 |
| R7 — ROI 30%, Effort medium | ✅ PASS | |
| R8 Daten-Aggregation | ✅ PASS | rule_based=false, duration≥30, error<10, kein Suchwort |
| R8 — ROI 40% | ✅ PASS | |
| Pro Typ: höchster ROI gewinnt (R1 vs R4) | ✅ PASS | R1 85% > R4 60% → R1 gewinnt |
| R5 vs R8 mutual exclusive | ✅ PASS | R8: NOT hasSearchKeywords |
| Score = ROI / effort_factor | ✅ PASS | |
| Priority: high/medium/low nach Score | ✅ PASS | Schwellenwerte 5000/1000 |
| Quarter: Q1/Q2/Q3 nach Score | ✅ PASS | |
| hourly_rate aus workspace | ✅ PASS | Fallback 45 €/h |
| null-Guard (freq/duration null → skip) | ✅ PASS | canCompute() check |
| POST /api/use-cases/generate | ✅ PASS | Auth, UUID-Validation, Workspace-Check |
| Delete-before-insert (Idempotenz) | ✅ PASS | ⚠️ Nicht atomar (B1) |
| GET /api/use-cases | ✅ PASS | Auth, total_roi_eur berechnet |
| GET /api/use-cases/roadmap | ✅ PASS | Q1/Q2/Q3 gruppiert, ROI je Quartal |
| Use Case Board `/dashboard/use-cases` | ✅ PASS | Server Component + Client generate button |
| Gesamt-ROI Banner | ✅ PASS | Meridian Pink Gradient |
| Quick Win Badge | ✅ PASS | priority=high AND effort=low |
| Loading Skeleton während Generate | ✅ PASS | |
| Leerer Zustand | ✅ PASS | |
| Quartals-Roadmap | ✅ PASS | Q1/Q2/Q3 mit ROI je Spalte |
| Sidebar-Navigation "KI Use Cases" | ✅ PASS | |

### Bugs Gefunden

#### B1 — Medium: Delete-before-insert nicht atomar → BEHOBEN
**Fix:** Insert-then-delete: neue Use Cases zuerst einfügen, dann alte IDs löschen. Datenverlust bei Insert-Fehler verhindert.

#### B2 — Low: `<a href>` statt `<Link>` → BEHOBEN
**Fix:** `import Link from 'next/link'` in `UseCaseBoardClient.tsx`.

#### B3 — Low: Keine Test-Abdeckung für Roadmap-Route → BEHOBEN
Roadmap-Test im QA-Lauf geschrieben. 104/104 Tests grün.

### Security Audit

| Check | Ergebnis |
|-------|---------|
| Auth auf allen 3 API-Routen | ✅ |
| Workspace-Isolation (403 bei fremdem Workspace) | ✅ |
| Delete scoped auf workspace_id | ✅ |
| Engine: pure function, kein User-Input injiziert | ✅ |
| workspace_id als UUID validiert (Zod) | ✅ |
| ANTHROPIC_API_KEY nicht benötigt (kein LLM) | ✅ |

### Produktion-Ready?

**JA** — alle Bugs (B1–B3) behoben. 104/104 Tests grün.

Alle 8 Heuristik-Regeln korrekt implementiert und getestet. ROI-Berechnung und Score-Logik verifiziert.

## Deployment

**Deployed:** 2026-05-20
**Production URL:** https://meridian-app-tau.vercel.app/
**Hinweis:** Mit-deployed via Merge-Commit des PROJ-3 Deploys. War bereits auf `origin/main` vorhanden.
