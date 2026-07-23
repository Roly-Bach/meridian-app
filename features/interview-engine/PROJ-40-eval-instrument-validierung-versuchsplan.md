# PROJ-40: Eval-Instrument-Validierung + Versuchsplan

## Status: Approved
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-31
**Appetite:** L
**Bugs:** 0:0:0
**Created:** 2026-06-30
**Joint-Gate (2026-07-24):** dedup-Gate-Ruling als [ADR-026](../../docs/adr/ADR-026-dedup-slot-coverage-gate-schema-divergenz.md) festgehalten — `dedup_slot_coverage < 0.75` ist nach der PROJ-45-Schema-Divergenz (`tazite_cues` de-targetet, im Nenner belassen) nicht Feature-attribuierbar → Waiver für PROJ-42/43/44/46/48, Gate-Nachkalibrierung als PROJ-40-Follow-up. Eval-Gate für PROJ-40 selbst über die 8 Stufe-2-Interviews (2026-07-03) nachgewiesen. → Approved.
**Last Updated:** 2026-07-03 (Stufe 2 ausgeführt — GO; alle Acceptance-Kriterien erfüllt)

## Dependencies
- Requires: PROJ-31 (Eval-Schärfung) — die bestehenden Scorer + Gate-Logik, die hier auditiert und revidiert werden
- Requires: PROJ-21 (Eval-Foundation) — Runner, Personas, Trail-Metriken
- Requires: PROJ-34 (TurnStore-Port) — `--store pglite` für DB-freie, reproduzierbare Validierungsläufe
- Entschieden durch: [ADR-020](../../docs/adr/ADR-020-eval-methodik-modell-benchmarking.md) (Eval-Methodik für Modell-Benchmarking)
- Blockt: PROJ-41 (Interview-Modell-Auswahl) — das Go/No-Go-Verdikt, der korrigierte Gate-Satz und der Versuchsplan sind harte Voraussetzung für PROJ-41

## Kontext

Bevor Modelle verglichen werden (PROJ-41), muss das Messinstrument stimmen. Im Eval wirken drei
Rollen: Interview (Prüfling), Test (Persona-Simulator) und Eval (Judges). Test und Eval sind das
Messwerkzeug. PROJ-40 validiert dieses Werkzeug in zwei Schichten und schreibt einen Versuchsplan
fest. ADR-020 ist die Methodik-Klammer; diese Spec realisiert sie, entscheidet die Architektur nicht neu.

Zwei Befunde aus dem Grilling treiben die Spec:
1. `evaluateGate()` prüft real fünf Bedingungen; `hallucination_rate`, `overwrite_churn`,
   `talker_grounding_violations` stehen mit Zielwert nur im Report, gaten aber nicht.
2. Der Tester wird kostenseitig gar nicht erfasst (kein `onTokenUsage` am Simulator-Call).

## User Stories
- Als Benchmarker will ich, dass jede Gate-Metrik einen dokumentierten, robusten Zweck hat, damit ich Modellvergleichen vertrauen kann.
- Als Benchmarker will ich, dass das Eval auch Qualitätsdimensionen erfasst, die heute von keiner Metrik gemessen werden, damit ein echter Modellunterschied nicht unsichtbar bleibt.
- Als Benchmarker will ich wissen, ob Test- und Eval-Modelle stark genug sind, bevor ich ein großes Benchmarking starte, damit ich nicht mit einem kaputten Messwerkzeug messe.
- Als Benchmarker will ich die Kosten je Rolle (Interview/Test/Eval) getrennt sehen, damit die Ersparnis eines günstigen Interview-Modells nicht im fixen Test-/Eval-Overhead untergeht.
- Als Entwickler will ich, dass das korrigierte Gate die bisher nur berichteten Faktentreue-Schwellen tatsächlich durchsetzt, damit ein Lauf nicht trotz Grounding-Verletzung PASS sein kann.
- Als Benchmarker will ich einen festgeschriebenen Versuchsplan, damit PROJ-41-Läufe reproduzierbar und vergleichbar sind.

## Acceptance Criteria

