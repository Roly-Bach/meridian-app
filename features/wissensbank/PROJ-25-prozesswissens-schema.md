# PROJ-25: Prozesswissens-Schema (O1–O5 + Governance)

## Status: Approved
**Type:** Revision
**Domain:** Wissensbank
**Extends:** PROJ-20
**Appetite:** L
**Bugs:** 0:0:0
**Created:** 2026-06-16
**Last Updated:** 2026-06-17

## Kontext

Das bestehende `StepEntry` in `interviewSemantic.ts:30-48` trägt **sechs** Slots in `slots`
(alle `SlotValue | null`): `frequency_per_month`, `duration_minutes`, `rule_based`, `data_sources`,
`error_rate_percent`, `media_breaks`. Davon sind vier die `MANDATORY_SLOTS` (`frequency_per_month`,
`duration_minutes`, `rule_based`, `data_sources`, `interviewSemantic.ts:50-55`), zwei sind
`OPTIONAL_SLOTS` (`error_rate_percent`, `media_breaks`). Quantitativ im Sinne der KI-Potenzial-Facette
sind nur `frequency_per_month`, `duration_minutes`, `error_rate_percent`, `media_breaks`; `rule_based`
(boolean) und `data_sources` (Liste) sind es nicht und werden bei der Migration in tazite Felder
überführt. Die Rollen-Zuordnung liegt heute als Freitext-`role?: string | null` vor
(`interviewSemantic.ts:32`), ohne getypte Governance-Struktur.

Die taziten O2–O5-Felder (`entscheidungslogik`, `tazite_cues`, `ausnahmen`, `inputs`, `outputs`,
`hilfsmittel`) fehlen ganz. Der Coverage-Scorer misst derzeit gegen die vier `MANDATORY_SLOTS`
(Formel `filled / (n × 4)`, `slotCoverage.ts:10-25`), nicht gegen die neun taziten O1–O6-Pflichtfelder
(REQ-007).

ADR-T016 (2026-06-16) hat entschieden: ein gemeinsames Dokument, quantitative Slots als getrennt
getyptete `potenzial`-Facette im selben Schritt, Coverage-Nenner bleibt O1–O6. Das getypte
Governance-Feld (REQ-022) ist ebenfalls dort entschieden (Entscheidung 2: tazite Schicht, aber separat
gemessen); es ist **nicht** eine Festlegung dieser Spec, sondern wird gegen das Schema realisiert.
Zielschema: `meridian-ma/schemas/prozessschritt-schema.json` v1.2 (Governance-Facette nachgezogen,
2026-06-17) + Schema-Spec v1.2.

BL-Items: BL-E1.1 (O1–O5-Schema, neubauen) + BL-E1.6 (Governance-Feld, anpassen).
REQ: REQ-004, REQ-022.

## Dependencies
- Requires: PROJ-20 (Prozessableitungs-Pipeline) — step_tracker JSONB und Coverage-Scorer existieren
- Requires: PROJ-2 (Interview Engine Backend) — interviewSemantic.ts, record_slot-Tool
- Blocks: PROJ-26 (Getypte Abhängigkeitskanten) — braucht stabile StepEntry-Struktur
- Blocks: PROJ-27 (Schema-Bindung + verlustfreie Speicherung) — braucht neue Slot-Typen
- Blocks: PROJ-28 (Extraktions-Zuverlässigkeit) — baut auf neuem Schema auf

## User Stories

- Als KI-Berater will ich, dass das System nach Interview-Abschluss zu jedem Prozessschritt die
  Entscheidungslogik, taziten Cues, Ausnahmen, Inputs, Outputs und Hilfsmittel gespeichert hat,
  damit ein Nachfolger den Schritt ohne Rückfragen nachvollziehen kann (O1–O5, REQ-004).

- Als KI-Berater will ich, dass zu jedem Schritt ein getyptes Governance-Feld vorliegt (wer führt
  aus, wer entscheidet, welche Organisationseinheit), damit die organisationale Einbettung des
  Prozessschritts erfasst ist (BL-E1.6, REQ-022).

