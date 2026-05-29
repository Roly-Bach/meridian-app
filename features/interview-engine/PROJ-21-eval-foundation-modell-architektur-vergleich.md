# PROJ-21: Eval-Foundation für Modell- und Architektur-Vergleich

## Status: Planned
**Created:** 2026-05-29
**Last Updated:** 2026-05-29
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-17
**Appetite:** M (3-5 Tage)
**Priority:** P1
**Bugs:** —

## Dependencies
- Requires: PROJ-17 (Adaptive Eval-Harness + Start-Endpoint) — bestehender Runner, Personas, Markdown-Reports werden erweitert
- Requires: PROJ-13 (LLM Observability & Tracing) — Langfuse-Spans und Cost-Tracking sind die Datenbasis für Vergleichs-Dashboards
- Blocks: PROJ-22 (Dual-Loop Interview Architecture) — Baseline-Runs und Quality-Scorer sind Voraussetzung für die iterativen Eval-Gates in PROJ-22

## Hintergrund & Motivation

Der heutige Eval-Lauf vom 2026-05-28 zeigt: `gemini-3.5-flash` liefert auf demselben Prompt schlechtere Interview-Qualität als das schwächere `gemini-3.1-flash-lite`. Diese Beobachtung ist der Auslöser für ADR-011 (Dual-Loop Architektur). Bevor wir die Architektur grundlegend ändern, brauchen wir ein verlässliches Mess-Instrument:

1. **Modell-Matrix-Runs.** Heute läuft die Eval mit *einem* Modell pro Run. Wir können nicht systematisch vergleichen, ob ein Refactor auf Modell A regrediert während es auf Modell B verbessert. Für PROJ-22 brauchen wir parallele Runs auf mindestens Flash-Lite und Flash-3.5, später optional Claude Haiku/Sonnet.
2. **Quality-Scorer-Suite.** Heute liefert die Eval einen Markdown-Report zum manuellen Lesen. Es gibt keine objektive Metrik wie "Anchoring-Rate" oder "Phase-Adherence". Manuelle Bewertung skaliert nicht und ist nicht stabil zwischen Reviewern.
3. **A/B-Vergleichs-Dashboard.** Heute sind Eval-Runs in Langfuse als isolierte Sessions sichtbar. Es fehlt ein konsolidierter Vergleich "vorher vs. nachher" mit Score-Deltas pro Persona und Modell.

Ohne diese Foundation ist PROJ-22 ein Blindflug. Jede der fünf PROJ-22-Iterationen braucht ein Eval-Gate. Ohne objektive Scorer wird "wir machen weiter wenn es subjektiv besser aussieht" zu einem Anti-Pattern, das die Refactor-Pipeline aushebelt.

## User Stories

- Als **Developer**, der ADR-011 in PROJ-22 umsetzt, will ich pro Refactor-Iteration einen A/B-Eval gegen die Baseline laufen lassen können, damit ich Regressionen unmittelbar erkenne.
- Als **Developer** will ich einen Eval-Run gleichzeitig auf mehreren Modellen ausführen, damit ich Modell-spezifische Effekte (Flash-Lite vs. Flash-3.5) sehe.
- Als **Developer** will ich objektive Quality-Scorer pro Run, damit ich nicht aus Markdown-Lesen heraus subjektiv entscheide.
- Als **Developer** will ich einen Vergleich zweier Runs auf einen Blick in Langfuse oder lokal sehen, damit ich Score-Deltas und Beispiel-Turns nebeneinander habe.

## Acceptance Criteria

### Modell-Matrix

- [ ] Der Eval-Runner akzeptiert `--models gemini-3.1-flash-lite,gemini-3.5-flash` (kommagetrennte Liste). Falls weggelassen: Default aus `.env.local` (`INTERVIEW_MODEL`).
- [ ] Jedes Modell läuft pro Persona einmal pro Aufruf. Ergebnis: ein Markdown-Report **pro Modell**, in `docs/evals/interview/<datum>/<datum>-<modell>-<persona>.md`.
- [ ] Runs werden seriell ausgeführt (kein paralleles Rate-Limit-Risiko). Reihenfolge deterministisch (alphabetisch nach Modell-String).
- [ ] Cross-Vendor-Modelle (z.B. `anthropic/claude-haiku-4-5`) funktionieren in der gleichen Matrix, sofern API-Keys in `.env.local` gesetzt sind.

### Quality-Scorer-Suite

Pro Eval-Run werden folgende Scores berechnet und in Langfuse als Score-Objekt (`mcp__langfuse__createScore`) an die Session geheftet, plus als Tabelle im Markdown-Report.

- [ ] **slot_coverage** (float, 0-1): Anteil der gefüllten Mandatory-Slots über alle registrierten Steps am Ende des Interviews. Berechnung: `filled_mandatory / (n_steps * 4)`.
- [ ] **phase_adherence** (float, 0-1): Anteil der Turns, in denen der Agent eine phasen-konforme Aktion zeigte. Berechnung programmatisch: `walkthrough_step` Turns ohne direkte Slot-Frage werden positiv gezählt, Verstöße negativ. Regex-basiert auf Agent-Text.
- [ ] **anchoring_violations** (int, low-better): Anzahl Vorkommen vom Agent vorgeschlagener Zahlenwerte (Regex auf "rechne ich mit", "notiere ich", "im Schnitt X Min" in Agent-Turns). Ziel: 0.
- [ ] **tool_call_plausibility** (float, 0-1): Anteil der Tool-Calls, deren `evidence_quote` als Substring im vorherigen User-Turn vorkommt. Ziel: ≥ 0.95.
- [ ] **dialog_naturalness** (float, 0-1): LLM-as-Judge mit Cross-Vendor-Modell (Anthropic Claude Haiku falls Eval-Modell Gemini, sonst Gemini Flash-Lite). Prompt: deutsche Tonalität, Höflichkeit, Du-Form, keine generischen Einleitungen.
- [ ] **completion_correctness** (bool): wurde das Interview ordnungsgemäß über `wrap_up` und `complete_interview` (oder ADR-011 D12 Orchestrator-Completion) abgeschlossen?
- [ ] Alle sechs Scores sind in jedem Markdown-Report sichtbar (Tabelle am Anfang).