### A — Metrik-Audit + Gate-Revision + Erweiterung (Design-Validität der Metriken)
- [x] Jeder Scorer im Inventar ist im Audit-Dokument auf sechs Achsen bewertet: Validität, Schwellen-Herkunft, Sensitivität, Redundanz, Gate-Zugehörigkeit, Benchmark-Eignung. Inventar: completionCorrectness, slotCoverage, dedupSlotCoverage, stepRegistrationCoverage, dialogNaturalness, slotDepth, talkerFactualGrounding, hallucinationRate, blockedRate, overwriteChurn, confidenceTrigger, anchoringViolations, phaseAdherence, schemaConformanceRate, toolCallPlausibility. → [metrik-audit.md](../../docs/evals/instrument-validierung/metrik-audit.md) §1 (alle 15 Scorer als 6-Achsen-Tabelle).
- [x] Die Redundanz-Kandidaten slotCoverage vs. dedupSlotCoverage und hallucinationRate vs. talkerFactualGrounding sind als „behalten / zusammenführen / entfernen" entschieden und begründet. → §2 (beide behalten; zusätzlich dritter Überlapp hallucinationRate vs. toolCallPlausibility aufgedeckt).
- [x] **Coverage-Lücken-Analyse:** geprüft, welche Dimensionen der Interview- und Extraktions-Qualität von KEINER bestehenden Metrik erfasst werden (Kandidaten z.B. Latenz/TTFT, Frage-Redundanz/-Effizienz, Themen-/Schritt-Abdeckungsbreite, Tiefe-vs-Breite, Gesprächs-Fortschritt pro Turn). Wo eine Lücke einen Modellunterschied verstecken würde, ist eine neue Metrik vorgeschlagen und, falls begründet, implementiert + getestet. Latenz/TTFT (unten) ist eine konkrete Instanz dieser Analyse. → §3 + `conversationalEfficiency` implementiert (Chunk 2, potenzialCoverage/Abhängigkeit/Effizienz-Scorer).
- [x] `evaluateGate` ist überarbeitet: jede Gate-Bedingung hat eine dokumentierte Schwellen-Begründung, und die Promotion von hallucination_rate / talker_grounding_violations / overwrite_churn ins Gate ist entschieden und umgesetzt. → §4: alle drei bleiben Diagnose (grounding durch KI-18 blockiert, churn/hallucination brüchig); Gate = 5 dokumentierte Bedingungen (completionCorrectness, dedup≥0.75, stepReg≥0.8, dialog≥0.65, blockedRate<0.1), Code unverändert = umgesetzt.
- [x] Latenz/TTFT ist als Antwortvariable erfasst, oder dokumentiert begründet, warum sie im pglite-Eval nicht messbar ist und wo sie stattdessen erhoben wird. → §3: im pglite-Eval nicht messbar (synthetischer Tester, Buffer-then-stream-Talker), erst PROJ-41 Stage-2 gegen echte API.
- [x] Bestehende Scorer-Unit-Tests sind grün; geänderte Metriken und das geänderte Gate haben aktualisierte Tests. → 839 passed / 1 skipped, tsc grün.

### B — Kosten-Dreiteilung Interview/Test/Eval
- [x] Das `component`-Enum enthält `tester`; der Persona-Simulator-Call erfasst Token via `onTokenUsage`. → Batch 1 ([runner.ts](../../src/services/__evals__/interview/runner.ts) `generatePersonaResponse`).
- [x] `computeCostSummary` weist drei Buckets aus: `tester` im Test-Bucket, `grounding_guard` im Interview-Bucket, Judges im Eval-Bucket. → [costSummary.ts](../../src/services/__evals__/interview/scorers/costSummary.ts) (`testEngine`/`interviewEngine`/`evalEngine`), `buildCostTable` rendert drei Abschnitte.
- [x] `MODEL_PRICING` ist pro vollem `provider/model`-String geführt; ein Lauf mit einem Modell ohne Preis-Eintrag warnt sichtbar oder schlägt fehl, statt still auf Gemini-Lite-Preise zu fallen. → stiller Fallback entfernt, `console.warn` (once-per-model) + Beitrag 0.
- [x] Ein Eval-Report zeigt Kosten in drei getrennten Töpfen. → `buildCostTable` (verifiziert im Stufe-2-Lauf: cost-Feld je transcript.json).

### C — Instrument-Validierung Stufe 1: Design-Validität von Persona + Tester-Prompt
- [x] Eine dokumentierte Design-Checkliste für Persona und Tester-System-Prompt existiert (Items im Versuchsplan): Persona realistisch/vollständig/nicht-trivial-kooperativ; Tester-Prompt bleibt in Rolle, legt nicht alles in Turn 1 offen, über-kooperiert nicht. → [persona-tester-review.md](../../docs/evals/instrument-validierung/persona-tester-review.md) §1.
- [x] Jede der drei Personas (buchhalter, vertriebler, it-support) und der Tester-System-Prompt sind gegen die Checkliste reviewt, Befunde dokumentiert. → §2 (Per-Persona-Tabelle, Kern-Asymmetrie buchhalter streng vs. andere lose) + §5 (Tester-Prompt).
- [x] Gezielte Transkript-Fehlersuche auf definierte Fehlermodi (Rollenbruch, Voraus-Komplett-Offenlegung, Über-Kooperation) ist durchgeführt und dokumentiert. → §3 (corpus-weit über 96 Läufe: T1 nicht gefunden; T2/T3 bei vertriebler/it-support bestätigt mit Turn-1-Belegen). Auflösung: Offenlegungs-Modus als kontrollierter Faktor (§6).

### D — Instrument-Validierung Stufe 2: Modell-Eignung + Verdikt
- [x] Judge-Kalibrierung durchgeführt: Übereinstimmung Produktions-Judge vs. stärkerer Referenz-Judge auf einer Stichprobe gemessen und gegen die Versuchsplan-Schwelle bewertet, mit dokumentiertem ja/nein je eval-zeitlichem Judge. → **GO** (Stufe 1, Single-Vendor, 2026-07-02; [checkpoint-d-stufe1-ergebnis.md](../../docs/evals/instrument-validierung/checkpoint-d-stufe1-ergebnis.md)).
- [x] Tester-Stabilität durchgeführt: Reihenfolge der Interview-Modelle über schwachen vs. stärkeren Tester verglichen und gegen das Versuchsplan-Stabilitätsband bewertet, mit dokumentiertem ja/nein. → **GO** (fokussierter Check 2026-07-03, [checkpoint-d-stufe2-ergebnis.md](../../docs/evals/instrument-validierung/checkpoint-d-stufe2-ergebnis.md)).
- [x] Go/No-Go-Verdikt dokumentiert: „Sind die aktuellen Test- und Eval-Modelle ausreichend?" je Rolle, mit Begründung. Bei „nein": welche Mindeststärke nötig ist (die Auswahl des stärkeren Modells selbst ist PROJ-41). → Eval-Rolle (Stufe 1): GO für dialog, depth reliabel-aber-caveated; Test-Rolle (Stufe 2): GO.