- Als System (Coverage-Messung) will ich den Befüllungsstand gegen die 9 taziten O1–O6-Pflichtfelder
  messen, damit Coverage die Externalisierungs-Vollständigkeit des taziten Wissens ausdrückt, nicht
  die Befüllung der quantitativen KI-Potenzial-Slots (REQ-007, ADR-T011).

- Als System (Use-Case-Engine / Downstream) will ich, dass die quantitativen Potenzial-Daten
  (Häufigkeit, Dauer, Fehlerquote, Medienbrüche) als getrennt getypte `potenzial`-Facette erhalten
  bleiben, damit nachgelagerte Use-Case-Generierung keine Datenbasis verliert (ADR-T016).

- Als Entwickler will ich, dass bestehende `step_tracker`-JSONB-Einträge verlustfrei in das neue
  Schema migriert werden, damit laufende Interview-Sessions nicht korrumpiert werden.

## Acceptance Criteria

### TypeScript-Typen (interviewSemantic.ts)

- [ ] Neuer Typ `TaziteSlot` für einwertige tazite Felder. Er **erweitert** die bestehende `SlotValue` (Substrat behalten, nicht ersetzen) und behält damit Evidence-Span und Konfidenz: `{ value: string | null; quote: string | null; confidence?: 'confirmed' | 'estimate' | 'unknown'; nicht_befund_typ: 'nicht_zutreffend' | 'unbekannt' | 'verweigert' | null }`. `quote` trägt den wörtlichen Evidence-Span (Grounding-Schutzgut, siehe Regressions-Guard).
- [ ] Neuer Typ `TaziteSlotArray` (mehrwertig): wie `TaziteSlot`, aber `value: string[] | null`; leeres Array `[]` ist ungültig (→ `value: null` + `nicht_befund_typ`).
- [ ] Neuer Typ `GovernanceSlot` (deckt das Schema-`Governance`-Objekt v1.2): `{ rolle: string | null; organisationseinheit: string | null; systeme: string[] | null; nicht_befund_typ: 'nicht_zutreffend' | 'unbekannt' | 'verweigert' | null }`.
- [ ] `StepEntry.slots` erhält die taziten O2–O5-Felder (alle nullable, initial `null`): `entscheidungslogik: TaziteSlot | null`, `tazite_cues: TaziteSlotArray | null`, `ausnahmen: TaziteSlotArray | null`, `inputs: TaziteSlotArray | null`, `outputs: TaziteSlotArray | null`, `hilfsmittel: TaziteSlotArray | null`.
- [ ] `StepEntry.reihenfolge: number` (O1): neues Top-Level-Feld; Migration setzt es aus der 1-basierten Array-Position (bisher nur impliziter Array-Index, kein Feld).
- [ ] `StepEntry.abhaengigkeiten` (O6): neues Top-Level-Feld, in PROJ-25 placeholder-typisiert `{ depends_on: unknown[]; influences: unknown[]; nicht_befund_typ: 'nicht_zutreffend' | 'unbekannt' | 'verweigert' | null } | null` (initial `null`), damit der Coverage-Scorer das Feld werten kann; PROJ-26 schärft den Typ (getypte Kanten).
- [ ] `bezeichnung` (O1) bleibt der bestehende Top-Level-`title: string` — **kein** zweites Namensfeld einführen. Die Abbildung `title → bezeichnung`-SlotString gehört zur Export-/Schema-Bindung (PROJ-27).
- [ ] `StepEntry.governance: GovernanceSlot | null` (Erstklasse-Feld, **nicht** in `slots`); ersetzt den Freitext-`role` (Migration unten).
- [ ] `StepEntry.potenzial` sub-Objekt: die vier quantitativen Felder `frequency_per_month`, `duration_minutes`, `error_rate_percent`, `media_breaks` (alle `SlotValue | null`) wandern hierhin; weiter lesbar ohne Breaking-Change. App-intern bleiben die englischen Keys; die deutschen Schema-Keys (`haeufigkeit_pro_monat` etc.) sind die Export-Sicht (PROJ-27).
- [ ] Alte Keys in `slots` werden migriert und entfernt: die vier quantitativen → `potenzial.*`; `rule_based` → `entscheidungslogik`; `data_sources` → `hilfsmittel` (Migration unten).
- [ ] **Grenzobjekt-Bindung ist PROJ-27, nicht hier.** Die meridian-ma-Export-Form (`SlotString`: `wert` / numerische `konfidenz` / `nicht_befund_typ`, deutsche Feldnamen) ist die persistierte Grenzobjekt-Sicht. PROJ-25 erweitert das App-interne Substrat und hält die Felder groundbar; die strikte JSON-Schema-Bindung gegen `prozessschritt-schema.json` v1.2 und die `confidence`(enum)→`konfidenz`(0–1)-Abbildung sind PROJ-27 (REQ-003).
- [ ] `SlotName` (Parametertyp von `record_slot`) deckt nur die **schreibbaren** Slot-Keys: die sechs O2–O5-taziten Keys plus die vier quantitativen `potenzial`-Keys. `bezeichnung`, `reihenfolge`, `abhaengigkeiten` und `governance` sind **keine** `SlotName` (eigene Schreibpfade). `MANDATORY_SLOTS` wird **nicht** zur Coverage-Feldliste umdefiniert (das war ein Konflikt zweier Konzepte); die Coverage-Felder leben separat (siehe Coverage-Scorer).

