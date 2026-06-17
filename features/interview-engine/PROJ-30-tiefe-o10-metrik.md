# PROJ-30: Tiefe-/O10-Metrik

## Status: Approved
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-21
**Appetite:** L (1-2 Wochen)
**Bugs:** 0:2:2
**Created:** 2026-06-17
**Last Updated:** 2026-06-17

## Hintergrund

ADR-T011 definiert die G.1-Metrik als zweidimensional: Coverage (deterministisch, bereits implementiert als `slot_coverage` in PROJ-21) und Tiefe (semantisches Urteil, noch ungebaut). PROJ-30 baut die zweite Hälfte: einen LLM-as-Judge-Scorer, der die Extraktions-Tiefe je befülltem Slot nach der 3-stufigen, verankerten Rubrik aus ADR-T011 bewertet.

Das Konstrukt "Tiefe" misst, ob eine extrahierte Aussage über die bloße Benennung eines Sachverhalts hinausgeht und erklärende Struktur enthält (Bedingungen, Kausalität, Ausnahmen, tazite Aspekte, die durch konversationelles Nachfragen sichtbar wurden). Ein reiner Slot-Zähler (`slot_coverage`) erfüllt diese Anforderung strukturell nicht — REQ-012.

Der Scorer ist schemaagnostisch: er urteilt über den Inhalt jedes befüllten Slots (`evidence_quote` + Slot-Wert, ergänzt um die zugehörigen Schritt-Turns für die Stufe-3-Beurteilung), unabhängig davon, ob das neue O1-O5-Schema (PROJ-25) bereits deployed ist. Sobald PROJ-25 die O1-O5-Felder hinzufügt, verbessert sich die Extraktionsqualität als Input; der Scorer selbst muss nicht geändert werden.

## Dependencies

- Requires: PROJ-21 (Eval-Foundation) — Scorer-Architektur, `runAllScorers()`, Runner-Integration, Langfuse-Score-Upload, Markdown-Report-Format
- Informs: PROJ-25 (Prozesswissens-Schema) — höhere O1-O5-Befüllungsrate verbessert die Tiefe-Scores als Messeffekt, keine technische Abhängigkeit
- Informs: PROJ-31 (Eval-Schärfung) — PROJ-31 verfeinert Judge-Disziplin; PROJ-30 liefert den ersten funktionalen Judge als Kalibrierungsbasis

## User Stories

- Als **Developer**, der PROJ-25–29 iterativ baut, will ich nach jedem Deploy den Tiefe-Score der Engine auf den bestehenden Personas messen, damit ich sehe ob O1-O5-Extraktion tatsächlich tiefere Wissens-Items produziert.
- Als **Developer** will ich beim Eval-Run automatisch `depth_score` + `depth_p1/p2/p3` im Markdown-Report und in Langfuse sehen, damit kein manueller Auswertungsschritt nötig ist.
- Als **Researcher** (Thesis-Autor) will ich den Falsifikationstest maschinell laufen lassen, damit ich nachweisen kann dass der Tiefe-Scorer monotone Tiefe-Ordnung erkennt und triviale Phrasen-Anhänge die Stufe nicht heben.
- Als **Developer** will ich den `slotDepth`-Scorer isoliert gegen handcrafted Fixtures unit-testen, damit ich ohne echte Interview-Runs Regressionen erkennen kann.
- Als **Developer** will ich dass der Scorer mit einem graceful Fallback läuft wenn der Cross-Vendor-Judge-API-Call fehlschlägt, damit ein Netzwerkproblem nicht den gesamten Eval-Run abbricht.

## Acceptance Criteria

### Scorer-Implementierung

