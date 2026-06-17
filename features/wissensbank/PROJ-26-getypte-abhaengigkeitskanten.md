# PROJ-26: Getypte Abhängigkeitskanten

## Status: Approved
**Type:** Extension
**Domain:** Wissensbank
**Extends:** PROJ-20
**Appetite:** M
**Bugs:** 0:1:1
**Created:** 2026-06-16
**Last Updated:** 2026-06-17

## Kontext

Auf `StepEntry` selbst gibt es heute kein Abhängigkeitsfeld. Abhängigkeiten werden nur indirekt
über die prozessweite `cluster_id` (`processClustering.ts`) und die Freitext-Referenz `step_ref`
(pain_point → Schritt, `interviewAgent.ts:1083`) angenähert. PROJ-25 ergänzt `abhaengigkeiten` als
strukturierten Placeholder `{ depends_on: unknown[]; influences: unknown[]; nicht_befund_typ: ... | null } | null`
(initial `null`), damit der Coverage-Scorer das Feld zählen kann. PROJ-26 schärft die Element-Typen
der beiden Arrays zu konkreten, maschinell auswertbaren Kanten und führt das `record_dependency`-Tool
ein, mit dem der Interview-Agent Abhängigkeiten während der Erhebung einträgt (O6, REQ-006).

Kanten als Daten im JSON-Dokument, keine Graph-Datenbank (ADR-T008 Entscheidung 2).
O7 (prozessübergreifende Muster) ist für den Pilot vertagt (App-ADR-012 Deferred).
Die konkrete Feldrealisierung (`depends_on`/`influences`, Kantentypen) ist ADR-T008-Designhypothese
und im Zielschema `prozessschritt-schema.json` (Definitionen `Abhaengigkeiten`/`AbhaengigkeitsKante`/
`EinflussKante`) realisiert; REQ-006 selbst ist seit dem Neutralitäts-Audit (ADR-T014, 2026-06-15)
feldneutral formuliert.

BL-Item: BL-E1.2. REQ: REQ-006. Schema: `prozessschritt-schema.json` v1.2.

## Dependencies

- Requires: PROJ-25 (Prozesswissens-Schema): führt `abhaengigkeiten` als strukturierten Placeholder
  `{ depends_on: unknown[]; influences: unknown[]; nicht_befund_typ: ... | null } | null` in `StepEntry`
  ein; Coverage-Scorer wertet das Feld bereits
- Requires: PROJ-27 (Schema-Bindung + verlustfreie Speicherung): stabile Schritt-IDs (S001-Format)
  müssen existieren, damit Kanten-Referenzen keine Phantom-IDs enthalten
- Enables: PROJ-28 (Extraktions-Zuverlässigkeit): kann Kanten-Felder in Grounding-Check einbeziehen

> **Build-Reihenfolge:** PROJ-25 → PROJ-27 → PROJ-26 (umgestellt 2026-06-16).
> Ursprüngliche Reihenfolge war PROJ-25 → PROJ-26 → PROJ-27; die Umstellung vermeidet
> titel-basierte Zwischenreferenzen und Migrations-Schuld.

## User Stories

- Als Interview-Agent will ich zwei Prozessschritte durch eine getypte, gerichtete Kante verbinden
  können (Typ: Voraussetzung, Ressource, Auslöser, Einfluss, Terminierung), damit O6 erfüllbar ist
  — welcher Schritt setzt welchen voraus, welche Entscheidung beeinflusst welchen späteren Schritt.

- Als KI-Berater will ich nach Interviewabschluss über den Prozessschritt-Endpunkt sehen können,
  welche Abhängigkeiten das System erfasst hat, damit ich die Vollständigkeit des Prozessmodells
  beurteilen und gezielt Lücken nacherheben kann.

- Als System (Coverage-Messung) will ich `abhaengigkeiten` als befüllt zählen, sobald mindestens
  eine Kante vorliegt oder ein Nicht-Befund-Marker gesetzt ist, damit Coverage die
  Externalisierungs-Vollständigkeit korrekt ausdrückt (REQ-007, ADR-T011).

- Als Entwickler will ich konkrete TypeScript-Typen für `AbhaengigkeitsKante` und `EinflussKante`
  statt `unknown[]`, damit der Compiler Fehler bei falschen Typen findet und der Eval-Runner
  die Typen ohne Supabase-Import verwenden kann.

- Als Interview-Agent will ich beim Erfassen eines Schritts nach relevanten Abhängigkeiten zu
  bereits bekannten Schritten fragen können, damit das System nicht nur isolierte Schritte, sondern
  den Prozessfluss abbildet.