### Coverage-Scorer (slotCoverage.ts)

- [ ] Der Coverage-Nenner ist eine **eigene**, neunelementige O1–O6-Feldliste (nicht `MANDATORY_SLOTS`/`SlotName`): `bezeichnung, reihenfolge, entscheidungslogik, tazite_cues, ausnahmen, inputs, outputs, hilfsmittel, abhaengigkeiten`. ADR-T011-Formel: `Σ befüllte / (n × 9) × 100 %`.
- [ ] Der Scorer liest jedes Feld aus seiner **realen Heimat** (nicht pauschal `step.slots[slot]`, wie heute `slotCoverage.ts:18`): `bezeichnung`←`title` (Top-Level, befüllt wenn nicht-leer), `reihenfolge`←`reihenfolge` (Top-Level integer → immer befüllt, 1/9), O2–O5←`slots.*`, `abhaengigkeiten`←Top-Level-`abhaengigkeiten`.
- [ ] Ein Slot-Feld gilt als befüllt: `value != null` ODER `nicht_befund_typ != null`.
- [ ] `abhaengigkeiten` gilt als befüllt: mindestens eine Kante in `depends_on`/`influences` ODER `nicht_befund_typ != null`.
- [ ] `potenzial`-Felder zählen **nicht** in den Coverage-Nenner.
- [ ] `governance` zählt **nicht** in den Coverage-Nenner. Es wird als **separate** Befüllungsrate ausgewiesen (REQ-022-Erfolgskriterium, tazite Schicht, ADR-T016 Entscheidung 2): befüllt, wenn `rolle`/`organisationseinheit`/`systeme` gesetzt ODER `nicht_befund_typ != null`. Der Nenner bleibt neun O1–O6-Felder, auch nach Governance-Aufnahme.
- [ ] `scoreDedupCoverage` (zweiter Scorer, `slotCoverage.ts:33-49`, gleiche Mechanik über `groupSemanticSteps`) zieht auf dieselbe Neuner-Feldliste und dieselben Feld-Quellen nach.
- [ ] `slotCoverage.test.ts` ist vollständig aktualisiert und grün.

### Interview-Agent / record_slot-Tool (interviewAgent.ts)