### E — Versuchsplan
- [x] `docs/evals/versuchsplan-modell-benchmarking.md` existiert mit: Faktoren, Stufen, Zielgrößen (validierte Metriken + Latenz + Kosten je Bucket), Kontrollen (konstant gehaltene Größen), Replikation (runs × seeds), Analyse + Entscheidungsregel, sowie den konkreten Schwellen aus Stufe 1 und 2.

### F — Gating (hartes Gate auf PROJ-41)
- [x] Dokumentiert ist: PROJ-41-Screening darf erst starten, wenn Stufe 1 und Stufe 2 mit dokumentiertem Verdikt bestanden sind. → Beide bestanden (Stufe 1 GO 2026-07-02, Stufe 2 GO 2026-07-03). Gating angepasst 2026-07-03: der Finalist-Spot-Check ist in PROJ-41 eingefaltet (gegated ist die *Entscheidung*, nicht der *Start*; Versuchsplan §7).

## Edge Cases
- Eine Metrik wird im Audit als fundamental ungültig erkannt (nicht nur Schwelle daneben): entfernen oder aufspalten, im Audit-Dokument begründet, Tests und Gate entsprechend angepasst.
- Der Referenz-Judge ist selbst inkonsistent (zwei Läufe, andere Note): seine Stabilität vorab prüfen (mehrfach laufen lassen), sonst ist die Kalibrierung wertlos.
- Judge-Kalibrierung sagt „nicht ausreichend", aber kein sinnvoll stärkerer Judge ist verfügbar: Verdikt bleibt „nein", Beschaffung/Auswahl ist PROJ-41; PROJ-40 blockt sauber statt zu beschönigen.
- Tester-Stabilität ist nicht eindeutig (Ranking teils stabil, teils nicht): konservativ als „nein/unklar" werten; die Entscheidungsregel im Versuchsplan definiert die Grenze.
- Latenz ist im pglite-Eval nicht real messbar (synthetischer Tester, keine Netz-Latenz): dokumentieren, Latenz erst in PROJ-41 Stage-2 gegen die echte Provider-API erheben.
- Die Gate-Revision kippt bestehende Referenz-/Baseline-Läufe von PASS auf FAIL: bewusst akzeptiert; im Audit-Dokument festhalten, welche historischen Läufe betroffen wären.

## Technical Requirements
- Validierungsläufe DB-frei via `--store pglite` (PROJ-34), reproduzierbar mit festem Seed.
- Kein Eingriff in den Prod-Turn-Pfad in PROJ-40: die EU-Judge-Generalisierung des Prod-`grounding_guard` (ADR-020 D2) gehört zu PROJ-41. `evaluateGate` ist eval-runner-intern, kein Prod-Code.
- Test- und Eval-Modelle sind eval-intern, keine EU-Pflicht (ADR-020 D1) — Referenz-Judge und stärkerer Tester dürfen Frontier-Modelle sein.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Was gebaut wird (Überblick)

Internes Eval-Werkzeug. Keine UI, kein Nutzer-Flow, kein DB-Schema, kein externer Service. Drei
Bausteine: (1) Code-Anpassungen im Eval-Baum, (2) zwei Validierungs-Harnesses, (3) Dokument-Artefakte
im Repo. Der Prod-Turn-Pfad wird nicht angefasst.

### A) Modul- und Artefakt-Struktur

```
PROJ-40 Fundament
├── Code im Eval-Baum (src/services/__evals__/interview/)
│   ├── Kosten-Dreiteilung   → runner.ts: component 'tester', dritter Bucket, MODEL_PRICING-Refactor
│   ├── Gate-Revision        → runner.ts: evaluateGate überarbeitet
│   └── Metrik-Erweiterung   → scorers/: neue Scorer nach bestehendem Muster, je ein ScoreSet-Feld
├── Validierungs-Harnesses (neu, eigene CLI-Einstiege, nutzen Runner-Bausteine)
│   ├── Judge-Kalibrierung   → offline auf bestehenden *.transcript.json
│   └── Tester-Stabilität    → frische Läufe, TESTER_MODEL gesweept
└── Dokument-Artefakte (docs/evals/)
    ├── versuchsplan-modell-benchmarking.md
    └── instrument-validierung/  (Audit-Report, Kalibrierungs-Ergebnis, Stabilitäts-Ergebnis, Go/No-Go-Verdikt)
```

### B) Was entsteht und gespeichert wird

- **Audit-Report:** je Metrik die 6-Achsen-Bewertung + Entscheidung (behalten/ändern/zusammenführen/entfernen/neu).
- **Kalibrierungs-Ergebnis:** pro eval-zeitlichem Judge eine Übereinstimmungszahl (Prod-Judge vs. Referenz-Judge) auf einer stratifizierten Stichprobe der vorhandenen Transkripte (aktuell 96 Stück, 3 Modelle × 3 Personas).
- **Stabilitäts-Ergebnis:** Ranking-Vergleich der Interview-Modelle über Tester-Stärke (schwach vs. stark).
- **Go/No-Go-Verdikt:** ja/nein je Rolle, bei „nein" die nötige Mindeststärke.
- **Versuchsplan:** Faktoren, Stufen, Zielgrößen, Kontrollen, Replikation, Entscheidungsregel + die konkreten Schwellen.
- **Speicherort:** Dateien im Repo unter `docs/evals/`. Keine DB, kein externer Dienst.

### C) Tech-Entscheidungen (begründet)

