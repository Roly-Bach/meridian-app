# PROJ-27: Schema-Bindung + verlustfreie Speicherung

## Status: Planned
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-22
**Appetite:** L
**Bugs:** —
**Created:** 2026-06-16
**Last Updated:** 2026-06-16

## Kontext

PROJ-27 bündelt drei eng verwandte BL-Items aus Epic 1 (Prozesswissens-Schema):

| BL-Item | Titel | REQ |
|---------|-------|-----|
| BL-E1.3 | Schema-Bindung + Werteraum-Constraints + Konformitätsrate | REQ-003 |
| BL-E1.4 | Stabile Schritt-IDs + JSON-Patch-Revision | REQ-005 |
| BL-E1.5 | Lost-Update-Race-Fix (atomare Slot-Writes) | REQ-015 |

Alle drei setzen PROJ-25 voraus (neues `StepEntry`-Schema mit O1–O6-Feldern). Sie teilen sich denselben Schreibpfad (`record_slot` → `interview_state.step_tracker`) und sind daher in einer Revision sinnvoll bündelbar.

**Aktueller Zustand (Probleme):**

1. **Kein stabiles Step-Lookup**: `findStepFuzzy` matcht per Titel (tokenJaccardNorm ≥ 0.4). Leichte Titelabweichungen erzeugen Fehlzuordnungen oder "Schritt nicht gefunden"-Fehler.
2. **Read-Modify-Write-Race (L4)**: Zwei parallele `record_slot`-Aufrufe (Online-Analyst + Catchup oder Quick-Extract) lesen denselben `step_tracker`-Snapshot und schreiben den vollen Array zurück. Last-write-wins löscht den anderen Slot (dokumentiert in `slotWriteRace.test.ts`).
3. **`next_briefing`-Race**: `runAnalystCatchup` überschreibt `next_briefing` auch dann, wenn `runAnalystOnline` bereits erfolgreich geschrieben hat (QA-C2-M2).
4. **Keine Schema-Konformitätsmessung**: Slot-Werte werden durch Zod an der Tool-Grenze geprüft, aber nicht gegen das Zielschema `prozessschritt-schema.json` validiert. Constraint-Verletzungen (Typ, Werteraum, Muster) sind unsichtbar.

## Dependencies

- Requires: PROJ-25 (Prozesswissens-Schema O1–O5 + Governance) — liefert neues `StepEntry` mit O2–O5-Feldern, `reihenfolge`, `abhaengigkeiten`-Placeholder, `potenzial`, `governance`; die O1–O6-Coverage-Feldliste lebt **separat** von `MANDATORY_SLOTS`/`SlotName` (PROJ-25-Korrektur), und die taziten Slots behalten den `quote`-Evidence-Span
- Requires: PROJ-22 (Dual-Loop Interview Engine) — `record_slot`, `runAnalystOnline`, `runAnalystCatchup`, `findStepFuzzy` sind der Schreibpfad, der hier fixiert wird
- Enables: PROJ-28 (Extraktions-Zuverlässigkeit) — verlässliche Slot-Writes als Voraussetzung
- Enables: PROJ-29 (Gesprächsführungs-Revision) — Analyst braucht stabile Step-Referenz

## User Stories

- Als Analyst möchte ich Prozessschritte per stabiler ID (S001, S002...) referenzieren statt per Titel, damit Tippfehler und Titelabweichungen keine Fehlzuordnungen mehr erzeugen.
- Als System möchte ich, dass parallele `record_slot`-Aufrufe (Online- und Catchup-Analyst) keinen Lost-Update erzeugen, damit alle Slot-Writes verlustfrei im Tracker landen, auch bei langen Sessions.
- Als System möchte ich, dass `runAnalystCatchup` das Online-Briefing nicht überschreibt, wenn der Online-Analyst bereits erfolgreich abgeschlossen hat, damit kein korrektes Briefing verloren geht.
- Als Entwickler möchte ich im Eval-Scorer eine Schema-Conformance-Rate sehen, damit ich erkenne, wenn Slot-Werte außerhalb der Zielschema-Constraints liegen.
- Als Entwickler möchte ich Constraint-Verletzungen in Langfuse sehen (non-blocking), damit Extraktionsfehler ohne manuellen Eval-Lauf sichtbar sind.
- Als System möchte ich, dass Sessions mit altem `step_tracker`-Format (ohne `id`-Feld) weiterhin funktionieren, damit kein laufendes Interview durch das Deployment unterbrochen wird.

## Acceptance Criteria

### BL-E1.4 — Stabile Schritt-IDs