- [ ] `record_slot` akzeptiert die neuen schreibbaren `SlotName` der O2–O5-Felder (`entscheidungslogik`, `tazite_cues`, `ausnahmen`, `inputs`, `outputs`, `hilfsmittel`); der bestehende `evidence_span`/`evidence_quote`-Grounding-Pfad (`interviewAgent.ts:900-934`) bleibt unverändert und schreibt `quote` in den taziten Slot
- [ ] `governance` ist **kein** `SlotName` (anderes Objektformat als ein Slot). Es wird über einen eigenen Schreibpfad gesetzt: entweder ein dediziertes `record_governance`-Tool oder ein governance-Zweig, der das `GovernanceSlot`-Objekt nach `StepEntry.governance` schreibt (nicht nach `slots`). `/architecture` entscheidet die Tool-Granularität
- [ ] `register_step` setzt bei Neuanlage `reihenfolge` aus der 1-basierten Array-Position (`tracker.length + 1`), damit auch nach dem Deploy angelegte Schritte das Feld tragen. Sonst hält die Coverage-Annahme „`reihenfolge` immer befüllt" (siehe Coverage-Scorer) nur für migrierte, nicht für neu registrierte Schritte; ein Schritt ohne `reihenfolge` wäre zudem beim Schema-Export (PROJ-27 `toGrenzobjekt`) nicht konform (`reihenfolge` ist Schema-Pflichtfeld)
- [ ] `formatStepTracker` zeigt die neuen taziten Felder und `governance` im Prompt-Kontext an (damit Agent weiß, was noch fehlt)
- [ ] `SLOT_PROMPT_HINT` (`interviewAgent.ts:126`) deckt die neuen Slot-Keys ab
- [ ] Minimales Prompt-Update: Analyst kennt die neuen schreibbaren Felder; volle Gesprächsführungs-Revision ist PROJ-29

### Datenbank-Migration

- [ ] Supabase-Migration (SQL) überführt bestehende `step_tracker`-JSONB verlustfrei. Alle sechs heutigen `slots`-Keys werden adressiert (nicht nur vier):
  - `slots.frequency_per_month` → `potenzial.frequency_per_month` (SlotValue bleibt unverändert, nur Key-Umzug)
  - `slots.duration_minutes` → `potenzial.duration_minutes`
  - `slots.error_rate_percent` → `potenzial.error_rate_percent`
  - `slots.media_breaks` → `potenzial.media_breaks`
  - `slots.rule_based` → `slots.entscheidungslogik` (Boolean als String-Notiz: `value: "rule_based: <value>"`; `quote`/`confidence` der Quelle erhalten; `nicht_befund_typ: null`)
  - `slots.data_sources` → `slots.hilfsmittel` (Wert-Array übernehmen, als bester Fit; `quote`/`confidence` erhalten; `nicht_befund_typ: null`)
  - `role` (Top-Level Freitext) → `governance.rolle` (String übernehmen); `governance.organisationseinheit`/`systeme`/`nicht_befund_typ` initial `null`
  - `reihenfolge` ← 1-basierte Array-Position des Schritts im `step_tracker`-Array
  - Alle neuen Felder ohne Vorgänger: initial `null`
- [ ] Migration hat Approval-Gate (User-Freigabe vor `apply_migration`)
- [ ] Zwei leere Arrays ohne `nicht_befund_typ` (`[]`) werden zu `value: null, nicht_befund_typ: null` normalisiert
- [ ] `list_migrations` bestätigt Migration applied; `step_tracker`-Lesbarkeit in laufenden Sessions intakt

### Schutzgut / Regressions-Guard

- [ ] `applyGroundingGuard` / `evidence_span`-Check greift auf den neuen TaziteSlot-Typen (kein Breaking) — weil `TaziteSlot`/`TaziteSlotArray` das `quote`-Feld der `SlotValue` behalten, bleibt der wörtliche Beleg je tazitem Feld erhalten
- [ ] Replay-Regressions-Korpus (App-ADR-015) läuft grün nach Scorer-Umbau — Coverage-Werte ändern sich systematisch (erwartet und dokumentiert), aber kein Test-Crash
- [ ] `slotWriteRace.test.ts` grün (Schreibpfad unverändert strukturell)
- [ ] Analyst bleibt exklusiver Schreiber auf `step_tracker`-JSONB (kein paralleler Writer eingeführt)
- [ ] `npm test` grün gesamt

## Edge Cases