| Entscheidung | Begründung |
|---|---|
| Judge-Kalibrierung offline auf den bestehenden 96 Transkripten, nicht über frische Läufe | Billiger, und isoliert den Judge von Interview-Modell-Varianz: dieselben fixierten Transkripte werden von zwei Judges bewertet. Frische Läufe nur, falls ein Stratum (Persona × Modell) fehlt. |
| Zwei getrennte Harness-Skripte statt Flags am Hauptrunner | Distinkte Experimente mit anderer Ausgabeform. Der Hauptrunner bleibt auf Eval-Reports fokussiert. Beide Harnesses importieren Runner-Bausteine (Persona-Laden, `resolveModel`, Scorer), kein Code-Duplikat. |
| Referenz-Judge und stärkerer Tester über bestehende Provider (Anthropic/Google), eval-intern | ADR-020 D1: Test/Eval sind EU-frei. Kein OpenRouter (das ist PROJ-41). Referenz-Judge aus anderem Vendor als der Prod-Judge, um Cross-Vendor-Integrität zu wahren. |
| Neue Metriken folgen dem bestehenden Scorer-Muster: ScoreSet-Feld + Scorer-Funktion + `runAllScorers`-Verdrahtung | Report und Gate lesen einheitlich aus `ScoreSet`; eine neue Metrik wird automatisch mitgeführt. |
| `MODEL_PRICING`-Miss laut statt still | Ein unbekanntes Modell darf nicht heimlich mit Gemini-Lite-Preisen gerechnet werden, das verfälscht den Kostenvergleich (Akzeptanzkriterium B). |
| Kein Eingriff in den Prod-Turn-Pfad | `evaluateGate` ist eval-runner-intern. Die Prod-Guard-EU-Judge-Generalisierung ist PROJ-41 (ADR-020 D2). |

### D) Dependencies (Pakete)

Keine neuen Pakete. Die Übereinstimmungs-Statistik (z.B. Level-Match-Quote oder Kappa) wird lokal
berechnet, kein Stats-Paket nötig.

### Abgrenzung und Risiken

- Der Transkript-Korpus ist buchhalter-lastig. Die Kalibrierungs-Stichprobe muss über Persona und
  Modell stratifiziert werden, sonst kalibriert man primär auf einer Persona.
- Tester-Stabilität braucht echte Läufe (Token-Kosten). Klein halten: ein Interview-Modell, zwei
  Tester-Stärken, fester Seed, alle drei Personas.
- Latenz im DB-freien pglite-Eval ist evtl. nicht aussagekräftig (synthetischer Tester). Im
  Versuchsplan klären, ggf. erst in PROJ-41 Stage-2 gegen die echte Provider-API messen.

### Build-Zuschnitt (autonom vs. Checkpoint)

PROJ-40 wird nicht in einem autonomen Durchlauf gebaut. Code geht über `/build`, die Urteils- und
Lauf-Teile sind Checkpoints. Sequenz:

**Batch 1 — autonom, vorab (Code + Prep, keine LLM-Kosten):**
- Kosten-Dreiteilung (Kriterium B): `tester`-Component, Token-Erfassung, dritter Bucket, `MODEL_PRICING`-Refactor + Tests.
- **Stichproben-Auswahl für die Judge-Kalibrierung:** die 96 Transkripte stratifiziert nach Persona × Modell (× Qualitätsstufe, inkl. bewusst schwacher Läufe, wo Judges am ehesten divergieren), eine definierte Sample-Liste (~20–30) erzeugen. Reine Datei-Analyse, kein LLM-Call.
- Harness-Skripte (Judge-Kalibrierung offline, Tester-Stabilität) als Code, inkl. lokaler Übereinstimmungs-Statistik.

**Checkpoint — Nutzer:**
- Audit-Entscheidungen (A): Metrik-Validität, Redundanz-Auflösung, Gate-Promotion, neue Metriken.
- Persona/Tester-Design-Review (C) + Versuchsplan-Schwellen (E).
- Ausführung der Validierungsläufe (LLM-Kosten/Keys, Judge-Key-Preflight) und das Go/No-Go-Verdikt (D).

**Batch 2 — autonom, nach den Entscheidungen:**
- Gate-Revision in `evaluateGate` gemäß Promotion-Entscheidung + Tests.
- Die beschlossenen neuen Metriken als Scorer (ScoreSet-Feld + Funktion + `runAllScorers`) + Tests.

Begründung: Batch 1 hängt von keiner Entscheidung ab und kostet kein LLM-Budget. Gate-Revision und
neue Metriken (Batch 2) brauchen die Audit-Entscheidungen aus dem Checkpoint als Input.

## Implementation Notes

### Batch 1 — autonom, gebaut 2026-06-30 (Branch `proj-40-batch-1`, /build-Pipeline)

Code + Prep ohne LLM-Kosten. Gate-Revision und neue Scorer (Batch 2) sowie alle Validierungsläufe (Checkpoint) sind bewusst NICHT enthalten.