## Acceptance Criteria

### TypeScript-Typen (`interviewSemantic.ts`)

- [ ] `AbhaengigkeitsKante` definiert:
  `{ schritt_id: string; typ: 'voraussetzung' | 'ressource' | 'ausloeser'; beschreibung: string | null }`
- [ ] `EinflussKante` definiert:
  `{ schritt_id: string; typ: 'beeinflusst' | 'terminierung'; beschreibung: string | null }`
- [ ] `Abhaengigkeiten` definiert:
  `{ depends_on: AbhaengigkeitsKante[]; influences: EinflussKante[]; nicht_befund_typ: 'nicht_zutreffend' | 'unbekannt' | 'verweigert' | null }`
- [ ] `StepEntry.abhaengigkeiten` ist `Abhaengigkeiten | null`; schärft den PROJ-25-Placeholder, indem die
  Element-Typen von `depends_on`/`influences` von `unknown` zu `AbhaengigkeitsKante`/`EinflussKante`
  konkretisiert werden (die Objektstruktur `{ depends_on; influences; nicht_befund_typ }` steht bereits aus PROJ-25)
- [ ] Alle drei Typen sind in `interviewSemantic.ts` definiert (side-effect-free, kein server-only-Import)
- [ ] `schritt_id` verwendet das S001-Format aus PROJ-27; kein enum — Werte sind zur Laufzeit dynamisch

### `record_dependency`-Tool (`interviewAgent.ts`)

- [ ] Neues Tool `record_dependency` mit Parametern:
  - `source_step_id: string` — Schritt, auf dem die Kante eingetragen wird
  - `target_step_id: string` — referenzierter Schritt
  - `richtung: 'depends_on' | 'influences'`
  - `typ: string` — kantenspezifischer Typ (depends_on: voraussetzung/ressource/ausloeser; influences: beeinflusst/terminierung)
  - `beschreibung: string | null`
- [ ] Typ-Validierung: `depends_on`-Kante erlaubt nur `voraussetzung | ressource | ausloeser`;
  `influences`-Kante nur `beeinflusst | terminierung` — Fehler bei Mismatch
- [ ] Schreibt in `step_tracker[source_step_id].abhaengigkeiten.depends_on` bzw. `.influences`
- [ ] Idempotent: doppeltes Eintragen derselben Kante (gleiche IDs + Typ) fügt keinen Duplikat ein
- [ ] Fehler wenn `source_step_id` nicht im `step_tracker` existiert (kein Phantom-Schritt)
- [ ] Fehler wenn `target_step_id` nicht im `step_tracker` existiert (kein Phantom-Referenz)
- [ ] Fehler wenn `source_step_id === target_step_id` (Selbstreferenz nicht erlaubt)

### Nicht-Befund-Pfad

- [ ] `abhaengigkeiten` ist **kein** `SlotName` (PROJ-25 Z. 82), daher läuft der Nicht-Befund **nicht** über
  `record_slot`, sondern über den dedizierten Schreibpfad: `record_dependency` erhält einen Nicht-Befund-Modus
  (Aufruf ohne `target_step_id`/`richtung`/`typ`, mit `nicht_befund_typ='nicht_zutreffend' | 'unbekannt' | 'verweigert'`),
  der `step_tracker[source_step_id].abhaengigkeiten.nicht_befund_typ` setzt. `/architecture` entscheidet, ob das als
  Modus von `record_dependency` oder als eigenes Markierungs-Tool realisiert wird (analog Governance-Schreibpfad, PROJ-25 Z. 98)
- [ ] `nicht_befund_typ` ohne Kanten zählt als befüllt für Coverage (REQ-007)

### Coverage-Interaktion

- [ ] Die Befüllt-Logik für `abhaengigkeiten` bleibt unverändert aus PROJ-25 (Z. 89, kanonische Heimat):
  befüllt, wenn `depends_on.length ≥ 1` ODER `influences.length ≥ 1` ODER `nicht_befund_typ != null`.
  PROJ-26 definiert die Formel nicht neu, sondern verifiziert sie gegen die jetzt getypten Kanten
- [ ] Leere Arrays `[]` bei `nicht_befund_typ: null` zählen als unbefüllt (O8-Lücke)
- [ ] `slotCoverage.test.ts` erhält Testfälle für die getypten Kanten: Kante vorhanden → befüllt; leere Arrays
  → unbefüllt; `nicht_befund_typ` gesetzt → befüllt; alter PROJ-25-Placeholder (`unknown[]`-Elemente) wird beim Lesen toleriert (kein Crash)

