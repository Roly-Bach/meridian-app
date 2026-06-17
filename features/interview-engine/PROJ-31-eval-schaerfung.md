# PROJ-31: Eval-Schärfung (Judge, Perturbation, Robustheit)

## Status: Planned
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-21
**Appetite:** L (1–2 Wochen)
**Priority:** P1
**Bugs:** —
**Created:** 2026-06-17
**Last Updated:** 2026-06-17

## BL-E-Traceability

| BL-Item | Titel | REQ |
|---------|-------|-----|
| BL-E5.2 | Judge-Disziplin | REQ-009, REQ-010, REQ-011, REQ-012 |
| BL-E5.3 | Persona-Perturbation | REQ-014 |
| BL-E5.4 | Mehrfach-Läufe und Seed | EVAL-D-11/12 |
| BL-E5.5 | Paraphrasen-Robustheitstest | REQ-014 |

BL-E5.6 (SME-in-the-loop) ist aus diesem Scope herausgenommen: die Inter-Rater-Kalibrierung (Cohen's κ ≥ 0,70, ADR-T011 Limitation 1 / EVAL-J-06) braucht einen menschlichen Zweitcodierer und ist TF4-Methodik. Sie wird in meridian-ma geführt; die Bau-seitige Kalibrierungsbasis (`depth-rubric.md`) liefert PROJ-30. Hinweis Traceability: der Build-Backlog ordnet PROJ-31 die Items BL-E5.2–E5.6 zu; mit dieser Herausnahme baut PROJ-31 nur E5.2–E5.5, E5.6 ist nach meridian-ma/TF4 verschoben.

## Dependencies

- Requires: PROJ-21 (Eval-Foundation) — Runner, Scorer-Suite, Langfuse-Integration, Replay-Korpus werden erweitert
- Parallel: PROJ-30 (Tiefe-/O10-Metrik) — Judge-Disziplin-Patterns aus BL-E5.2 sollen von PROJ-30 übernehmbar sein
- Blocks nichts; erhöht aber Messqualität für alle folgenden Etappe-2-Evals

## Hintergrund & Motivation

PROJ-21 hat die Eval-Foundation gebaut: Modell-Matrix, sechs Scorer, A/B-Vergleich, Langfuse-Integration. Das Fundament ist stark. Vier Mess-Schwächen bleiben:

1. **Judge-Disziplin fehlt.** `dialogNaturalness` unterdrückt Begründungen explizit, bewertet fünf Kriterien in einem Aufruf auf einer unverankerten 0.00–1.00-Skala. Das verletzt vier der fünf EVAL-J-Disziplinen (REQ-009/010/011/012).
2. **Einzellauf = Zufalls-Snapshot.** Jede Modell × Persona-Kombination läuft einmal. Scorer-Varianz durch Stochastik ist ungemessen.
3. **Persona-Input ist deterministisch.** Das processKnowledge-JSON wird je Lauf identisch serialisiert — die Engine-Robustheit gegenüber paraphrasierten Antworten ist unbekannt.
4. **Scorer-Stabilität unbelegt.** Ob slotCoverage, phaseAdherence etc. bei lexikalisch verschiedenen aber semantisch gleichen Formulierungen stabil bleiben, ist nicht gemessen.

## User Stories

- Als Developer will ich, dass der dialogNaturalness-Judge eine verankerte 3-stufige Rubrik mit Begründung vor Score ausgibt, damit Scores nachvollziehbar sind statt einer opaken Dezimalzahl.
- Als Developer will ich N Wiederholungen (Default: 3) je Modell × Persona mit Median-Aggregat, damit ich Varianz messe statt einem Zufalls-Einzelwert zu vertrauen.
- Als Developer will ich die Persona-processKnowledge per Seed perturbieren (LLM-Paraphrase + Feldordnung), damit die Engine-Robustheit bei abweichenden Formulierungen messbar wird.
- Als Developer will ich Fixture-Paraphrasen-Sets mit definierter Toleranzschwelle, damit Scorer-Stabilität bei lexikalisch verschiedenen aber semantisch äquivalenten Inputs nachgewiesen wird.
- Als Developer will ich einen `--runs` und `--seed` Flag im Runner, damit Mehrfach-Läufe reproduzierbar sind und jeder Lauf rückverfolgbar bleibt.

## Acceptance Criteria

### BL-E5.2 — Judge-Disziplin

- [ ] `dialogNaturalness`-Prompt enthält eine verankerte 3-stufige Rubrik:
  - Stufe 1 (oberflächlich): generische Einleitungen, häufige Stilbrüche, inkonsistente Du-Form
  - Stufe 2 (angemessen): überwiegend natürliche Sprache, vereinzelte Mängel
  - Stufe 3 (exzellent): durchgehend natürlich, höflich, keine generischen Floskeln
- [ ] Judge-Prompt instruiert: Begründung zuerst, Score als letztes Element. Score ist trennbar via Parsing (`Stufe: X` am Ende des Judge-Outputs).
- [ ] `maxOutputTokens` erhöht von 12 auf mindestens 300, um CoT-Begründung zu ermöglichen.
- [ ] Score-Parsing robust: erkennt `Stufe: 1/2/3`, Rohzahl `1`/`2`/`3` und mapped auf 0.33/0.67/1.00. Fallback bei unbekanntem Format: 0.5 + Warning.
- [ ] Judge-Begründung (alles vor dem Score) wird im Markdown-Report unter `## Judge-Begründung` festgehalten.
- [ ] Positions-Swap-Unit-Test: Judge-Aufruf mit identischen Turns in umgekehrter Reihenfolge darf keine systematische Abweichung > 0.15 erzeugen (Stufen-Differenz ≤ 1 in ≥ 80 % der Test-Cases).
- [ ] Die Judge-Disziplin gilt auch für den `slotDepth`-Batch-Judge aus PROJ-30 (REQ-012): ein Positions-Swap über die Slot-Reihenfolge im Batch erzeugt keine systematische Abweichung > 0.15 (Stufen-Differenz ≤ 1 in ≥ 80 % der Test-Cases). Damit wird die in PROJ-30 nach hier vertagte Order-Unabhängigkeit (EVAL-J-02) eingelöst.
- [ ] Der Standard-Aufruf bewertet genau ein Kriterium (Natürlichkeit) mit der verankerten Rubrik; damit ist REQ-010/EVAL-J-03 im Default erfüllt (eine Kriteriumsdefinition je Aufruf, Begründung vor Score). Das `--isolated-criteria` Flag ist die optionale Sub-Dimensions-Diagnose: je Sub-Kriterium ein separater Judge-Call (5 Calls); Output: 5 Subscores + gewichtetes Aggregat.
- [ ] Cross-Vendor-Routing (`getJudgeModel`) und `temperature: 0` bleiben unverändert (Schutzgut aus PROJ-21, deckt EVAL-J-05 Anti-Zirkularität).
- [ ] EVAL-J-Abdeckung dokumentiert: J-02 (Positions-Swap), J-03 (Kriterienisolation + CoT), J-04 (verankerte Skala), J-05 (Cross-Vendor) sind oben adressiert. J-01 (komparativ statt absolut) wird im A/B-Pfad (`compare.ts`) eingelöst, wo zwei Läufe verglichen werden; der Einzel-Transkript-Score bleibt verankert-absolut (EVAL-J-04), weil Paarvergleich ein zweites Vergleichsobjekt voraussetzt (EVAL-J-01: „wo die Bewertungsaufgabe es zulässt").

### BL-E5.4 — Mehrfach-Läufe und Seed

- [ ] `--runs N` Flag (Default: 1 für Rückwärtskompatibilität; empfohlene Verwendung: 3). Akzeptiert ganzzahlige Werte 1–10.
- [ ] Je Modell × Persona: wenn `--runs N` mit N > 1, entsteht ein Aggregat-Report (`-aggregate.md`) mit Median, Min, Max je Scorer. Einzel-Reports (`-run1.md`, `-run2.md`, …) bleiben erhalten.
- [ ] `--seed S` Flag: Seed-Wert wird an LLM-Calls (als `seed`-Parameter, wo vom AI SDK unterstützt) und an Perturbation weitergegeben.
- [ ] Ohne `--seed`: Seed wird zufällig gezogen (`Math.random()`) und im Report-Frontmatter als `run_seed: <wert>` dokumentiert.
- [ ] Summary-Tabelle nach allen Runs zeigt Median ± Spanne je Modell × Persona (bestehende Summary-Tabelle um Spalten `median` / `min` / `max` erweitert).
- [ ] `--runs 1` ohne `--seed` und ohne `--perturbation`: Runner verhält sich rückwärtskompatibel zum PROJ-21-Verhalten.

### BL-E5.3 — Persona-Perturbation

- [ ] Vor jedem Lauf (außer `--no-perturbation`) wird `processKnowledge` perturbiert:
  - LLM-Paraphrase (Gemini Flash-Lite): `process.description`, `process.pain_points[]`, `additionalContext` werden umformuliert, ohne faktischen Inhalt zu ändern.
  - Feldordnungs-Shuffle: Reihenfolge der Elemente in `processes[]` und `tools[]` wird per Seed randomisiert.
- [ ] Perturbation betrifft ausschließlich `processKnowledge`. `identity` und `style` bleiben unverändert.
- [ ] `--no-perturbation` Flag deaktiviert die Perturbation vollständig (für Replay-Regression und Baseline-Vergleich mit PROJ-21-Reports).
- [ ] Perturbiertes processKnowledge wird im Report-Frontmatter als `perturbation_seed: <wert>` dokumentiert.
- [ ] Schlägt der Perturbations-LLM-Call fehl: Fallback auf unverändertes processKnowledge + Console-Warning `[perturbation] failed, using original`.
- [ ] Unit-Test: gleicher Seed → identische Perturbations-Ausgabe (Reproduzierbarkeit).

### BL-E5.5 — Paraphrasen-Robustheitstest

- [ ] Für den `buchhalter`-Frozen-Transcript liegen 3 handgepflegte Paraphrasen-Varianten als Fixture-Dateien vor:
  - Variante A: synonyme Umformulierungen der User-Turns
  - Variante B: Aktiv/Passiv-Invertierung
  - Variante C: Stichpunkt-/Fließtext-Wechsel
- [ ] `npm run eval:interview:paraphrase-test` führt alle deterministischen Scorer auf Original + 3 Varianten aus. Läuft lokal ohne API-Keys.
- [ ] Toleranzschwelle deterministischer Scorer: Differenz ≤ ±0.05 vs. Original → Pass; sonst Fail.
- [ ] LLM-basierte Judges (`dialogNaturalness` und der `slotDepth`-O10-Judge aus PROJ-30): höhere Toleranz ±0.10; bei Fail kein harter Blocker, sondern Warnung. REQ-014 nennt die Stabilität der internen Urteile O8/O10 explizit, daher gehört der Tiefe-Judge in den Paraphrasen-Test; der API-key-freie deterministische Kern bleibt davon getrennt lauffähig.
- [ ] Ausgabe auf stdout: Markdown-Tabelle mit Pass/Fail je Scorer × Variante.
- [ ] Test ist eigenständig lauffähig ohne den Eval-Runner zu starten.

## Edge Cases

- Rate-Limit bei Mehrfach-Läufen: Runs laufen seriell (bestehende Konvention aus PROJ-21), kein Parallelismus.
- `--runs 1 --no-perturbation`: verhält sich identisch zu bisherigem Verhalten (vollständige Rückwärtskompatibilität).
- Seed-Wert 0: explizit erlaubt; im Report als `run_seed: 0` dokumentiert.
- CoT-Parsing scheitert (unerwartetes Format): Fallback 0.5 + Warning, kein Runner-Abbruch.
- Paraphrasen-Variante enthält Tippfehler oder Satzlücke: deterministischer Scorer kann abweichen; die Fixture muss inhaltlich äquivalent bleiben (Review-Pflicht bei Fixture-Erstellung).
- `--isolated-criteria` + `--runs 3`: 5 Calls × 3 Runs = 15 Judge-Calls je Persona-Kombination. Laufzeit-Hinweis im Report-Frontmatter.
- AI SDK unterstützt keinen `seed`-Parameter für das gewählte Modell: Seed wird im Report dokumentiert, LLM-Stochastik bleibt — keine Fehler.

## Out of Scope

- **BL-E5.1 Tiefe-/O10-Metrik** — PROJ-30
- **BL-E5.6 SME-in-the-loop** — in meridian-ma/TF4, nicht im Bau-Repo
- **Automatisierte CI-Integration** der Eval-Läufe
- **Live-Monitoring** von Produktiv-Interviews
- **Visuelles Dashboard** außerhalb Markdown/Langfuse
- **Neue Personas** — die drei bestehenden reichen für Etappe 2

## Implementierungs-Reihenfolge

1. **BL-E5.2 Judge-Disziplin** (0.5d): `dialogNaturalness.ts` Rubrik + CoT + Parsing + Positions-Swap-Unit-Test.
2. **BL-E5.4 Mehrfach-Läufe** (1d): `--runs` / `--seed` Flags im Runner, Aggregat-Report-Logik, Summary-Tabellen-Erweiterung.
3. **BL-E5.3 Perturbation** (1d): Perturbations-Modul (`perturbation.ts`), LLM-Paraphrase + Shuffle, Integration im Runner, `--no-perturbation` Flag.
4. **BL-E5.5 Paraphrasen-Fixtures** (1.5d): 3 Fixture-Varianten für Buchhalter-Transcript handpflegen, `eval:interview:paraphrase-test` Script, Schwellen-Check.
5. **Verifikation** (0.5d): vollständiger Matrix-Run (`--runs 3 --seed 42`), Report-Prüfung, Rückwärtskompatibilitätstest (`--runs 1 --no-perturbation`).

Gesamt: ~4–5 Tage solo → Appetite L bestätigt.

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

## Post-Mortem

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: L / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