**Kriterium B — Kosten-Dreiteilung:**
- `TokenUsageRecord.component` um `'tester'` erweitert; `CostSummary` um dritten Bucket `testEngine` ([scorers/types.ts](../../src/services/__evals__/interview/scorers/types.ts)).
- Kosten-Logik aus `runner.ts` in testbares Modul [scorers/costSummary.ts](../../src/services/__evals__/interview/scorers/costSummary.ts) extrahiert (`MODEL_PRICING`, Component-Sets, `estimateTokenCost`, `computeCostSummary`). Drei Buckets: `tester`→testEngine, `grounding_guard`→interviewEngine, `judge_*`→evalEngine.
- `generatePersonaResponse` (Persona-Simulator) erfasst jetzt Token via `onTokenUsage` mit component `'tester'` ([runner.ts](../../src/services/__evals__/interview/runner.ts)); `buildCostTable` rendert drei getrennte Abschnitte.
- MODEL_PRICING-Miss: stiller Gemini-Lite-Fallback entfernt → `console.warn` (once-per-model) + Kostenbeitrag 0, kein throw (entschieden: Kostenberechnung läuft am Ende eines sonst gültigen Laufs).
- Vokabular-Angleichung: der ungenutzte Component-Wert `tester_persona` in [_telemetry.ts](../../src/services/_telemetry.ts) auf `tester` umbenannt (null Call-Sites), damit Kosten- und Telemetrie-Union dasselbe Component-Vokabular teilen; der Persona-Simulator war der einzige Component mit zwei Namen.
- `PERSONA_MAP` nach side-effect-freies Modul [personas/loadPersona.ts](../../src/services/__evals__/interview/personas/loadPersona.ts) ausgelagert, damit Harnesses den Loader importieren ohne `runner.ts` (das `main()` beim Import triggern würde).

**Stichproben-Auswahl Judge-Kalibrierung:**
- [validation/selectCalibrationSample.ts](../../src/services/__evals__/interview/validation/selectCalibrationSample.ts) — reines Datei-Analyse-Skript (kein LLM). Stratifiziert die 96 Transkripte nach Persona × Modell (Regel: Zelle ≤4 → alle, >4 → ~6, deterministisch nach Pfad). Artefakt: [docs/evals/instrument-validierung/calibration-sample.json](../../docs/evals/instrument-validierung/calibration-sample.json) (29 Samples, `meta` mit Zell-Zählern + `gateNote`). Korpus ist buchhalter-lastig (65/96) — im `meta` dokumentiert, flash/haiku-Zellen bleiben dünn (Befund für Checkpoint).

**Harness-Gerüste (Code, NICHT ausgeführt — Ausführung = Checkpoint):**
- [validation/judgeCalibration.ts](../../src/services/__evals__/interview/validation/judgeCalibration.ts) — CLI-Gerüst + pure `computeAgreement` (Cohen-Kappa + Level-Match-Quote, hand-implementiert). Referenz-Judge-Pass ist als Checkpoint-TODO markiert (Scorer brauchen Judge-Model-Override).
- [validation/testerStability.ts](../../src/services/__evals__/interview/validation/testerStability.ts) — CLI-Gerüst + pure `compareRankings` (Kendall-Stil-Konkordanz) + `aggregateQuality`.
- Beide CLIs gegen Import-Side-Effects geschützt (`import.meta.url`-Guard wie selectCalibrationSample).

**Verifikation:** `tsc --noEmit` grün; `npm test` 767 passed / 1 skipped / 0 failed (59 Dateien), davon 27 neue Tests (costSummary, judgeCalibration, testerStability). Reviewer (Sonnet-Fallback, Cross-Vendor-Aider/Gemini nicht verfügbar): keine Critical/High, 2 Low/Medium-Politur-Befunde behoben.

**Offen (nicht Batch 1):** Audit-Entscheidungen (A), Gate-Revision (Batch 2), neue Scorer/Latenz-Metrik (Batch 2), Persona/Tester-Design-Review (C), Validierungsläufe + Go/No-Go (D, Checkpoint), Versuchsplan (E). PROJ-41 bleibt hart gegated bis Stufe 1+2 bestanden.

### Checkpoint D — Harness-Beobachtbarkeit + Multi-Referenz, gebaut 2026-07-01 (Branch `proj-40-batch-1`)

Reine Instrumentierung des Judge-Kalibrierungs-Harness, kein LLM-Kosten. Anlass: der erste Stufe-1-Lauf (2026-07-01, single-reference, same-vendor) lieferte dialog κ 0.16 FAIL / depth κ 0.65 PASS / grounding κ 0.18 FAIL — aber die FAIL-Verdikte waren nicht diagnostizierbar, weil der Harness Begründungen und Pro-Transkript-Zuordnung verwarf und der grounding-κ vom KI-18-Parser-Fallback verschmutzt war. Plan: `~/.claude/plans/lively-growing-dongarra.md`.