- [ ] `StepEntry` (`interviewSemantic.ts`) erhält neues Feld `id?: string` (Format `^S[0-9]{3}$`)
- [ ] `register_step` vergibt `id` automatisch beim Anlegen: `S${String(tracker.length + 1).padStart(3, '0')}` (S001, S002, ..., S999)
- [ ] `id` wird in `step_tracker`-JSONB persistiert (Teil des `StepEntry`-Objekts)
- [ ] `record_slot` erhält neuen optionalen Parameter `step_id?: string` (z.B. "S001")
- [ ] Lookup-Priorität in `record_slot`: `step_id`-Match → `findStepFuzzy`-Fallback (für Sessions ohne `id`)
- [ ] Wenn `step_id` übergeben, aber nicht im Tracker gefunden: Fehlermeldung mit verfügbaren IDs + Titeln
- [ ] `formatStepTracker` zeigt `id` pro Schritt im Analyst-Kontext an (damit Analyst die IDs kennt)
- [ ] `buildDynamicContext` stellt dem Analyst die aktuelle ID-Titelliste zur Verfügung
- [ ] `findStepFuzzy` bleibt im Code als Fallback-Funktion — kein Removal in PROJ-27

#### Revisionsintegrität (REQ-005, Kern von BL-E1.4)

- [ ] Nach einer Revision (erneuter `record_slot` auf einen schon befüllten Schritt, mit oder ohne `is_correction`) sind alle **nicht**-revidierten Felder des Schritts identisch zur Vorversion (REQ-005, binär). Der `jsonb_set`-Einzelpfad (BL-E1.5) ist der Mechanismus dafür.
- [ ] Test `stepRevisionIntegrity.test.ts`: JSON-Diff vor/nach über ≥ 20 synthetische Revisionsfälle; ausschließlich das revidierte Feld ändert sich, alle übrigen Felder (inkl. `quote`/`confidence`/`nicht_befund_typ` anderer Slots) bleiben byte-identisch.
- [ ] REQ-005-Schärfung (Propagation): ein per `is_correction=true` korrigierter Wert propagiert nicht als alter Wert in Folge-Turns; Test injiziert eine Korrektur und prüft, dass der alte Wert in keinem späteren Turn-Stand wieder auftaucht.

### BL-E1.5 — Lost-Update-Race-Fix

- [ ] `record_slot` ersetzt das vollständige Read-Modify-Write durch einen `jsonb_set`-Einzelpfad-Update auf Supabase:
  `UPDATE interview_state SET step_tracker = jsonb_set(step_tracker, $path, $value) WHERE interview_id = $id`
  wobei `$path` den Array-Index + Slot-Pfad kodiert (z.B. `{0,slots,entscheidungslogik}`)
- [ ] Der Step-Index (`number`) wird einmalig per ID-Lookup (oder `findStepFuzzy`) ermittelt, dann im `jsonb_set`-Aufruf fix kodiert
- [ ] Schreibpfade `analyst_online`, `analyst_catchup`, `quick`, `backfill` nutzen alle denselben `jsonb_set`-Mechanismus
- [ ] L4-Test in `slotWriteRace.test.ts` wird auf den neuen Pfad aktualisiert und zeigt: concurrent writes auf verschiedene Slots sind verlustfrei
- [ ] Neuer Test: concurrent writes auf denselben Slot (last-write-wins ist korrekt, kein Absturz)
- [ ] `runAnalystCatchup` schreibt `next_briefing` nur via Conditional UPDATE: `UPDATE interviews SET next_briefing = $briefing WHERE id = $id AND analyst_status != 'done'`
- [ ] Wenn Conditional UPDATE 0 rows betrifft (Online-Run war schneller): kein Fehler, Catchup fährt fort ohne `next_briefing` zu überschreiben
- [ ] Test für Catchup Conditional UPDATE: wenn `analyst_status='done'`, bleibt `next_briefing` unverändert

#### Schreibquellen-Präzedenz erhalten (BL-E1.4, in die Patch-Semantik überführt)

- [ ] Der neue `jsonb_set`-Pfad erhält die Schreibquellen-Präzedenz (`canOverwrite(prevSlotValue.writeSource, writeSource)`, `slotConflictResolver`) und den `is_correction`-Bypass (`interviewAgent.ts:977-1010`). Eine niedriger-priore Quelle (z.B. `backfill`) darf einen höher-prioren Wert nicht überschreiben.
- [ ] Die Prüfung läuft TOCTOU-sicher: Vorwert lesen → `canOverwrite`/`is_correction` auswerten → `jsonb_set`. Bevorzugt als **bedingter** Write (Präzedenz im `WHERE`/SQL-Prädikat) oder in einer Transaktion, damit zwischen Lesen und Schreiben kein konkurrierender Write die Präzedenz aushebelt.
- [ ] Test: konkurrierender `backfill`-Write auf einen `analyst`-Slot wird abgewiesen (Präzedenz greift); `is_correction=true` hebt die Sperre auf.

