# PROJ-30: Tiefe-/O10-Metrik

## Status: Planned
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-21
**Appetite:** L (1-2 Wochen)
**Bugs:** —
**Created:** 2026-06-17
**Last Updated:** 2026-06-17

## Hintergrund

ADR-T011 definiert die G.1-Metrik als zweidimensional: Coverage (deterministisch, bereits implementiert als `slot_coverage` in PROJ-21) und Tiefe (semantisches Urteil, noch ungebaut). PROJ-30 baut die zweite Hälfte: einen LLM-as-Judge-Scorer, der die Extraktions-Tiefe je befülltem Slot nach der 3-stufigen, verankerten Rubrik aus ADR-T011 bewertet.

Das Konstrukt "Tiefe" misst, ob eine extrahierte Aussage über die bloße Benennung eines Sachverhalts hinausgeht und erklärende Struktur enthält (Bedingungen, Kausalität, Ausnahmen, tazite Aspekte, die durch konversationelles Nachfragen sichtbar wurden). Ein reiner Slot-Zähler (`slot_coverage`) erfüllt diese Anforderung strukturell nicht — REQ-012.

Der Scorer ist schemaagnostisch: er urteilt über den Inhalt (`evidence_quote` + Slot-Wert) jedes befüllten Slots, unabhängig davon, ob das neue O1-O5-Schema (PROJ-25) bereits deployed ist. Sobald PROJ-25 die O1-O5-Felder hinzufügt, verbessert sich die Extraktionsqualität als Input; der Scorer selbst muss nicht geändert werden.

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
- [ ] Judge läuft **pro Schritt im Batch**: ein LLM-API-Call pro Schritt gibt eine JSON-Liste mit Stufen (1–3) für alle Slots des Schritts zurück.
- [ ] Judge ist Cross-Vendor: wenn das Eval-Modell ein Gemini-Modell ist → Anthropic Claude Haiku 4.5 als Judge; sonst → Gemini Flash-Lite. Gleiche Logik wie `dialogNaturalness.ts`.
- [ ] Judge-Prompt auf Deutsch, enthält die drei Rubrik-Anker aus ADR-T011 wörtlich, bewertet genau ein Kriterium (Tiefe), schreibt Begründung vor Score (Chain-of-Thought) gemäß REQ-010.
- [ ] Leere Slots (null-Wert) werden aus dem Tiefe-Urteil ausgeschlossen und fließen weder in Zähler noch Nenner ein.
- [ ] Wenn der Judge-API-Call für einen Schritt fehlschlägt (Timeout, Rate-Limit, invalider JSON), werden die Slots dieses Schritts mit Stufe-Fallback `null` markiert und aus der Aggregation ausgeschlossen. Der Scorer läuft für die restlichen Schritte weiter. `depth_score` gibt `null` zurück wenn kein einziger Schritt erfolgreich bewertet wurde.
- [ ] `slotDepth` ist in `scorers/index.ts` in `runAllScorers()` integriert.

### Falsifikationstest (REQ-012)

- [ ] Drei handcrafted Mini-Fixtures in `src/services/__evals__/interview/__fixtures__/depth-falsification/`: `shallow.json`, `adequate.json`, `deep.json`. Jede Fixture enthält mindestens zwei Schritte mit jeweils drei befüllten Slots bei der jeweiligen Tiefe-Stufe.
- [ ] **Monotonie-Test** (Unit-Test, deterministisch): `slotDepth(deep) > slotDepth(adequate) > slotDepth(shallow)` — drei Fixtures werden sortiert und die Reihenfolge geprüft.
- [ ] **Adversarial-Test** (Unit-Test): Eine Shallow-Fixture erhält triviale Phrasen-Anhänge an jeden Slot-Wert (z.B. "Das geht gut.", "Kein Problem."). `slotDepth` muss für diese Variante dasselbe Ergebnis wie die Original-Shallow-Fixture liefern (Abweichung ≤ 0,2 Punkte).
- [ ] **Konstrukt-Unabhängigkeit** (Unit-Test): Coverage-Score der Deep-Fixture = Coverage-Score der Shallow-Fixture (beide haben gleich viele befüllte Slots). Beweist dass Coverage und Tiefe unabhängig sind.
- [ ] **Reproduzierbarkeits-Test**: Zwei sequenzielle Aufrufe auf derselben Fixture weichen ≤ 5 % voneinander ab (LLM-Judge bei `temperature: 0`).

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

- **SME-Kalibrierung / zweiter Codierer**: Rubrik-Kalibrierung (Cohen's κ ≥ 0,70) ist Bestandteil von PROJ-31 (BL-E5.6), nicht PROJ-30. PROJ-30 liefert die technische Implementierung und die Rubrik-Dokumentation als Kalibrierungsbasis.
- **Tiefe-Messung auf echten Produktiv-Interviews**: Scorer läuft nur auf Eval-Runs (wie alle PROJ-21-Scorer).
- **Judge-Disziplin-Schärfung** (Positionsverzerrung, Verbosity-Bias): PROJ-31.
- **Persona-Perturbation**: PROJ-31.
- **Threshold-Kalibrierung** für minimale Tiefe-Stufe: erst nach Pilot-Daten (Cycle 2, T3.1).
- **O1-O5-Schema-Erweiterung** des `step_tracker`: PROJ-25.

---

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