- **Begründungen + Pro-Transkript-Erfassung** ([validation/judgeCalibration.ts](../../src/services/__evals__/interview/validation/judgeCalibration.ts)): der Harness sammelt je Transkript × Referenz-Judge × Dimension {prodLevel, refLevel, match, prodRationale, refRationale}. Volle Rohdaten im JSON-Sidecar `judge-kalibrierung-<datum>.json`, kompakte MD-Tabelle mit gekürzten Begründungs-Auszügen.
- **Ordinal-Diagnostik** (reine, unit-getestete Helfer): `confusionMatrix`, `computeWeightedAgreement` (linear-gewichtetes κ für geordnete Levels, k=2 = nominal), `ordinalOffset` (signierter Versatz = Bias-Richtung + Adjazenz-Quote). Trennt systematischen Strenge-Versatz (Haiku ≤ Sonnet) von Zufallsrauschen — nominal-κ bleibt Bestehensgrenze, gewichtet/Versatz/Adjazenz sind Diagnostik. `toOrdinal` bildet Levels je Dimension auf Indizes ab.
- **Grounding-Fallback sichtbar** ([scorers/talkerFactualGrounding.ts](../../src/services/__evals__/interview/scorers/talkerFactualGrounding.ts)): `TalkerFactualGroundingResult.parseFailed?` unterscheidet Parser-/Judge-Call-Fallback-0 vom echten „0 Verletzungen" (rückwärtskompatibel, Prod-Runner liest nur `.violations`/`.rationale`). Harness berichtet grounding-Übereinstimmung roh UND Fallback-bereinigt plus Artefakt-Anteil.
- **Multi-Referenz (Cross-Vendor)**: `EVAL_REFERENCE_JUDGE_MODELS` (kommasepariert, Default `anthropic/claude-sonnet-4-5,google/gemini-3.5-flash`), rückwärtskompatibel zum alten Einzel-Env. Prod-Pass je Transkript einmal berechnet und geteilt, Referenz-Pässe je Modell. Ein Übereinstimmungs-Panel je Referenz nebeneinander (der Cross-Vendor-Gewinn: Sonnet-Zustimmung bei Gemini-Widerspruch = Vendor-Artefakt). `gemini-3.1-flash-lite` bewusst NICHT als Referenz (= Interviewer-Modell → Selbst-Bewertung, ADR-020). Preflight `resolveModel` je Referenz.
- **Verifikation (LLM-frei):** `tsc --noEmit` grün; `npm test` 814 passed / 1 skipped / 0 failed, davon neue Tests für `confusionMatrix`/`computeWeightedAgreement`/`ordinalOffset`/`toOrdinal` + Aggregations-/Rendering-Test (`computeAggregates`/`buildMarkdown` mit synthetischen Records: depth-null-Filter, grounding roh/clean-Split, Artefakt-Zählung, ✗/⚠-Marker, zwei Panels). Offline-Persistenz-Smoke-Test (Wegwerf) bestätigte JSON+MD-Schreibpfad ohne Judge-Call.
- **Nicht enthalten (separat, budget-gegatet):** der eigentliche Multi-Judge-Re-Run (Anthropic-Budget + Google-Quota für gemini-3.5-flash); das PASS-Gate-Kriterium bei mehreren Referenzen (Cross-Vendor primär, Sonnet Stärke-Check) gehört in den Versuchsplan. Der KI-18-Parser-Fallback selbst (talkerFactualGrounding-Judge-Format) bleibt ein eigener offener Befund; hier wird er nur sichtbar gemacht, nicht behoben.

### Checkpoint D Stufe 1 — ausgeführt 2026-07-01 (Verdikt: NO-GO als Gate)

Multi-Referenz-Lauf (n=29, prod=getJudgeModel, refs=Sonnet + gemini-3.5-flash). Vollständige Analyse + Verdikt: [checkpoint-d-stufe1-ergebnis.md](../../docs/evals/instrument-validierung/checkpoint-d-stufe1-ergebnis.md), Rohdaten `judge-kalibrierung-2026-07-01-multiref.{md,json}`. Vier trennscharfe Befunde:
1. **Blocker:** gemini-3.5-flash hält die JSON-only-Vorgabe nicht ein (dialog ~alle Fallback 0.5, depth nur 3/29 parsebar, grounding 13/29 parseFailed + nie eine Verletzung geflaggt) → Cross-Vendor-Check faktisch nicht erfolgt. Entschieden: Judge-Scorer auf Structured-Output umstellen, dann Wiederholung.
2. dialog (Anthropic-Paar): systematischer Strenge-Offset (Versatz −0.72, Adjazenz 0.83, Sonnet vergibt nie Stufe 1) plus echter Sachdissens auf ~6 Transkripten.
3. depth (Anthropic-Paar): eigentlich gut (Match 0.83, Adjazenz 1.0), κ-0.34-FAIL ist Kappa-Paradox (Stufe-2-Prävalenz). Kein Judge vergibt je Stufe 3.
4. grounding (Anthropic-Paar): echt schwache Übereinstimmung (κ 0.04→0.09 bereinigt), Definition zu subjektiv (KI-18-nah).

Die Instrumentierung hat ihren Zweck erfüllt: aus „alles FAIL" wurden vier handhabbare Diagnosen. Erster Single-Ref-Lauf als Baseline gesichert: `judge-kalibrierung-2026-07-01-single-ref-baseline.md`.

**Lauf 2 — Structured Output (Commit 9d04265):** dialog/depth/grounding-Scorer auf `generateObject`+zod umgestellt. Format-Fallbacks 30/15→0. Anthropic-Judges laufen fehlerfrei; das Anthropic-Paar ist jetzt belastbar (dialog Match 0.34→0.69, grounding κ 0.04→0.46, depth Match 0.79 = Kappa-Paradox bestätigt). Neuer Befund: gemini-3.5-flash wirft at-scale `NoObjectGeneratedError` (dialog 25/29, depth 21/29) — vermutlich Token-Limit-Truncation (geschwätziges Modell). Cross-Vendor weiter offen. Details im [Nachtrag](../../docs/evals/instrument-validierung/checkpoint-d-stufe1-ergebnis.md), Rohdaten `judge-kalibrierung-2026-07-01-structured-output.{md,json}`. Nächster Schritt: Token-Limit-Test für gemini.