#### Erhaltung über lange Sessions (REQ-015)

- [ ] Erhaltungstest über Sessions mit 3/6/10/15+ Turns: bis Turn T bestätigte Aspekte sind in T+1 noch vorhanden (Erhaltungsquote ≥ Schwelle, REQ-015). Basis: Audit des `step_tracker` je Turn.
- [ ] Injektionstest: ein vom Befragten genannter, schemafremder Aspekt erscheint im finalen Stand (wird nicht verworfen). Die non-blocking Schema-Konformität (BL-E1.3, `console.warn` statt Hard-Error) ist der Schutz dafür und darf hier nicht zu einem Drop führen.

### BL-E1.3 — Schema-Bindung + Konformitätsrate

#### Export-/Grenzobjekt-Bindung (Voraussetzung der Konformitätsmessung)

- [ ] `toGrenzobjekt(step: StepEntry): Schritt` — Mapping der App-internen Form auf die Ziel-Schema-Form (`prozessschritt-schema.json`, deutsche Feldnamen). PROJ-25 hat diese Bindung explizit an PROJ-27 delegiert:
  - `title` → `bezeichnung` (SlotString); `reihenfolge` → `reihenfolge`
  - O2–O5 `slots.*` → `entscheidungslogik`/`tazite_cues`/`ausnahmen`/`inputs`/`outputs`/`hilfsmittel`; je Slot `value` → `wert`, `confidence`-Enum → numerische `konfidenz` (feste Abbildung `confirmed`=0.9 / `estimate`=0.6 / `unknown`=0.3, deckt sich mit der `konfidenz`-Steuertabelle der Schema-Spec; `/architecture` darf die Werte verfeinern), `nicht_befund_typ` übernehmen; `quote` ist app-intern und nicht Teil der Export-Form
  - `potenzial.*` englische → deutsche Keys (`frequency_per_month` → `haeufigkeit_pro_monat` etc., SlotNumber); `governance`-Objekt übernehmen; `abhaengigkeiten` (PROJ-26-Typ, in PROJ-27 placeholder)
  - `id` muss gesetzt sein (BL-E1.4); fehlt sie (Alt-Session), wird sie beim Mappen vergeben
- [ ] Das kanonische `prozessschritt-schema.json` (v1.2; SSoT liegt in meridian-ma) wird in die App vendored (kopiert, **nicht** handgepflegt). Ein Guard-Test/Kommentar hält fest, dass die Kopie der meridian-ma-Quelle entspricht (manueller Sync bei Schema-Änderung), damit das Schema die einzige Regelquelle bleibt.

#### Konformitätsrate (REQ-003)

- [ ] Neuer Eval-Scorer `schemaConformanceRate` (`src/services/__evals__/interview/scorers/schemaConformanceRate.ts`):
  - mappt jeden Schritt via `toGrenzobjekt` und validiert ihn mit **`ajv`** gegen die `Schritt`-Definition (`#/definitions/Schritt`) des kanonischen Schemas
  - Score: Anteil konformer Schritte je Session (0.0–1.0), Ziel ≥ 0.95 (REQ-003-Erfolgskriterium)
  - erfasst Verletzungen strukturiert aus den ajv-Errors (welcher Schritt, welches Feld, welche Constraint)
- [ ] Scorer ist in `scorers/index.ts` + `runner.ts` + Langfuse-Entries integriert
- [ ] `schemaConformanceRate.test.ts`: happy path (alle Felder konform) + je 1 Verletzungsfall pro Feldtyp (SlotString/`bezeichnung`, SlotStringArray, GovernanceSlot, Potenzial-SlotNumber, `id`-Muster `^S[0-9]{3}$`)
- [ ] Runtime-Logging: `record_slot` logt Konformitätsverletzungen per `console.warn` + Langfuse-Span-Attribut `conformanceViolation: true` — kein Hard-Error, Interview läuft weiter (Schutz für REQ-015: schemafremde Nennungen werden nicht verworfen)
- [ ] Neue Abhängigkeit `ajv` (kleines Standard-Package) zugelassen. Begründung: ein externer JSON-Schema-Validator gegen das Ziel-Schema (Build-Backlog BL-E1.3, REQ-003-Messvorschrift); das Schema bleibt Single Source of Truth statt in Zod dupliziert zu werden. Die bestehende Zod-Prüfung an der Tool-Grenze bleibt (Eingangs-Türsteher), ajv kommt für die Ziel-Schema-Konformität hinzu.