- **Laufende Sessions mit altem Format:** Die Lese-Logik muss beide Formate (alt + neu) tolerieren. Die Migration läuft in einer Transaktion; halb-migrierte Einträge darf es nicht geben.
- **`rule_based` (boolean → string):** Der alte Boolean-Wert hat keine direkte Entsprechung in `entscheidungslogik` (string). Migration konserviert den Wert als Notiz (`"rule_based: true"`); der Interview-Agent kann im nächsten Turn überschreiben.
- **`data_sources` (string[]) → `hilfsmittel` oder `inputs`?** Default-Mapping: `hilfsmittel`. Semantisch gibt es Fälle, wo `data_sources` eher `inputs` wäre — Migration dokumentiert den Default und erlaubt manuellen Override durch den Agent im Folge-Turn.
- **Coverage-Regression in bestehenden Eval-Runs:** Coverage-Werte sinken nach Umbau systematisch (9 statt 4 Slots im Nenner, O2–O5 initial leer). Dieses Verhalten ist korrekt und muss in `CHANGELOG` und Eval-Baseline-Kommentaren dokumentiert werden; kein Scorer-Patch zur Inflation.
- **`abhaengigkeiten` noch kein vollständiges TypeScript-Typ:** PROJ-26 implementiert die getypten Kanten. Für PROJ-25 trägt `StepEntry` das Feld als `{ depends_on: unknown[]; influences: unknown[]; nicht_befund_typ: ... | null } | null` — placeholder-typed, damit Coverage-Scorer das Feld befüllt/unbefüllt bewerten kann. PROJ-26 schärft den Typ.
- **Leere Arrays `[]`:** Werden in Migration und in der Lese-/Schreib-Logik konsequent abgefangen und zu `value: null` + passendem `nicht_befund_typ` normalisiert.
- **Potenzial-Felder ohne Vorgänger:** Sessions, die keine quantitativen Slots hatten, erhalten `potenzial: null` oder `potenzial: { frequency_per_month: null, ... }` (App-interne englische Keys) — konsistentes Null-Objekt statt fehlendem Key.
- **Governance ohne Rollenklärung:** Eine vage Akteurs-Nennung ohne klare Rolle gilt als Lücke (REQ-022), nicht als befüllt. Migration übernimmt nur ein vorhandenes `role` nach `governance.rolle`; `organisationseinheit`/`systeme` bleiben `null` bis der Agent sie erhebt. `governance` zählt nicht in die O1–O6-Coverage, sondern in die separate Governance-Befüllungsrate.

## Technical Requirements

- Alle Typ-Definitionen in `interviewSemantic.ts` (kein server-only-Import nötig, damit Eval-Runner importieren kann)
- Supabase-Migration unter `supabase/migrations/` versioniert, reversibel (DOWN-Script)
- `slotCoverage.ts` bleibt referenzfrei (keine LLM-Calls, reine Berechnungslogik)
- DB-Approval-Gate: Änderung an `step_tracker`-Tabelle erfordert explizite User-Freigabe vor `apply_migration`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Schichten

PROJ-25 ist reine Backend-/Service-Revision — keine neuen UI-Seiten, kein neues API-Endpoint. Drei Service-Dateien plus eine Supabase-Migration.

### 1. StepEntry-Struktur (interviewSemantic.ts)

```
StepEntry
├── title: string          (O1 Bezeichnung — unverändert)
├── reihenfolge: number    (O1 Position — neu Top-Level)
├── governance: GovernanceSlot | null  (neu, ersetzt role Freitext)
├── abhaengigkeiten: PlaceholderDeps | null  (O6 Placeholder — PROJ-26 schärft Typ)
├── potenzial              (quantitative Felder, umgezogen aus slots)
│   ├── frequency_per_month: SlotValue | null
│   ├── duration_minutes: SlotValue | null
│   ├── error_rate_percent: SlotValue | null
│   └── media_breaks: SlotValue | null
└── slots                  (nur noch tazite Felder)
    ├── entscheidungslogik: TaziteSlot | null   (← rule_based)
    ├── tazite_cues: TaziteSlotArray | null      (O2 neu)
    ├── ausnahmen: TaziteSlotArray | null        (O3 neu)
    ├── inputs: TaziteSlotArray | null           (O4 neu)
    ├── outputs: TaziteSlotArray | null          (O4 neu)
    └── hilfsmittel: TaziteSlotArray | null     (O5, ← data_sources)
```

Neue Typen: `TaziteSlot` (einwertig), `TaziteSlotArray` (mehrwertig), `GovernanceSlot`.
`nicht_befund_typ` auf allen taziten Typen: unterscheidet "noch nicht gefragt" (null) von "explizit beantwortet als nicht_zutreffend/unbekannt/verweigert".

Dual-Format-Kompatibilität: `normalizeStepEntry()` liest altes JSONB (slots.frequency_per_month) und neues (potenzial.frequency_per_month).