**Lauf 3 — Cross-Vendor, self-grading-frei (Commits f8fa006 Token-Fix + 6da9671 Exclude-Self):** Token-Limits hoch (dialog 3000, depth 4000, grounding 2500) → `NoObjectGeneratedError` 96→8; `EVAL_JUDGE_EXCLUDE_SELF` lässt jedes Gemini nur fremde Transkripte bewerten. Instrument damit technisch solide, Signal echt. **Definitives Verdikt: Cross-Vendor κ≥0.61 nicht erreicht, aber aus belastbarem Grund** — beide Gemini-Judges sind systematisch milder als Haiku auf dialog (20/29 höher, 9 gleich, **0 strenger**), grounding subjektiv/verrauscht, depth robust aber prävalenz-degeneriert (fast konstant Stufe 2). Anthropic- und Google-Judges kalibrieren subjektive Dialogqualität echt unterschiedlich. Konsequenzen für den Versuchsplan (separat): Single-Vendor-Kalibrierung (Haiku, konservativ), depth-Gate prävalenz-adjustiert statt κ, κ-Cross-Vendor-Forderung überdenken. Details + Zahlen im [Nachtrag](../../docs/evals/instrument-validierung/checkpoint-d-stufe1-ergebnis.md), Rohdaten `judge-kalibrierung-2026-07-01-crossvendor-excludeself.{md,json}`.

### Kriterium E — Stufe-1-Gate neugestaltet, 2026-07-02