### A/B-Vergleichs-Dashboard

- [ ] Neuer Befehl `npm run eval:interview:compare <baseline-run-id> <candidate-run-id>` druckt einen Markdown-Vergleich auf stdout mit Score-Deltas pro Persona und Modell.
- [ ] Vergleich enthält je drei Beispiel-Turns aus jedem Lauf (erster Agent-Turn, mittlerer Agent-Turn, wrap_up-Turn).
- [ ] In Langfuse: Sessions werden mit Tag `baseline_run_id` und `candidate_run_id` versehen, sodass `langfuse-data` MCP-Queries die Pärchen finden.

### Baseline-Erzeugung für PROJ-22

- [ ] Ein dokumentierter Baseline-Run wird durchgeführt: `npm run eval:interview -- --models gemini-3.1-flash-lite,gemini-3.5-flash --personas buchhalter,vertriebler,it-support`.
- [ ] Die resultierenden 6 Eval-Reports werden in `docs/evals/interview/baselines/PROJ-22-pre-refactor/` abgelegt.
- [ ] Eine Übersichtstabelle (`docs/evals/interview/baselines/PROJ-22-pre-refactor/README.md`) zeigt alle sechs Score-Sätze auf einer Seite.

### Eval-Runner-Disziplin

- [ ] Eval-Runs setzen automatisch `LANGFUSE_ENABLED=true` für die Dauer des Runs (Override gegen `.env.local`-Default `false`).
- [ ] Eval-Runs setzen Tags `eval_run_id`, `persona`, `model`, `environment=eval` (bereits via PROJ-13 etabliert) plus neu `baseline_label` (falls Run als Baseline markiert).
- [ ] Quality-Scorer schreiben Scores asynchron nach Run-Ende, blockieren den Runner-Exit nicht über die Token-Flush-Wartezeit hinaus.

## Out of Scope

- **Live-Quality-Monitoring von echten Produktiv-Interviews.** Scorer laufen nur auf Eval-Runs, nicht auf Produktiv-Traffic. Spätere PROJ-Erweiterung möglich.
- **Automatisierte Regressions-CI.** Eval-Runs bleiben manuell ausgelöst. CI-Integration ist eine separate spätere Erweiterung.
- **Visuelles Dashboard außerhalb von Langfuse oder Markdown.** Kein eigenes Frontend für die Eval-Vergleiche.
- **Persona-Erweiterung.** Die drei bestehenden Personas (Buchhalter, Vertriebler, IT-Support) reichen für die PROJ-22-Iterationen. Vierte Persona optional in spätem Lauf.

## Architektur-Notizen

- **Scorer-Implementierung.** Jeder Scorer in `src/services/__evals__/interview/scorers/` als pure function `(transcript: Turn[], state: InterviewState) => number | boolean`. Keine Side-Effects, vollständig testbar mit Snapshot-Inputs.
- **LLM-as-Judge Cross-Vendor.** `dialog_naturalness` nutzt explizit ein Modell aus einem *anderen* Vendor als das evaluierte Modell, um Vendor-Bias zu reduzieren. Memory `feedback_vendor_diversity.md` als Begründung.
- **Langfuse-Integration.** Scores landen via `mcp__langfuse__createScore` an der `session_id = interview_id`. Pro Session ein Score-Set pro Scorer. Trace-ID des Run-Endpoints ist Anker.
- **Baseline-Pinning.** Baseline-Runs für PROJ-22 sind eingefrorene Artefakte: Persona-Versionen, Modell-Versionen, Prompt-Version (Git-SHA) werden im Baseline-README dokumentiert, damit spätere Iterationen reproduzierbar verglichen werden können.
- **Catch-up bei Eval-Failures.** Wenn ein einzelner Persona-Run failed (z.B. Timeout, Rate-Limit), läuft der Runner für die restlichen Personas weiter. Failed Runs werden als `status: failed` im Report markiert, blockieren nicht den Gesamt-Run.

## Implementierungs-Reihenfolge

1. Quality-Scorer-Modul: sechs Scorer als pure functions, Unit-Tests mit Snapshot-Inputs (1 Tag).
2. Runner-Erweiterung Modell-Matrix: `--models` Flag, sequenzielle Iteration, Report-Naming-Konvention (0.5 Tag).
3. Langfuse-Score-Integration: Scorer-Ergebnisse via MCP an Sessions heften, Tag-Erweiterungen (0.5 Tag).
4. A/B-Vergleichs-Befehl: `eval:interview:compare` mit Markdown-Output (1 Tag).
5. Baseline-Run für PROJ-22 ausführen, Reports archivieren, README schreiben (0.5 Tag).
6. Verifikation, Test-Lauf mit aktueller Codebase (0.5 Tag).

Gesamt: 3-4 Tage solo.

## Referenzen

- ADR-011: Dual-Loop Interview Architektur (Auftraggeber für die Eval-Foundation)
- PROJ-17: Bestehende Eval-Harness (wird erweitert)
- PROJ-13: Langfuse-Observability (Datenbasis)
- Memory `feedback_vendor_diversity.md`: Begründung für Cross-Vendor LLM-as-Judge