### 2. Coverage-Messung (slotCoverage.ts)

| Rate | Felder | Nenner |
|------|--------|--------|
| O1–O6 Coverage | bezeichnung, reihenfolge, entscheidungslogik, tazite_cues, ausnahmen, inputs, outputs, hilfsmittel, abhaengigkeiten | 9 × n Schritte |
| Governance-Rate | rolle / organisationseinheit / systeme / nicht_befund_typ | separat, nicht in O1–O6 |
| Potenzial-Felder | frequency_per_month, duration_minutes, … | zählen NICHT in Coverage |

Coverage-Werte sinken nach Deploy systematisch (9 statt 4 Felder, O2–O5 initial leer). Korrekt — in CHANGELOG dokumentieren.

### 3. Interview-Agent (interviewAgent.ts)

- `record_slot` — erweitert: akzeptiert 6 neue tazite Keys
- `record_governance` — **neues separates Tool**, partial-write (mergt nur übergebene Felder, lässt bestehende unverändert). Begründung: GovernanceSlot hat andere Struktur als Slot (3 benannte Felder, kein value+quote-Tuple); Evidence ist turn-spezifisch (rolle in Turn 3, OE in Turn 8).
- `register_step` — setzt `reihenfolge` aus Array-Position bei Neuanlage
- `formatStepTracker` — zeigt tazite Felder + governance
- `SLOT_PROMPT_HINT` — 6 neue Einträge

### 4. DB-Migration

`supabase/migrations/20260617000000_proj25_prozesswissens_schema.sql` — atomare Transaktion, DOWN-Script vorhanden. Approval-Gate vor apply_migration.

## Implementation Notes (2026-06-17)

**Files changed:**
- `src/services/interviewSemantic.ts` — New types (`NichtBefundTyp`, `TaziteSlot`, `TaziteSlotArray`, `GovernanceSlot`, `PlaceholderDependencies`); `StepEntry` restructured with `potenzial` + tazite `slots` + `governance` + `reihenfolge`; `normalizeStepEntry()` for backward compat; `TAZITE_SLOT_NAMES`, `POTENZIAL_SLOT_NAMES`, `COVERAGE_FIELDS` constants.
- `src/services/interviewAgent.ts` — `record_slot` handles 10 slots (4 potenzial + 6 tazite) with split write paths; `record_governance` new tool with partial-write/merge semantics; `register_step` sets `reihenfolge`; `computeMissingMandatorySlots` iterates all 10; `SLOT_PROMPT_HINT` updated.
- `src/services/interviewAnalyst.ts` — `mergeFragmentedSteps` merges both `potenzial` and `slots`; backfill `data_sources→hilfsmittel`.
- `src/services/interviewOrchestrator.ts` — `walkthroughHasContent` and `semanticAllStepsDone` read from `potenzial`.
- `src/services/processEnrichment.ts` — Reads from `potenzial`/`governance`/`slots`; adds `normalizeStepEntry()` call on load.
- `src/app/api/interview/[token]/chat/route.ts` — Normalizes all `step_tracker` reads via `normalizeStepEntry()`.
- `src/services/__evals__/interview/scorers/slotCoverage.ts` — 9-field O1–O6 denominator; `scoreGovernanceCoverage()` separate.
- `supabase/migrations/20260617000000_proj25_prozesswissens_schema.sql` — Applied 2026-06-17; atomically migrates all existing `step_tracker` JSONB rows.

**Test files updated:** `interviewAgent.test.ts`, `interviewOrchestrator.test.ts`, `slotWriteRace.test.ts`, `stepIdentity.test.ts`, `stepRegistrationCoverage.test.ts`, `processEnrichment.test.ts`, `chat.test.ts`, `slotCoverage.test.ts`. All 484 tests pass.

**Deviations from spec:** None. `record_governance` partial-write decision (ADR-T016) implemented as designed.

## QA Test Results

**Date:** 2026-06-17
**QA Engineer:** /qa skill

### Automated Tests
- `npm test`: **484 passed, 0 failed** (37 test files)
- `npm run test:e2e`: not applicable (pure backend/service revision, no UI)

### Acceptance Criteria — Pass/Fail