Die drei Lauf-3-Konsequenzen sind in Versuchsplan §6 und im Code umgesetzt (Rückfragen 2026-07-02: grounding zu Diagnose deklassiert, Cross-Vendor zurückgezogen). [Versuchsplan §6](../../docs/evals/versuchsplan-modell-benchmarking.md) + [Verdikt-Doc „Entscheidung"](../../docs/evals/instrument-validierung/checkpoint-d-stufe1-ergebnis.md) + [ADR-020-Nachtrag 2026-07-02](../../docs/adr/ADR-020-eval-methodik-modell-benchmarking.md).

- **Single-Vendor-Kalibrierung** statt Cross-Vendor: Prod `claude-haiku-4-5` (Anker) vs. Referenz `claude-sonnet-4-5` (same-vendor Frontier, Stärke-Check nach ADR-020 D3.2). Cross-Vendor-Referenz zurückgezogen — kein tauglicher Judge (gemini-3.5 Deckeneffekt Ø 0.97, gemini-3.1 = Interviewer). Default `EVAL_REFERENCE_JUDGE_MODELS` → Sonnet-only ([judgeCalibration.ts](../../src/services/__evals__/interview/validation/judgeCalibration.ts) + [judge-preflight.ts](../../scripts/judge-preflight.ts)).
- **Kriterium rollen-/skalen-gerecht statt uniform-κ:** dialog (gatet in `evaluateGate`) Match ≥ 0.66 + Adjazenz ≥ 0.90 + |Versatz| ≤ 0.5, gewichtetes κ Begleitwert; depth (Diskriminator) PABAK ≥ 0.5 + Adjazenz = 1.0, nominal-κ verworfen (Kappa-Paradox über 3 Läufe); grounding zu Diagnose deklassiert (kein Gate, an KI-18 gekoppelt).
- **Neue Reliabilitäts-Voraussetzung:** Haiku Test-Retest ≥ 0.85 je Dimension (ersetzt Referenz-Selbststabilität; Haiku ist im Single-Vendor-Design sein eigener Anker).
- **Verdikt-Lauf 2026-07-02 (Single-Vendor, n=29, temp 0):** Rohdaten `judge-kalibrierung-2026-07-02.{md,json}`. **dialog PASS** (Match 0.72 ≥0.66, Adjazenz 1.0, |Versatz| 0.21, Haiku-Reliabilität 1.0) — die gate-relevante Dimension ist validiert. **depth** reliabel (Haiku-Test-Retest 0.857 korrekt gerechnet, PABAK 0.59 + Adjazenz 1.0), bleibt aber caveated Diskriminator wegen Prävalenz-Degeneration (fast konstant Stufe 2, geringe Trennschärfe). **grounding** Diagnose (Match 0.72, nicht gegated). Reproduzierbar gegen Lauf 2. Nachweis-Detail (u.a. depth-Reliabilität-Korrektur 0.83→0.857 nach Ausschluss des einen Nicht-Haiku-prod-Transkripts, Rundungsgrenzfall-Beleg): [Verdikt-Doc](../../docs/evals/instrument-validierung/checkpoint-d-stufe1-ergebnis.md). **Stufe 1 bestanden** (dialog validiert, depth reliabel-aber-caveated, grounding Diagnose); nächster Schritt Stufe 2 (Tester-Stabilität).

### Stufe 2 — Tester-Stabilität: Harness fertig, Sweep ZURÜCKGESTELLT (2026-07-03)

Scaffold zu runnable Harness ausgebaut ([validation/testerStability.ts](../../src/services/__evals__/interview/validation/testerStability.ts)): read-from-dir-Aggregation der getaggten transcript.json in (Tester × Modus)-Zellen, Qualitäts-Median je Interview-Modell, plus beide Kontraste (Tester-Stärke + Offenlegungs-Modus) über die bestehende `compareRankings`-Mechanik. Neue reine Helfer `aggregateCells`/`buildContrast`/`contrastPasses` (unit-getestet, 6 neue Tests). Runner taggt transcript.json jetzt mit `testerModel` + `disclosureMode` (env-authoritativ) → Zell-Zuordnung. `tsc` grün, 836/837 Tests.

**Vorabtest 2026-07-03** (3 Modelle × buchhalter × 1 Run, je n=1): `dedupSlotCoverage`-Spread existiert (gemini-lite 0.94 > gemini-3.5 0.81 > haiku 0.70, Range 0.24) → Ranking nicht-degeneriert, Prüfung wäre aussagekräftig. **Kontraintuitiv:** das billigste Modell rankt am besten, das stärkste am schlechtesten; `dialogNaturalness` läuft gegenläufig — Metrik-Validitäts-Hinweis (Kriterium A), zu prüfen bevor ein Ranking PROJ-41-Entscheidungen trägt.

**Sweep zurückgestellt** (Nutzer-Entscheidung 2026-07-03): der moderate Sweep (~$14–24, ~1.5–3 h) ist zu teuer gemessen am aktuellen Mehrwert. **Reaktivierung**, wenn der Mehrwert „sehr hoch" und die Ergebnisse „zentral" sind — konkret: sobald PROJ-41 angegangen wird und dem Modell-Ranking vertraut werden muss. Details + Vorabtest-Zahlen + exakte Kommandos: [stufe2-run-plan.md](../../docs/evals/instrument-validierung/stufe2-run-plan.md).

**Gating-Konsequenz:** PROJ-40 Kriterium F (PROJ-41-Gate) verlangt Stufe 1 UND Stufe 2. Stufe 1 ist bestanden; **Stufe 2 bleibt offen (zurückgestellt)** → PROJ-41 bleibt sauber gegated. PROJ-40 pausiert an dieser Stelle statt zu beschönigen (kein „Approved" ohne Stufe-2-Verdikt).

**Nachtrag 2026-07-03 — Stufe 2 kosten-proportional statt Blanket-Vorab-Gate.** Damit PROJ-41 nicht hinter einem ~$20-Vorab-Sweep blockiert, wurde Kriterium F angepasst: der Offenlegungs-Modus wird als Kontrolle fixiert (Confounder ausgeschaltet ohne Lauf), und die Tester-Stärke-Prüfung wird als gezielter Spot-Check auf dem entscheidenden Paar (Baseline + führender Kandidat, starker Sonnet-Tester, ~$1–3) in den PROJ-41-Benchmark eingefaltet. Gegated ist die *Entscheidung*, nicht der *Start* von PROJ-41; der Blanket-Sweep bleibt Eskalation, falls der Spot-Check kippt. Zusätzlich: Ranking über mehrere Kennzahlen (nicht `dedupSlotCoverage` allein, wegen des kontraintuitiven Vorabtest-Befunds). Festgeschrieben in [Versuchsplan §4/§6/§7](../../docs/evals/versuchsplan-modell-benchmarking.md) + [ADR-020-Nachtrag 2026-07-03](../../docs/adr/ADR-020-eval-methodik-modell-benchmarking.md). PROJ-41 kann damit unter der günstigen Regel starten, sobald angegangen.

### Stufe 2 — Tester-Stabilität: fokussierter Check AUSGEFÜHRT, Verdikt GO (2026-07-03)

Der kosten-proportionale Check (nicht der zurückgestellte Blanket-Sweep) ist gefahren. Vollständige Analyse + Grenzen: [checkpoint-d-stufe2-ergebnis.md](../../docs/evals/instrument-validierung/checkpoint-d-stufe2-ergebnis.md), Rohartefakt [tester-stabilitaet-2026-07-03.md](../../docs/evals/instrument-validierung/tester-stabilitaet-2026-07-03.md).

- **Design:** Proxy-Paar `gemini-3.1-flash-lite` (Baseline) vs. `claude-haiku-4-5` (weitester heute verfügbarer Spread; PROJ-41s echte OSS-Kandidaten sind noch nicht als Provider verdrahtet — OpenRouter = PROJ-41 Stage 1). Persona buchhalter ×2, Seed 42, pglite, Modus B fixiert. Zwei Zellen: C1 schwacher Tester (gemini-lite) vs. C2 starker Tester (sonnet). 8 Interviews, Preflight bestanden.
- **Ergebnis:** Unter beiden Testern rankt haiku über gemini-lite — auf allen drei Kennzahlen (dedup 0.925/0.795 → 0.91/0.85; dialog 1.0/0.67 → 1.0/0.67; potenzial 1.0/0.875 → 0.915/0.805). `pairAgreement=1`, `topRankStable=true` durchgehend. Tester-Stärke verschiebt Absolutwerte leicht (nivellierend), kippt die Ordnung nicht.
- **Vorabtest-Korrektur:** der n=1-Vorabtest (gemini-lite > haiku auf dedup) war reines Einzellauf-Rauschen; mit n=2 kehrt es sich um und ist über beide Tester + alle drei Kennzahlen konsistent. Bestätigt die ≥2-Läufe-Wahl fürs Verdikt.
- **Grenze:** gilt fürs Proxy-Paar + buchhalter. PROJ-41 wiederholt den Spot-Check auf seinem tatsächlichen Finalisten-Paar (codifizierte Entscheidungs-Gate §7); kippt er dort, greift die Eskalation.

**Harness-Angleichung (LLM-frei):** `testerStability.ts` globales Verdikt via neuer reiner Funktion `stufe2Pass` — bei fixiertem Modus (kein Mode-A-Datensatz) keyt es allein auf den Tester-Kontrast statt einen (per Design fehlenden) Modus-Kontrast als NO-GO zu werten. Modus-Sektion rendert „n/a — als Kontrolle fixiert". 6 neue/erweiterte Unit-Tests (`stufe2Pass`-Fälle: Modus fixiert vs. variiert, fehlender Tester-Kontrast). `tsc` grün.

**Stufe 1 + Stufe 2 beide GO → PROJ-41-Gate (Kriterium F) erfüllt.** Alle Acceptance-Kriterien A–F erfüllt; Status In Review (Handoff `/qa` → `/deploy`). Der Eval-Gate für Interview-Engine-Features (erfolgreicher `eval:interview`-Lauf) ist durch die 8 Stufe-2-Interviews nachgewiesen.

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