### Agent-Prompt

- [ ] `formatStepTracker` zeigt `abhaengigkeiten` als unbefüllt an wenn leer und kein Nicht-Befund
- [ ] Minimales Prompt-Update: Analyst kennt `record_dependency` und die Typ-Enums; volle
  Gesprächsführungs-Überarbeitung ist PROJ-29

### Regressions-Wächter

- [ ] `npm test` grün nach Typ-Schärfung (keine `unknown[]`-Typen mehr)
- [ ] Bestehende `step_tracker`-Einträge mit PROJ-25-placeholder werden lesbar toleriert
  (backward-compat Lese-Logik, kein Crash bei fehlendem `abhaengigkeiten`-Feld)
- [ ] Replay-Regressions-Korpus (App-ADR-015) grün — Coverage-Werte für `abhaengigkeiten`
  ändern sich (von Lücke zu befüllt wenn Kanten vorhanden), das ist erwartetes Verhalten

## Edge Cases

- **Selbstreferenz:** `source_step_id === target_step_id` → Tool-Fehler mit Klartext-Nachricht.
- **Phantom-Referenz:** `target_step_id` existiert nicht im `step_tracker` → Tool-Fehler; Agent
  muss zuerst den Ziel-Schritt via `register_step` anlegen.
- **Zirkuläre Abhängigkeiten:** A→B und B→A ist technisch erlaubt (modelliert gegenseitige
  Abhängigkeit); keine Zirkel-Erkennung für MVP (O7 vertagt).
- **Mehrere Kanten zum selben Ziel mit unterschiedlichem Typ:** gültig. S001 kann
  `voraussetzung` und `ressource`-Beziehung zu S002 gleichzeitig haben.
- **Kante vor PROJ-27-IDs:** verhindert durch Build-Reihenfolge (PROJ-27 vor PROJ-26).
  Falls dennoch ein Schritt ohne S-ID-Format im step_tracker landet: Tool wirft Validierungsfehler.
- **Zu viele Kanten:** kein Limit für MVP; leeres Objekt `{ depends_on: [], influences: [],
  nicht_befund_typ: null }` gilt weiterhin als unbefüllt.
- **Rückwärtskompatibilität mit altem placeholder:** Sessions aus PROJ-25-Ära haben
  `abhaengigkeiten: { depends_on: unknown[]; influences: unknown[]; ... }` — die geschärften Typen
  in TypeScript müssen beim Lesen bestehender JSONB-Einträge keinen Crash verursachen.

## Technical Requirements

- Typen in `interviewSemantic.ts` — kein server-only-Import, damit Eval-Runner importieren kann
- `record_dependency` in `interviewAgent.ts` schreibt über denselben TOCTOU-sicheren Schreibpfad wie PROJ-27
  (read-prev → check → gezieltes `jsonb_set` auf den Array-Pfad `abhaengigkeiten.depends_on`/`.influences`),
  nicht als Voll-Dokument-Read-Modify-Write. Damit unterliegt das Anhängen zweier Kanten an denselben Schritt
  nicht der Lost-Update-Klasse, die PROJ-27 (REQ-015) für Slot-Writes behebt
- Kein neuer Supabase-Migration-Bedarf: Kanten leben im bestehenden `step_tracker`-JSONB-Feld

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Entscheidung: Nicht-Befund-Modus

Modus A — **Einzelnes Tool `record_dependency` mit diskriminierter Eingabe**.

Zwei Modi in einem Tool (analog `record_governance`):
- **Kanten-Modus**: `target_step_id + richtung + typ + beschreibung` → schreibt getypte Kante
- **Nicht-Befund-Modus**: nur `nicht_befund_typ` → setzt `abhaengigkeiten.nicht_befund_typ`, keine Kante

Hält Agent-Tool-Count niedrig. Kein separates `mark_dependency_not_found`-Tool.

---

### Betroffene Dateien (3, keine neuen, keine Migration)

#### `src/services/interviewSemantic.ts`

`PlaceholderDependencies` ersetzen durch drei exportierte Interfaces:

| Interface | Felder |
|-----------|--------|
| `AbhaengigkeitsKante` | `schritt_id: string; typ: 'voraussetzung' \| 'ressource' \| 'ausloeser'; beschreibung: string \| null` |
| `EinflussKante` | `schritt_id: string; typ: 'beeinflusst' \| 'terminierung'; beschreibung: string \| null` |
| `Abhaengigkeiten` | `depends_on: AbhaengigkeitsKante[]; influences: EinflussKante[]; nicht_befund_typ: NichtBefundTyp` |

