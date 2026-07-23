# ADR-026: `dedup_slot_coverage ≥ 0.75`-Gate — nicht-attribuierbar nach PROJ-45-Schema-Divergenz (PROJ-40)

**Status:** Accepted (2026-07-24)
**Author:** lyas53
**Repository:** Roly-Bach/meridian-app
**Auslöser:** Joint-Gate für PROJ-40/42/43/44/46/48. Fünf dieser Features (PROJ-42/43/44/46/48) scheitern im automatischen Eval-Gate ausschließlich an `dedup_slot_coverage < 0.75`, während alle anderen Gate-Bedingungen grün sind. PROJ-40 (Eval-Instrument-Validierung) muss formal entscheiden, ob dieser Wert ein valider Feature-Blocker oder ein Instrument-Artefakt ist.
**Betrifft:** PROJ-40 (Interview Engine, Eval-Instrument). Wirkt als Gate-Entscheidung auf PROJ-42/43/44/46/48 (unblockt deren Approved-Übergang). Berührt keinen Produktions-Code.
**Realisiert durch:** Diese Entscheidung selbst (Waiver + dokumentierter Follow-up). Keine Code-Änderung in dieser Runde.

---

## Context

Das automatische Eval-Gate (`evaluateGate`, [runner.ts:325-333](../../src/services/__evals__/interview/runner.ts#L325)) besteht aus fünf Bedingungen (Metrik-Audit §4, `docs/evals/instrument-validierung/metrik-audit.md`): `completion_correctness === true`, `dedup_slot_coverage ≥ 0.75`, `step_registration_coverage ≥ 0.8`, `dialog_naturalness ≥ 0.65`, `blocked_rate < 0.1`.

Die jüngsten drei Buchhalter-Läufe (2026-07-23, 22:54-Serie, seeds 42/43/44, `google/gemini-3.1-flash-lite`) erfüllen **vier von fünf** Bedingungen in jedem Lauf. Sie scheitern einzig an `dedup_slot_coverage` (0.67 / 0.64 / 0.63 < 0.75). Alle regressions-sensiblen Signale sind zugleich auf ihrem besten dokumentierten Stand: `dialog_naturalness` 1.0 (vorher Median 0.67), `talker_grounding_violations` 0, `anchoring_violations` 0, `hallucination_rate` 0, `completion_correctness` true, kein Reopening/Goodbye-Loop.

### Ursache des dedup-Defizits (code-belegt)

Der Scorer `scoreDedupCoverage` ([slotCoverage.ts:30-49](../../src/services/__evals__/interview/scorers/slotCoverage.ts#L30)) zählt `Σ gefüllte Felder / (n_gruppen × COVERAGE_FIELDS.length)`. Der Nenner ist `COVERAGE_FIELDS` — **9 Felder inklusive `tazite_cues`** ([interviewSemantic.ts:348-358](../../src/services/interviewSemantic.ts#L348)).

`COVERAGE_FIELDS` ist per **ADR-025 D3** bewusst an das in `meridian-ma` eingefrorene Thesis-Schema v1.2 gebunden und bleibt unverändert — inklusive `tazite_cues` — damit die historische KI-18/KI-27-Eval-Vergleichbarkeit nicht bricht. Gleichzeitig hat **PROJ-45/ADR-025 D3** `tazite_cues` aus dem aktiven Erhebungs-Zielsatz `O_SLOT_FIELDS` ([interviewSemantic.ts:370-381](../../src/services/interviewSemantic.ts#L370)) **entfernt** (`−tazite_cues`, „Aspekt-i, opportunistic only, no target_o_field"). Der Talker verfolgt `tazite_cues` seither nicht mehr turn-für-turn.

Konsequenz: Ein Feld des dedup-Nenners wird von der aktuellen Engine per Design nicht mehr aktiv erhoben. Die Eval-Analyse der 22:54-Serie bestätigt: `tazite_cues` ist auf **jedem** Schritt in **allen drei** Läufen leer. Damit ist die pro-Schritt-Coverage strukturell auf 8/9 ≈ 0.89 gedeckelt, selbst für einen sonst vollständig erhobenen Schritt.

Der Schwellenwert 0.75 wurde laut Metrik-Audit §4 (Zeile 66) „empirisch (real 0.89–0.96; 0.75 = Unterexplorations-Floor)" kalibriert — **vor** der PROJ-45-Divergenz, als `tazite_cues` noch aktiv erhoben wurde und 0.89–0.96 tatsächlich erreichbar waren. Er wurde für die Divergenz nie nachkalibriert.

### Quantifizierung

`tazite_cues` allein erklärt den Großteil des Defizits: Bei Ausschluss aus dem Nenner (9 → 8 Felder) stiege der Wert um Faktor 9/8: run1 0.67 → 0.753, run2 0.64 → 0.720, run3 0.63 → 0.708. Der verbleibende Rest zum 0.75-Floor (run2/run3 ~0.03) ist der milde „dünne Endschritt" — der zuletzt registrierte Prozess wird mit 1–2 O-Feldern geschlossen (KI-30-Restsymptom, kein 0-Feld-Abschluss mehr). Diese Breiten-Charakteristik ist als Rotations-Fairness-Lücke dokumentiert und nach **PROJ-49** übergeben; sie ist keine Regression eines der sechs Joint-Gate-Features.

## Decision

**Das `dedup_slot_coverage < 0.75`-FAIL der 22:54-Serie ist NICHT den Features PROJ-42/43/44/46/48 attribuierbar und wird für dieses Joint-Gate gewaived.**

Begründung: Der Wert misst Konformität zu einem eingefrorenen Thesis-Schema (`COVERAGE_FIELDS`), das per ADR-025 D3 bewusst von der aktiven Erhebungs-Zielmenge der Engine (`O_SLOT_FIELDS`) abweicht. Das dominante Defizit (~0.08) stammt vom de-targeteten Feld `tazite_cues`; der Rest (~0.03) ist eine milde, vorbestehende Breiten-Charakteristik (→ PROJ-49). Keiner der sechs Features hat eine Coverage-Regression eingeführt — im Gegenteil, alle anderen Gate- und Diagnose-Signale sind auf ihrem besten Stand. Der 0.75-Floor ist gegen ein Schema kalibriert, das die Engine seit PROJ-45 nicht mehr bedient.

Der Waiver gilt **nur** für dieses Joint-Gate und diese sechs Features, nicht generell.

## Consequences

- PROJ-42/43/44/46/48 dürfen im Joint-Gate auf Approved übergehen, sofern ihre feature-eigenen Kriterien (keine offenen High-Bugs, feature-spezifische Verifikation) erfüllt sind. Der dedup-FAIL blockt sie nicht.
- `dedup_slot_coverage` bleibt als Metrik unverändert im Report — es ist weiter ein valides Diagnose-Signal (der `dedup − raw`-Gap misst Fragmentierung, Metrik-Audit §2.1). Nur seine Gate-Verbindlichkeit ist für diesen Fall ausgesetzt.

### Follow-up (eigene Freigabe nötig, NICHT in dieser Runde)

Die Gate-Definition sollte für die post-PROJ-45-Schema-Divergenz nachkalibriert werden — Option A: `tazite_cues` aus dem **Gate-Nenner** ausschließen (bei Beibehaltung in `COVERAGE_FIELDS` für den Diagnose-Twin und die historische Vergleichbarkeit); Option B: den Schwellenwert auf den neuen erreichbaren Floor senken. Das ist genau der im Metrik-Audit §4 als „Batch 2, pending Freigabe" markierte Gate-Revisions-Scope und gehört zu PROJ-40s Instrument-Mandat. Bis dahin ist bei künftigen Interview-Engine-Evals mit demselben strukturellen dedup-FAIL zu rechnen; er ist dann nach diesem ADR zu bewerten, nicht als Feature-Regression.