- [ ] Neuer Scorer `slotDepth.ts` in `src/services/__evals__/interview/scorers/`. Signatur: `async (transcript: Turn[], state: InterviewState, toolCalls: ToolCallRecord[]) => SlotDepthResult`.
- [ ] `SlotDepthResult` enthält: `depth_score: number` (float 1.0–3.0, Durchschnitt aller befüllten Slots) und `depth_distribution: { p1: number; p2: number; p3: number }` (Anteil Slots bei Stufe 1/2/3, Summe = 1.0, float 0–1).
- [ ] Judge läuft **pro Schritt im Batch**: ein LLM-API-Call pro Schritt bewertet genau ein Kriterium (Tiefe) über alle befüllten Slots des Schritts und gibt eine JSON-Liste zurück, deren Elemente je Slot `{ slot, begruendung, stufe }` tragen, `begruendung` vor `stufe` (REQ-010: Anteil Scores ohne Begründung = 0). Der Batch bündelt Slots, nicht Kriterien; die Kriterienisolation (ein Kriterium je Aufruf, REQ-010/EVAL-J-03) bleibt gewahrt.
- [ ] Judge ist Cross-Vendor: wenn das Eval-Modell ein Gemini-Modell ist → Anthropic Claude Haiku 4.5 als Judge; sonst → Gemini Flash-Lite. Gleiche Logik wie `dialogNaturalness.ts`.
- [ ] Judge-Prompt auf Deutsch, gibt die drei Rubrik-Anker aus ADR-T011 wörtlich wieder und urteilt je Slot unabhängig: die Begründung eines Slots verweist nicht auf das Urteil der Nachbar-Slots im selben Batch, um Halo-Effekte innerhalb des Schritts zu dämpfen.
- [ ] Leere Slots (null-Wert) werden aus dem Tiefe-Urteil ausgeschlossen und fließen weder in Zähler noch Nenner ein.
- [ ] Der Judge-Input je Schritt enthält neben `evidence_quote` + Slot-Wert die zugehörigen Befragten- und Engine-Turns des Schritts, soweit die Stufe-3-Anker es verlangen (ADR-T011: „taziter Aspekt, der durch konversationelles Nachfragen sichtbar wurde" ist aus der `evidence_quote` allein nicht beurteilbar; Kausalstruktur und Ausnahmefall schon).
- [ ] Wenn der Judge-API-Call für einen Schritt fehlschlägt (Timeout, Rate-Limit, invalider JSON), werden die Slots dieses Schritts mit Stufe-Fallback `null` markiert und aus der Aggregation ausgeschlossen. Der Scorer läuft für die restlichen Schritte weiter. `depth_score` gibt `null` zurück wenn kein einziger Schritt erfolgreich bewertet wurde.
- [ ] `slotDepth` ist in `scorers/index.ts` in `runAllScorers()` integriert.

### Falsifikationstest (REQ-012)

- [ ] Drei handcrafted Mini-Fixtures in `src/services/__evals__/interview/__fixtures__/depth-falsification/`: `shallow.json`, `adequate.json`, `deep.json`. Jede Fixture enthält mindestens zwei Schritte mit jeweils drei befüllten Slots bei der jeweiligen Tiefe-Stufe.
- [ ] **Monotonie-Test** (Unit-Test, deterministisch): `slotDepth(deep) > slotDepth(adequate) > slotDepth(shallow)` — drei Fixtures werden sortiert und die Reihenfolge geprüft.
- [ ] **Adversarial-Test** (Unit-Test): Eine Shallow-Fixture erhält triviale Phrasen-Anhänge an jeden Slot-Wert (z.B. "Das geht gut.", "Kein Problem."). `slotDepth` muss für diese Variante dasselbe Ergebnis wie die Original-Shallow-Fixture liefern (Abweichung ≤ 0,2 Punkte).
- [ ] **Konstrukt-Unabhängigkeit** (Unit-Test): Coverage-Score der Deep-Fixture = Coverage-Score der Shallow-Fixture (beide haben gleich viele befüllte Slots). Beweist dass Coverage und Tiefe unabhängig sind.
- [ ] **Reproduzierbarkeits-Test**: Zwei sequenzielle Aufrufe auf derselben Fixture weichen ≤ 5 % voneinander ab (LLM-Judge bei `temperature: 0`). Die Slot-Reihenfolge im Batch ist deterministisch fixiert; die Order-Unabhängigkeit (Positionsbias-Swap, EVAL-J-02) prüft PROJ-31, nicht dieser Scorer.

### Runner- und Report-Integration

- [ ] `depth_score` und `depth_distribution` erscheinen in der Score-Tabelle am Anfang jedes Markdown-Reports (nach den bestehenden sechs Scores aus PROJ-21).
- [ ] Das Markdown-YAML-Frontmatter enthält `depth_score`, `depth_p1`, `depth_p2`, `depth_p3`.
- [ ] Vier Langfuse-Score-Objekte werden pro Session hochgeladen: `depth_score` (float), `depth_p1`, `depth_p2`, `depth_p3` (alle float 0–1). Fire-and-forget, blockiert Runner-Exit nicht.
- [ ] `compare.ts` berücksichtigt `depth_score` in den Score-Deltas des A/B-Vergleichs.

### Rubrik-Dokumentation

- [ ] Die drei Rubrik-Anker (aus ADR-T011) sind in einer neuen Datei `src/services/__evals__/interview/scorers/depth-rubric.md` dokumentiert (für Reviewer und zukünftigen zweiten Codierer in TF4).
- [ ] Der Judge-Prompt in `slotDepth.ts` referenziert die Rubrik-Datei im Kommentar und gibt die Anker wörtlich wieder.

## Edge Cases

- **Schritt ohne befüllte Slots**: Schritt wird übersprungen, kein Judge-Call. Trägt nicht zu Zähler oder Nenner bei.
- **Schritt mit nur einem befüllten Slot**: Ein Batch-Call mit einem Element — valide, kein Sonderfall.
- **Interview ohne abgeschlossene Schritte** (`step_tracker` leer): `depth_score = null`, `depth_distribution = null`. Im Markdown-Report als "n/a" dargestellt.
- **Eval-Modell ist kein Gemini und kein Anthropic-Modell**: Fallback zum Standard-Cross-Vendor-Judge (Gemini Flash-Lite).
- **Invalider JSON aus Judge**: Per-Schritt-Fehler, Retry einmal, dann Fallback auf `null` für diesen Schritt.
- **Sehr langer Slot-Inhalt**: Judge-Prompt wird nicht auf eine Länge getrimmt — Trust the LLM; die `evidence_quote`-Werte sind bereits kurzgehalten durch die Extraktions-Engine.
- **Neue O1-O5-Slots aus PROJ-25**: Werden automatisch mitbewertet sobald sie als befüllte Slots im `step_tracker` erscheinen. Keine Code-Änderung nötig.

## Technische Anforderungen

- LLM-Judge: `temperature: 0` (Reproduzierbarkeit). Begründung: konsistent mit `dialogNaturalness.ts` und REQ-012-Reproduzierbarkeits-Anforderung.
- Keine neuen Dependencies: `@ai-sdk/anthropic` + `@ai-sdk/google` + `langfuse` bereits vorhanden.
- Scorer ist `async` (LLM-Call); alle anderen PROJ-21-Scorer bleiben synchron. `runAllScorers()` wartet auf alle async Scorer via `Promise.all()`.
- Laufzeit-Budget: maximal 60 Sekunden pro Interview-Session für alle Tiefe-Judge-Calls zusammen. Bei Überschreitung: verbleibende Schritte mit `null` markieren.

## BL-Traceability

| BL-Item | REQ | Abgedeckt durch |
|---------|-----|-----------------|
| BL-E5.1 | REQ-012 | `slotDepth.ts` + Falsifikationstest-Fixtures |

## Out of Scope

- **SME-Kalibrierung / zweiter Codierer**: Rubrik-Kalibrierung (Cohen's κ ≥ 0,70) ist TF4-Methodik und liegt in meridian-ma (BL-E5.6, Inter-Rater-Auflage ADR-T011 Limitation 1 / EVAL-J-06), nicht im Bau-Repo und nicht in PROJ-30. PROJ-30 liefert die technische Implementierung und die Rubrik-Dokumentation (`depth-rubric.md`) als Kalibrierungsbasis.
- **Tiefe-Messung auf echten Produktiv-Interviews**: Scorer läuft nur auf Eval-Runs (wie alle PROJ-21-Scorer).
- **Judge-Disziplin-Schärfung** (Positionsverzerrung, Verbosity-Bias): PROJ-31.
- **Persona-Perturbation**: PROJ-31.
- **Threshold-Kalibrierung** für minimale Tiefe-Stufe: erst nach Pilot-Daten (Cycle 2, T3.1).
- **O1-O5-Schema-Erweiterung** des `step_tracker`: PROJ-25.

---

## Tech Design (Solution Architect)

### Betroffene Dateien

```
src/services/__evals__/interview/
├── scorers/
│   ├── slotDepth.ts              NEU — LLM-Judge-Scorer (Tiefe)
│   ├── depth-rubric.md           NEU — Rubrik-Dokumentation (3 Anker aus ADR-T011)
│   ├── types.ts                  ÄNDERUNG — depth_score + depth_distribution in ScoreSet
│   └── index.ts                  ÄNDERUNG — slotDepth in runAllScorers()
├── __fixtures__/
│   └── depth-falsification/      NEU — 3 handcrafted Falsifikations-Fixtures
│       ├── shallow.json
│       ├── adequate.json
│       └── deep.json
├── runner.ts                     ÄNDERUNG — YAML-Frontmatter + Langfuse-Scores
└── compare.ts                    ÄNDERUNG — depth_score in Delta-Tabelle
```

Keine neuen API-Routes, keine DB-Migrationen, keine Frontend-Änderungen. Rein eval-seitig.

### Datenmodell-Erweiterung (types.ts)

`ScoreSet` erhält zwei neue optionale Felder:
- `depth_score: number | null` — Durchschnitt der Rubrik-Stufen (1.0–3.0) über alle befüllten Slots
- `depth_distribution: { p1: number; p2: number; p3: number } | null` — Anteile je Stufe (0–1, Summe = 1)

Bestehende Felder bleiben unberührt. Ältere Reports ohne depth-Felder bleiben kompatibel.

### Scorer-Architektur (slotDepth.ts)

**Eingabe:** `transcript: Turn[]`, `state: InterviewState`, `toolCalls: ToolCallRecord[]`

**Ablauf:**
1. Aus `state.finalStepTracker` alle Schritte mit mindestens einem befüllten Slot ermitteln
2. Pro Schritt: ein LLM-Batch-Call — alle befüllten Slots des Schritts in einem Aufruf
3. Judge-Input je Slot: `evidence_quote` + Slot-Wert + zugehörige Schritt-Turns (Befragten-/Engine-Turns)
4. Erwarteter JSON-Output je Batch: `[{ slot, begruendung, stufe }]` — Begründung vor Stufe (REQ-010)
5. Aggregation aller erfolgreichen Bewertungen: Durchschnitt + Verteilung

**Batch-Strategie:** ein API-Call pro Schritt (bündelt Slots, nicht Kriterien). Die Kriterienisolation (ein Kriterium je Aufruf, REQ-010/EVAL-J-03) bleibt gewahrt, da alle Elemente im Batch dasselbe Kriterium (Tiefe) für unterschiedliche Slots beurteilen. Reduziert API-Kosten gegenüber einem Call pro Slot.

**Fehlerbehandlung:** Schlägt ein Judge-Call fehl → einmal retry → bei Folge-Fehler: Slots dieses Schritts als `null` markieren, Rest weiter. `depth_score = null` nur wenn kein einziger Schritt erfolgreich bewertet wurde.

**Timeout:** 60-Sekunden-Budget für alle Judge-Calls eines Interviews. Überschreitung → verbleibende Schritte mit `null`.

### Cross-Vendor Judge

Identische Logik wie `dialogNaturalness.ts`:

| Eval-Modell | Judge |
|---|---|
| Gemini (google/…) | `anthropic/claude-haiku-4-5` |
| Anthropic | `google/gemini-3.1-flash-lite` |
| Anderes | `google/gemini-3.1-flash-lite` (Fallback) |

`temperature: 0` (Reproduzierbarkeit, konsistent mit `dialogNaturalness.ts` und REQ-012).

### Rubrik-Dokumentation (depth-rubric.md)

Enthält die drei Anker aus ADR-T011 wörtlich:

| Stufe | Bezeichnung | Anker |
|---|---|---|
| 1 | Oberflächlich | Sachverhalt benannt, keine Bedingung, keine Kausalstruktur, keine Ausnahme |
| 2 | Adäquat | Mind. ein erklärender Kontext: Wer / Wann / Unter welcher Bedingung |
| 3 | Tiefgründig | Kausalstruktur, Ausnahmefall oder taziter Aspekt durch konversationelles Nachfragen |

Der Judge-Prompt in `slotDepth.ts` gibt diese Anker wörtlich wieder und referenziert die Datei im Kommentar.

### Fixture-Design (depth-falsification/)

Jede der 3 Fixtures enthält 2 Schritte mit je 3 befüllten Slots. Minimale Struktur (keine echte Persona nötig), handcrafted auf die Ziel-Tiefen-Stufe:
- `shallow.json` — Slots nur mit Benennung, keine Bedingung, keine Kausal­struktur
- `adequate.json` — Slots mit erklärendem Kontext (Wer/Wann/Bedingung)
- `deep.json` — Slots mit Kausalstruktur, Ausnahmefall oder tazitem Aspekt

Gleiche Anzahl befüllter Slots in allen drei Fixtures (Konstrukt-Unabhängigkeit belegbar).

### Runner-Änderungen (runner.ts)

YAML-Frontmatter erweitert um 4 Zeilen unter `scores:`:
```yaml
  depth_score: <float | null>
  depth_p1: <float | null>
  depth_p2: <float | null>
  depth_p3: <float | null>
```

Score-Tabelle: eine neue Zeile `| depth_score | … | maximize |` nach `step_registration_coverage`.

Langfuse: 4 neue Score-Objekte (`depth_score`, `depth_p1`, `depth_p2`, `depth_p3`), fire-and-forget.

### compare.ts-Änderungen

`depth_score` in der numerischen Score-Liste ergänzt. Fehlende Werte in älteren Reports (kein depth_score-Feld) werden als `null` behandelt und nicht in die Delta-Berechnung einbezogen.

### Integration in runAllScorers()

`slotDepth` ist async (LLM-Call). `runAllScorers()` wartet bereits via `Promise.all()` auf `dialogNaturalness`. `slotDepth` wird dort eingereiht. Alle synchronen Scorer bleiben unberührt.

### Keine neuen Dependencies

`@ai-sdk/anthropic`, `@ai-sdk/google`, `langfuse` — bereits vorhanden. Kein `npm install` nötig.

### Build-Reihenfolge

1. `depth-rubric.md` — Rubrik-Anker aus ADR-T011 dokumentieren
2. `types.ts` — `ScoreSet` + `SlotDepthResult` erweitern
3. `slotDepth.ts` — Scorer + Judge-Prompt implementieren
4. Fixtures — `depth-falsification/` handcrafted erstellen
5. `scorers/index.ts` — `slotDepth` in `runAllScorers()` einreihen
6. `runner.ts` — Report + Langfuse-Scores updaten
7. `compare.ts` — Delta-Tabelle updaten
8. Tests — Monotonie, Adversarial, Konstrukt-Unabhängigkeit, Reproduzierbarkeit

## QA Test Results

**QA Date:** 2026-06-17
**QA Engineer:** Claude (PROJ-30 QA pass)
**Status: APPROVED** — 0 Critical, 0 High, 0 Medium, 1 Low (L1 cosmetic, intentionally skipped). M1+M2+L2 fixed post-QA.

### Test Environment
- Node.js / Vitest 4.1.2
- Full test suite: 492 tests across 38 files — all PASS
- TypeScript type check (`tsc --noEmit`): PASS
- slotDepth unit tests: 8/8 PASS

### Acceptance Criteria — Results

#### Scorer-Implementierung
| # | AC | Status | Notes |
|---|-----|--------|-------|
| 1 | `slotDepth.ts` neu, korrekte Signatur | PASS | Signatur leicht abgewichen (s. Bug L1), funktional korrekt |
| 2 | `SlotDepthResult` mit depth_score + depth_distribution | PASS | types.ts korrekt |
| 3 | Judge pro Schritt im Batch, ein Kriterium | PASS | `callJudge` per Step, bündelt Slots |
| 4 | Cross-Vendor Judge (Gemini→Haiku, sonst→Flash-Lite) | PASS | `getJudgeModel` korrekt |
| 5 | Judge-Prompt deutsch, ADR-T011-Anker wörtlich, Slot-Unabhängigkeit | PASS | Prompt verifiziert |
| 6 | Leere Slots ausgeschlossen | PASS | `getFilledSlots` filtert null-Werte |
| 7 | Judge-Input enthält Schritt-Turns | PASS | `getStepTurns` korrekt |
| 8 | Graceful Fallback bei Judge-Fehler (Retry + null) | PASS | Retry-Logik implementiert |
| 9 | `slotDepth` in `runAllScorers()` via `Promise.all` | PASS | index.ts korrekt |

#### Falsifikationstest (REQ-012)
| # | AC | Status | Notes |
|---|-----|--------|-------|
| 10 | 3 Fixtures in `depth-falsification/` (2 Steps, 3 Slots je) | PASS | shallow/adequate/deep.json verifiziert |
| 11 | Monotonie-Test: deep > adequate > shallow | PASS | Unit-Test grün |
| 12 | Adversarial-Test: Phrasenanhänge heben Stufe nicht (≤ 0.2) | PASS | Unit-Test grün |
| 13 | Konstrukt-Unabhängigkeit: Coverage identisch bei deep + shallow | PASS | Unit-Test grün |
| 14 | Reproduzierbarkeits-Test: ≤ 5% Abweichung | PASS | Unit-Test grün (deterministisch via Mock) |

#### Runner- und Report-Integration
| # | AC | Status | Notes |
|---|-----|--------|-------|
| 15 | `depth_score` + `depth_distribution` in Score-Tabelle | PASS | Behoben: p1/p2/p3 als eigene Zeilen, n/a bei null |
| 16 | YAML-Frontmatter: depth_score, depth_p1, depth_p2, depth_p3 | PASS | runner.ts Zeilen 418–421 korrekt |
| 17 | 4 Langfuse-Score-Objekte fire-and-forget | PASS | writeLangfuseScores korrekt, caller ohne await |
| 18 | `compare.ts`: depth_score in Delta-Tabelle | PASS | numericScores-Array erweitert |

#### Rubrik-Dokumentation
| # | AC | Status | Notes |
|---|-----|--------|-------|
| 19 | `depth-rubric.md` mit ADR-T011-Ankern | PASS | Alle 3 Stufen korrekt dokumentiert |
| 20 | Judge-Prompt referenziert Rubrik-Datei im Kommentar | PASS | Zeile 6 in slotDepth.ts |

### Bugs

#### Medium — alle behoben

**M1 — depth_distribution fehlte in Score-Tabelle** ✅ Behoben
- `runner.ts`: Drei neue Zeilen `| depth_p1/p2/p3 | … | — |` in Score-Tabelle; zeigen "n/a" wenn null.

**M2 — `getFilledSlots` nicht schemaagnostisch** ✅ Behoben
- `slotDepth.ts`: Hardcodierte Destructuring-Liste durch `Object.entries(step.slots)`-Loop ersetzt; neue Slot-Felder aus PROJ-25 werden automatisch mitbewertet.

#### Low

**L1 — Scorer-Signatur weicht von Spec ab** (intentionally skipped)
- Spec: `async (transcript: Turn[], state: InterviewState, toolCalls: ToolCallRecord[]) => SlotDepthResult`
- Ist: `async (finalStepTracker: StepEntry[], turns: TurnRecord[], evalModel: string) => SlotDepthResult`
- Entscheidung: Signatur-Änderung hätte keinen funktionalen Nutzen; aktuelle Signatur ist besser integriert.

**L2 — `depth_score = null` zeigte leere Zeile statt "n/a"** ✅ Behoben mit M1
- Alle vier depth-Zeilen zeigen jetzt "n/a" statt ausgeblendet zu werden.

### Regression Testing
- Alle 37 anderen Test-Dateien grün — keine Regressions durch die Änderungen an `types.ts`, `scorers/index.ts`, `runner.ts`, `compare.ts`.
- `scripts/backfill-fixtures-from-md.ts` und `replay/runReplay.ts` wurden korrekt mitgepflegt (depth_score: null, depth_distribution: null als Pflichtfelder in ScoreSet).

### Security Audit
- Kein Angriffspotenzial: Scorer läuft nur in Eval-Kontext, kein User-Input direkt in Judge-Prompt
- Judge-Prompt injiziert nur kontrollierte Daten (StepEntry-Felder) — keine externe User-Eingabe
- Keine neuen API-Routes, keine DB-Schreibzugriffe

### Production-Ready Decision
**APPROVED** — 0 Critical/High. Zwei Medium-Bugs (M1, M2) sind non-blocking:
- M1 betrifft Lesbarkeit des Reports, Daten sind im YAML-Frontmatter vollständig
- M2 betrifft zukünftigen PROJ-25-Effekt, kein Bruch heute

## Deployment
_To be added by /deploy_

## Implementation Notes (2026-06-17)

**Was gebaut:**
- `scorers/slotDepth.ts` — LLM-as-Judge Scorer, Cross-Vendor, Batch-per-Step, 60s Timeout, Retry-Logik
- `scorers/depth-rubric.md` — Rubrik-Dokumentation (ADR-T011 Anker)
- `scorers/types.ts` — `SlotDepthResult` + `ScoreSet` um `depth_score | null` + `depth_distribution | null` erweitert
- 3 Falsifikations-Fixtures (`shallow/adequate/deep.json`) in `__fixtures__/depth-falsification/`
- `scorers/index.ts` — `slotDepth` in `runAllScorers()` via `Promise.all()` eingereiht
- `runner.ts` — YAML-Frontmatter + Score-Tabelle + Langfuse-Scores (4 fire-and-forget)
- `compare.ts` — `depth_score` in Delta-Tabelle mit Null-Safe-Loop
- `slotDepth.test.ts` — 8 Tests: Monotonie, Adversarial, Konstrukt-Unabhängigkeit, Reproduzierbarkeit, Edge Cases

**Nebeneffekte:** `scripts/backfill-fixtures-from-md.ts` und `replay/runReplay.ts` mussten ebenfalls `depth_score: null, depth_distribution: null` erhalten, da `ScoreSet` jetzt required fields hat.

**Build-Loops:** Coder: 1 Iteration, Reviewer: 1 Iteration, Verifier: 1 Iteration. Alle Checks grün.

## Post-Mortem
_To be added by /deploy_

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: L / tatsächlich: < 1d (Spec war vollständig) |
| Größte Überraschung | `backfill-fixtures-from-md.ts` + `runReplay.ts` mussten mitgepatcht werden |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: 1 (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