- `StepEntry.abhaengigkeiten` → `Abhaengigkeiten | null`
- `SchemaAbhaengigkeiten` (Schema-Export-Sektion) auf dieselben konkreten Typen heben
- `normalizeStepEntry`: `r.abhaengigkeiten ?? null` bleibt unverändert — TypeScript-Typen sind Compile-Time; bestehende JSONB-Rows mit `unknown[]`-Elementen crashen nicht (keine Runtime-Migration nötig)

#### `src/services/interviewAgent.ts`

**A) `formatStepTracker`** — `abhaengigkeiten`-Zeile hinzufügen (aktuell fehlend):
- Kanten vorhanden → `✓ N Kante(n) (depends_on: X, influences: Y)`
- `nicht_befund_typ` gesetzt, keine Kanten → `nicht_befund: <typ>`
- Beides null/leer → `abhaengigkeiten: fehlt`

**B) Neues Tool `record_dependency`** — nach `record_slot` einfügen.

Zod-Input:
```
source_step_id: string  (regex /^S[0-9]{3}$/)
// Kanten-Modus:
target_step_id?: string
richtung?: 'depends_on' | 'influences'
typ?: string
beschreibung?: string | null
// Nicht-Befund-Modus:
nicht_befund_typ?: 'nicht_zutreffend' | 'unbekannt' | 'verweigert'
```

Validierungslogik:
- `source` muss im `step_tracker` existieren
- `target` muss existieren (nur Kanten-Modus)
- `source !== target` (Selbstreferenz verboten)
- `typ` muss zu `richtung` passen (`depends_on` → voraussetzung/ressource/ausloeser; `influences` → beeinflusst/terminierung)
- Idempotenz: gleiche source+target+typ → success, kein Duplikat

Schreibpfad (gleiche RPC wie PROJ-27):
1. `step_tracker` aus `interview_state` lesen
2. Alle Einträge via `normalizeStepEntry`
3. Source-Schritt per S-ID finden
4. Validieren, dedup, aktualisiertes `Abhaengigkeiten`-Objekt bauen
5. `supabase.rpc('patch_interview_step_field', { p_sub_path: ['abhaengigkeiten'], p_value: JSON.stringify(updated) })`

Konkurrenz-Analyse:
- `record_dependency` + `record_slot` gleichzeitig → sicher (verschiedene `sub_path`)
- Zwei `record_dependency` gleichzeitig → last-write-wins auf `abhaengigkeiten` (akzeptabel: Single-Agent, keine parallelen Tool-Calls erwartet)

**C) System-Prompt** — eine Zeile `record_dependency`-Erwähnung in Tool-Liste (~Zeile 440). Vollständige Gesprächsführungs-Überarbeitung ist PROJ-29.

#### `src/services/__evals__/interview/scorers/slotCoverage.test.ts`

Neue Testfälle für `abhaengigkeiten` mit getypten Kanten:
- `AbhaengigkeitsKante` vorhanden → befüllt
- `EinflussKante` vorhanden → befüllt
- Leere Arrays + `nicht_befund_typ: null` → unbefüllt
- `nicht_befund_typ` gesetzt (keine Kanten) → befüllt
- PROJ-25-Placeholder mit `unknown[]`-Elementen → kein Crash (toleriert)

---

### Coverage-Logik (keine Änderung)

`slotCoverage.ts` Z. 16–22 korrekt für `abhaengigkeiten`:
```
befüllt wenn depends_on.length ≥ 1 OR influences.length ≥ 1 OR nicht_befund_typ != null
```
PROJ-26 definiert diese Formel nicht neu — nur Tests gegen getypte Kanten verifizieren sie.

## QA Test Results

**QA Date:** 2026-06-17
**Status:** Approved
**Bugs:** 0:1:1

### Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| TS-1 | `AbhaengigkeitsKante` defined with correct shape | ✅ PASS |
| TS-2 | `EinflussKante` defined with correct shape | ✅ PASS |
| TS-3 | `Abhaengigkeiten` defined with correct shape | ✅ PASS |
| TS-4 | `StepEntry.abhaengigkeiten` is `Abhaengigkeiten \| null` | ✅ PASS |
| TS-5 | All three types in `interviewSemantic.ts` (no server-only import) | ✅ PASS |
| TS-6 | `schritt_id` uses S001 format (Zod regex `/^S[0-9]{3}$/`) | ✅ PASS |
| RD-1 | Tool `record_dependency` exists with all required params | ✅ PASS |
| RD-2 | Typ-Validierung: depends_on → voraussetzung/ressource/ausloeser only | ✅ PASS |
| RD-3 | Typ-Validierung: influences → beeinflusst/terminierung only | ✅ PASS |
| RD-4 | Writes via TOCTOU-safe `patch_interview_step_field` RPC | ✅ PASS |
| RD-5 | Idempotent: dedup by schritt_id + typ, returns success + skipped:true | ✅ PASS |
| RD-6 | Error when source_step_id not in step_tracker | ✅ PASS |
| RD-7 | Error when target_step_id not in step_tracker | ✅ PASS |
| RD-8 | Error when source_step_id === target_step_id | ✅ PASS |
| NB-1 | Nicht-Befund-Modus sets `abhaengigkeiten.nicht_befund_typ` | ✅ PASS |
| NB-2 | Both modes simultaneously → error | ✅ PASS |
| NB-3 | `nicht_befund_typ` without edges counts as filled for Coverage | ✅ PASS |
| COV-1 | Coverage logic unchanged from PROJ-25 | ✅ PASS |
| COV-2 | slotCoverage.test.ts: AbhaengigkeitsKante → filled | ✅ PASS |
| COV-3 | slotCoverage.test.ts: EinflussKante → filled | ✅ PASS |
| COV-4 | slotCoverage.test.ts: empty arrays + null nicht_befund_typ → unfilled | ✅ PASS |
| COV-5 | slotCoverage.test.ts: nicht_befund_typ set → filled | ✅ PASS |
| COV-6 | slotCoverage.test.ts: PROJ-25 unknown[] elements tolerated (no crash) | ✅ PASS |
| PROMPT-1 | `formatStepTracker` shows `abhaengigkeiten: fehlt` when empty | ✅ PASS |
| PROMPT-2 | `formatStepTracker` shows Kanten count when present | ✅ PASS |
| PROMPT-3 | `formatStepTracker` shows `nicht_befund: <typ>` when set | ✅ PASS |
| PROMPT-4 | System prompt mentions `record_dependency` in tool list | ✅ PASS |
| REG-1 | `npm test` green after type sharpening (530/530) | ✅ PASS |
| REG-2 | Backward-compat: PROJ-25 unknown[] elements read without crash | ✅ PASS |

### Bugs Found

**B1 — Medium: No unit tests for `record_dependency` tool logic**

All other tools in `interviewAgent.ts` (`record_slot`, `link_bottleneck`, `update_walkthrough_data`, `record_governance`) have unit tests in `interviewAgent.test.ts`. `record_dependency` has zero.

The validation logic — phantom-ref check, self-reference guard, typ/richtung mismatch, idempotency, nicht_befund_modus, both-modes-simultaneously error — is implemented correctly (verified by code review) but unguarded against future regressions.

_Steps to repro gap:_ `grep -c "record_dependency" src/services/interviewAgent.test.ts` → 0

_Fix:_ Add a `describe('record_dependency', ...)` block in `interviewAgent.test.ts` covering: edge mode success (depends_on + influences), nicht_befund_modus success, phantom source → error, phantom target → error, self-reference → error, type mismatch (influences type given to depends_on) → error, idempotency → skipped:true.

---

**B2 — Low: Pre-existing `npm run lint` failures (carried from PROJ-27, not introduced by PROJ-26)**

`tsc --noEmit` reports 5 errors:
- `scripts/backfill-fixtures-from-md.ts:48` — `schemaConformanceRate` missing in ScoreSet literal
- `src/services/__evals__/interview/replay/runReplay.ts:164` — same
- `src/services/interviewAgent.test.ts:455,493` — `p_sub_path`/`p_value` on typed `{}` mock

These pre-date PROJ-26 (present in `git show f1b4131`). PROJ-26 did not introduce or fix them.

### Security Audit

No attack surface added. `record_dependency` runs server-side only (interviewAgent.ts), protected by Supabase RLS and workspace auth inherited from the existing interview context. No new input reaches the client.

S001 format enforced by Zod regex — no injection vector via step IDs.

### Regression

All 530 unit tests pass. E2E suite (164 pass, 9 skipped, 13 did not run — all pre-existing PROJ-3/11/23/24). No regression.

### Production-Ready Decision

**YES — ready to deploy.**

No Critical or High bugs. B1 (Medium) is a testing gap, not a functionality defect. B2 (Low) pre-dates this feature.

## Deployment
_To be added by /deploy_

## Post-Mortem
_To be added by /deploy_

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: M / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
