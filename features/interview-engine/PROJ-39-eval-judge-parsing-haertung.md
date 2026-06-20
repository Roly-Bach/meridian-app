# PROJ-39: Eval-Judge-Parsing-Härtung (dialog_naturalness + slotDepth)

## Status: Planned
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-31
**Appetite:** S (1-2d)
**Bugs:** —
**Created:** 2026-06-20
**Last Updated:** 2026-06-20

## Dependencies
- **Revidiert:** PROJ-31 (Eval-Schärfung: Judge, Perturbation, Robustheit). Genau die Judge-Robustheit ist hier verletzt.
- **Related:** PROJ-30 (Tiefe-/O10-Metrik) besitzt den `slotDepth`-Judge; PROJ-13 (Observability).
- **Related:** PROJ-38 (Slot-Write-Encoding). Selbe Eval-Welle (~2026-06-18). PROJ-38 hat die eine Ursache des Eval-Signalverlusts behoben (Encoding); PROJ-39 behebt die zweite (Judge-Parsing).
- **Absorbiert:** Known Issues KI-3 (dialog_naturalness-Parsing) und KI-4 (Skill-Doc stale Slot-Namen).

## Context

Nach PROJ-38 scheitert das Eval-Gate ([runner.ts:435-441](../../src/services/__evals__/interview/runner.ts#L435-L441)) an genau einer Bedingung: `dialogNaturalness >= 0.7`. Alle anderen Bedingungen passen. Der Wert ist konstant 0.5, der Fallback aus [dialogNaturalness.ts:48-51](../../src/services/__evals__/interview/scorers/dialogNaturalness.ts#L48-L51): `parseJudgeResponse` sucht einen `Stufe: X`-Marker (Regex), findet ihn nicht und fällt auf 0.5. Mit `maxOutputTokens: 300` und einer langen Begründung wird der finale Marker plausibel abgeschnitten (im Lauf 19-43 war die Begründung lang, der Score trotzdem 0.5). Folge: jeder Lauf scheitert am Gate, unabhängig von der echten Gesprächsqualität. Das ist der jetzt alleinige Blocker für ein grünes Eval-Label (KI-3, in INDEX als High eingestuft).

`slotDepth` ([slotDepth.ts:117-130](../../src/services/__evals__/interview/scorers/slotDepth.ts#L117-L130)) hat dieselbe Fragilitätsklasse: `JSON.parse(cleaned)` in `try/catch`, das bei einem nicht exakt geformten Judge-Output still `null` zurückgibt. Im 19-43-Lauf hat es funktioniert, aber ein einzelner Judge darf nicht stillschweigend eine Metrik (oder das Label) kippen.

KI-4: die `/eval-interview`-Skill-Doku beschreibt in Schritt 3/4 noch die alten Slot-Namen (`frequency_per_month` als `slots.*`, `rule_based`, `data_sources`) statt des aktuellen PROJ-25/27-Schemas (O-Slots + `potenzial`-Facette).

## User Stories

- Als **Eval-Nutzer / KI-Berater** möchte ich, dass `dialog_naturalness` einen echten geparsten Score liefert statt des 0.5-Fallbacks, damit das Gate ein wahres PASS/FAIL emittiert.
- Als **Entwickler** möchte ich, dass die LLM-Judge-Parser robust gegen erwartbare Formatvarianten und Truncation sind, damit ein einzelner Judge nicht still das gesamte Eval-Label kippt.
- Als **Entwickler** möchte ich, dass `slotDepth` bei einem wiederherstellbaren Judge-Output nicht still `null` zurückgibt.
- Als **Eval-Nutzer** möchte ich, dass die `/eval-interview`-Skill-Doku das aktuelle Schema (O-Slots + `potenzial`) beschreibt, damit die PASS-Kriterien nicht an nicht existierenden Slot-Namen prüfen.

## Acceptance Criteria

- [ ] Ein normaler buchhalter-Lauf (flash) erzeugt einen geparsten `dialog_naturalness`-Score (Stufe 1/2/3 → 0.33/0.67/1.0), **nicht** den 0.5-Fallback. Die Warnung `[dialogNaturalness] unexpected format, fallback 0.5` erscheint im Lauf nicht.
- [ ] Bei einem tatsächlich guten Gespräch erreicht der Lauf die Gate-Bedingung `dialogNaturalness >= 0.7`, sodass das Gesamt-Label PASS sein **kann** (Encoding ist via PROJ-38 bereits gefixt).
- [ ] `parseJudgeResponse` ist gegen die zuvor fehlschlagende Variante abgesichert (zuverlässig vorhandener + parsbarer Marker, z.B. via Output-Kontrakt/Token-Budget/tolerantes Parsing). Ein Unit-Test in `dialogNaturalness.test.ts` deckt genau diese Variante ab und schlägt vor dem Fix fehl.
- [ ] `slotDepth`-Judge-Parsing: ein wiederherstellbarer Output (z.B. Markdown-Fence-Varianten oder Zusatztext um das JSON-Array) wird geparst statt still `null`. Ein Unit-Test in `slotDepth.test.ts` deckt es ab.
- [ ] Die `/eval-interview`-Skill-Doku (Schritt 3 Slot-Beschreibung, Schritt 4 PASS-Kriterien, Schritt-0-Hinweis zu `ANALYST_THINKING_BUDGET`) beschreibt das aktuelle PROJ-25/27-Schema (`inputs`/`outputs`/`ausnahmen`/`hilfsmittel`/`tazite_cues`/`entscheidungslogik` + `potenzial`-Facette) statt der alten Slot-Namen.
- [ ] **Gate:** `tsc --noEmit` und `npm test` grün; `dialogNaturalness.test.ts` und `slotDepth.test.ts` erweitert.
- [ ] Ein frischer buchhalter-Lauf ist dokumentiert; `dialog_naturalness` ist ein echter Score und das Gesamt-Label spiegelt die reale Qualität (kein durch Parsing erzwungener FAIL mehr).

## Edge Cases

- **Echter Judge-Call-Fehler (API):** Der 0.5-Fallback bei einem fehlgeschlagenen `generateText`-Call ([dialogNaturalness.ts:100-103](../../src/services/__evals__/interview/scorers/dialogNaturalness.ts#L100-L103)) bleibt legitim. Parsing-Fallback und Call-Fail-Fallback müssen unterscheidbar bleiben (nur der Parsing-Fall wird behoben).
- **Mehrere `Stufe: X` im Output:** Der letzte zählt (bestehendes Verhalten beibehalten).
- **Leeres Gespräch (`agentTexts` leer):** 0.5 bleibt korrekt (kein Material), kein Parsing-Bug.
- **slotDepth-Judge gibt echtes Nicht-Array/leer zurück:** `null` bleibt für echte Fehler; nur wiederherstellbare Formate werden zusätzlich geparst.

## Technical Requirements

- **Keine Änderung der Metrik-Definitionen.** Das Stufe→Score-Mapping (0.33/0.67/1.0) und die Rubriken bleiben; nur Robustheit des Parsings bzw. des Judge-Output-Kontrakts wird verbessert.
- **Keine DB-/Schema-Änderung.** Reine Eval-Service- und Doku-Änderung.

## Out of Scope

- **KI-1 (Backfill der string-kodierten Bestandsdaten):** Daten-Migration mit Approval-Gate, anderer Arbeitstyp. Bleibt eigenes Known Issue.
- **KI-2 (Knowledge-Object-Tool-Dedup):** anderes Subsystem (Extraktion). Bleibt eigenes Known Issue.
- **`confidence_trigger_rate`:** nicht im Gate, wirkt wie reale Modell-/Gesprächsqualität (PROJ-28/29), kein Parsing-Bug.
- **Echte Verbesserung der Gesprächs-Natürlichkeit des Agenten:** das ist Modellqualität, nicht Judge-Parsing.

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
| Appetite vs. tatsächlich | geschätzt: S / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