#### TypeScript-Typen (interviewSemantic.ts)
| # | Criterion | Result |
|---|-----------|--------|
| 1 | `TaziteSlot` type: `value: string|null`, `quote: string|null`, `confidence?`, `nicht_befund_typ` | ✅ PASS |
| 2 | `TaziteSlotArray`: `value: string[]|null`, same metadata | ✅ PASS |
| 3 | `GovernanceSlot`: `rolle/organisationseinheit/systeme/nicht_befund_typ` | ✅ PASS |
| 4 | `StepEntry.slots` has all 6 tazite O2–O5 fields (null initial) | ✅ PASS |
| 5 | `StepEntry.reihenfolge: number` (new top-level O1 field) | ✅ PASS |
| 6 | `StepEntry.abhaengigkeiten` (placeholder-typed O6) | ✅ PASS |
| 7 | `bezeichnung` stays as `title: string` — no second name field | ✅ PASS |
| 8 | `StepEntry.governance: GovernanceSlot|null` (first-class, not in slots) | ✅ PASS |
| 9 | `StepEntry.potenzial` sub-object with 4 quantitative fields | ✅ PASS |
| 10 | Old flat `slots` keys removed from `StepEntry.slots` | ✅ PASS |
| 11 | PROJ-27 boundary respected (app-internal English keys, German = export view) | ✅ PASS |
| 12 | `SlotName` deprecated; writable slots via `TaziteSlotName | PotenzialSlotName` | ✅ PASS |
| 13 | `MANDATORY_SLOTS` NOT redefined as coverage list | ✅ PASS |
| 14 | `COVERAGE_FIELDS` defined separately (9 elements) | ✅ PASS |

#### Coverage-Scorer (slotCoverage.ts)
| # | Criterion | Result |
|---|-----------|--------|
| 15 | 9-element O1–O6 `COVERAGE_FIELDS` denominator | ✅ PASS |
| 16 | Each field read from correct home (title, reihenfolge, slots.*, abhaengigkeiten) | ✅ PASS |
| 17 | Filled: `value != null` OR `nicht_befund_typ != null` | ✅ PASS |
| 18 | `abhaengigkeiten`: edge in depends_on/influences OR nicht_befund_typ | ✅ PASS |
| 19 | `potenzial` fields excluded from denominator | ✅ PASS |
| 20 | `governance` excluded from O1–O6; separate `scoreGovernanceCoverage()` | ✅ PASS |
| 21 | `scoreDedupCoverage` uses same COVERAGE_FIELDS and field sources | ✅ PASS |
| 22 | `slotCoverage.test.ts` complete and green | ✅ PASS |

#### Interview-Agent / record_slot-Tool (interviewAgent.ts)
| # | Criterion | Result |
|---|-----------|--------|
| 23 | `record_slot` accepts all 10 writable slots (4 potenzial + 6 tazite) | ✅ PASS |
| 24 | `evidence_span`/`evidence_quote` grounding path unchanged | ✅ PASS |
| 25 | `governance` not a `SlotName` — separate `record_governance` tool | ✅ PASS |
| 26 | `record_governance` partial-write (only overwrites provided fields) | ✅ PASS |
| 27 | `register_step` sets `reihenfolge = current.length + 1` | ✅ PASS |
| 28 | `formatStepTracker` shows tazite fields + governance | ✅ PASS |
| 29 | `SLOT_PROMPT_HINT` covers all 10 new slot keys | ✅ PASS |
| 30 | Minimal prompt update present (analyst knows new writable fields) | ✅ PASS |

#### Datenbank-Migration
| # | Criterion | Result |
|---|-----------|--------|
| 31 | Migration at `supabase/migrations/20260617000000_proj25_prozesswissens_schema.sql` | ✅ PASS |
| 32 | All 6 old slot keys addressed (4 potenzial + rule_based + data_sources) | ✅ PASS |
| 33 | `role` → `governance.rolle` | ✅ PASS |
| 34 | `reihenfolge` from 1-based array index | ✅ PASS |
| 35 | Atomic (BEGIN/COMMIT) | ✅ PASS |
| 36 | DOWN script present | ✅ PASS |
| 37 | Idempotent (`is_legacy` check) | ✅ PASS |
| 38 | Empty arrays `[]` normalized to `value: null, nicht_befund_typ: null` | ✅ PASS (fixed post-QA) |