### Regressions-Guard

- [ ] `slotWriteRace.test.ts` komplett grün nach jsonb_set-Migration (L4-REPRO-Test angepasst oder entfernt, Erklärkommentar aktualisiert)
- [ ] Replay-Regressions-Korpus (ADR-015) läuft grün: `npm run eval:replay`
- [ ] `npm test` grün gesamt (alle bestehenden Unit + E2E-Tests)
- [ ] Eval-Gate: `npm run eval:interview buchhalter` — Interview-Vollständigkeit ≥ Baseline von PROJ-22/PROJ-25

## Edge Cases

- **Sessions ohne `id` in StepEntry** (vor PROJ-27): `record_slot` fällt auf `findStepFuzzy` zurück, kein Fehler. Sessions nach dem Deploy bekommen automatisch IDs (ab erstem neuen `register_step`-Aufruf).
- **`step_id` übergeben, aber nicht im Tracker**: Fehlermeldung mit verfügbaren `id`-Titel-Paaren zurückgeben. Analyst kann korrigieren.
- **jsonb_set mit Step-Index**: Array-Indizes in `step_tracker` sind stabil (Schritte werden nur angehängt, nie gelöscht oder umsortiert). Ein einmalig ermittelter Index bleibt gültig für den folgenden `jsonb_set`-Aufruf.
- **Catchup Conditional UPDATE, 0 rows affected**: No-op, kein Fehler. Catchup logt den Skip.
- **schemaConformanceRate mit O2–O5 null**: Konformität misst **Struktur/Typen/Muster**, nicht Befüllung. Ein Slot-Objekt mit `wert: null` ist schema-konform (das Feld ist vorhanden, `wert` darf null sein), die Konformitätsrate bleibt also hoch. Die systematische Senkung durch initial leere O2–O5 betrifft die **Coverage** (separater Scorer, PROJ-25/PROJ-30), nicht diesen Scorer. Beide Metriken nicht verwechseln.
- **S001–S999 erschöpft (>999 Schritte)**: Nicht vorgesehen für Interview-Sessions (max ~20 Schritte). Kein Guard nötig.
- **Gleichzeitige `register_step`-Aufrufe** (zwei Schritte werden im selben Turn registriert): Analyst-Regeln erlauben nur einen `register_step` pro Turn. Falls dennoch parallel: IDs können kollidieren (S002 doppelt). Mitigation: `register_step` prüft nach ID-Vergabe ob die ID bereits vorhanden ist, inkrementiert ggf.
- **jsonb_set und Supabase `maybeSingle`**: Der `step_tracker`-Read vor `jsonb_set` wird weiterhin benötigt (um den Step-Index zu ermitteln). Der Read kann nach dem `jsonb_set`-Write noch den alten Wert zeigen (Supabase-Latenz) — das ist akzeptabel, weil der nächste Analyst-Turn frisch lädt.

## Technical Requirements

- `jsonb_set`-Pfad: Supabase `.rpc()` oder `.update()` mit SQL-Template — kein ORM-Wrapping. Pfad-Konstruktion in TypeScript vor dem DB-Call.
- `step_id`-Feld im Analyst-Kontext: In `buildDynamicContext` ergänzen (Format: `[S001] Monatsabschluss-Prüfung`, `[S002] SAP-Buchung` etc.)
- `schemaConformanceRate`-Scorer: TypeScript-Logik plus `ajv` (kein LLM-Call), importierbar aus Eval-Runner ohne Next.js-Kontext (gleiche Constraint wie `interviewSemantic.ts`). `toGrenzobjekt`-Mapping und ajv-Validierung liegen im selben Off-Next.js-importierbaren Modul.
- Vendored Schema: `prozessschritt-schema.json` (v1.2) wird aus meridian-ma in die App kopiert (z.B. neben den Scorer), nicht handgepflegt; Sync-Guard hält Quelle und Kopie deckungsgleich.
- Kein neues DB-Schema: `step_tracker`-JSONB-Format ist PROJ-25 die maßgebliche Typdefinition; PROJ-27 fügt nur `id` zur bestehenden `StepEntry`-Struktur hinzu

---
<!-- Sections below are added by subsequent skills -->

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