#### Schutzgut / Regressions-Guard
| # | Criterion | Result |
|---|-----------|--------|
| 39 | `TaziteSlot.quote` field preserved (grounding guard compatible) | ✅ PASS |
| 40 | `slotWriteRace.test.ts` green | ✅ PASS |
| 41 | Analyst remains exclusive writer of `step_tracker` | ✅ PASS |
| 42 | `npm test` green gesamt | ✅ PASS |

### Bugs Found

#### BUG-M1 (Medium) — Empty array `[]` not normalized in `normalizeStepEntry`

**Spec requirement:** Edge Cases + DB Migration AC: "Zwei leere Arrays ohne `nicht_befund_typ` ([]) werden zu `value: null, nicht_befund_typ: null` normalisiert."

**Problem:** `normalizeStepEntry` does not normalize empty arrays to `null` in two places:
1. In the legacy path (`data_sources → hilfsmittel`), if `data_sources.value = []`, the code produces `hilfsmittel = { value: [], ... }` — invalid per spec.
   - Code: `interviewSemantic.ts:185` → `value: Array.isArray(val) ? val : ...` returns `[]` when `val` is `[]`.
2. For tazite slots passed through directly (`tazite_cues`, `ausnahmen`, `inputs`, `outputs`), any JSONB entry with `value: []` is returned as-is.
3. The SQL migration also copies `data_sources.value` verbatim without empty-array guard.

**Steps to reproduce:**
```ts
const legacy = { title: 'Test', reihenfolge: 1, status: 'done', slots: {
  data_sources: { value: [], quote: '', confidence: 'confirmed' }
}}
const result = normalizeStepEntry(legacy, 1)
// result.slots.hilfsmittel.value === [] — should be null
```

**Impact:** Low in practice (record_slot rejects empty arrays at runtime; old entries rarely had `[]`), but violates explicit spec AC.

**Fix:** `normalizeArraySlot()` now also applied to `hilfsmittel` in the return statement (`interviewSemantic.ts`). Legacy path also fixed: `Array.isArray(val) && val.length > 0 ? val : ...`. SQL migration: added `jsonb_array_length() = 0 → 'null'::jsonb` guard. Tests added in `stepRevisionIntegrity.test.ts`. **Fixed 2026-06-18.**

---

#### BUG-L1 (Low) — Misleading comment in `processEnrichment.ts` ✅ Fixed

**Fixed 2026-06-17:** Comment updated to `// hilfsmittel from slots (normalizeStepEntry maps legacy data_sources here)`.

### Security Audit

PROJ-25 is a pure backend/service revision. No new attack surface:
- No new API endpoints or user-facing inputs
- SQL migration: parameterless, updates own JSONB structure only — no injection vector
- `evidence_span` validation in `record_slot`/`record_governance`: span must appear verbatim in current user turn (grounding guard intact)
- No new RLS implications (no new tables)
- No secrets exposure
- **Result: No security issues found**

### Regression Check

All features that depend on `step_tracker` JSONB reads were checked:
- `interviewOrchestrator.ts` reads from `potenzial` ✅
- `processEnrichment.ts` reads from `potenzial`/`governance`/`slots` via `normalizeStepEntry` ✅
- `interviewAnalyst.ts` merges both `potenzial` and `slots` ✅
- `chat/route.ts` normalizes all step_tracker reads via `normalizeStepEntry` ✅
- `slotWriteRace.test.ts` passes ✅

Coverage-Regression note: O1–O6 Coverage values drop systematically after PROJ-25 (9-field denominator vs old 4-field denominator, O2–O5 initially empty). **This is expected and correct** per spec and documented in the scorer.

### Summary

| Category | Result |
|----------|--------|
| Acceptance Criteria | 41/42 passed |
| Critical bugs | 0 |
| High bugs | 0 |
| Medium bugs | 0 |
| Low bugs | 0 |
| Security issues | 0 |

**Production-Ready: YES** — 0 open bugs. BUG-M1 fixed 2026-06-18, BUG-L1 fixed 2026-06-17.

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
