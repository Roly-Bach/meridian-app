# Versuchsplan — Modell-Benchmarking (PROJ-40 Kriterium E / ADR-020 D6)

> Festgeschriebener Versuchsplan für reproduzierbare, vergleichbare PROJ-41-Läufe.
> Erstellt 2026-06-30. Bindet: [Metrik-Audit](instrument-validierung/metrik-audit.md) (A),
> [Persona-/Tester-Review](instrument-validierung/persona-tester-review.md) (C),
> [ADR-020](../adr/ADR-020-eval-methodik-modell-benchmarking.md).
>
> **Status:** Freigegeben (Schritt-für-Schritt mit Nutzer durchgegangen, 2026-06-30). Die mit
> „⟶ aus D" markierten Schwellen werden durch die Validierungsläufe (Stufe 1 + 2) final gesetzt,
> bevor PROJ-41 startet (§7 Gating).

## 1. Fragestellung
Kann ein anderes Interview-Modell `google/gemini-3.1-flash-lite` ablösen, gemessen an KI-Potenzial-
Erfassungs-Qualität bei vertretbaren Kosten — und zwar mit einem Messinstrument, dessen Test- und
Eval-Rollen vorab als ausreichend validiert sind?

## 2. Faktoren und Stufen

| Faktor | Rolle | Stufen | Anmerkung |
|--------|-------|--------|-----------|
| **Interview-Modell** | Prüfling (PROJ-41 variiert) | `gemini-3.1-flash-lite` (Baseline) + PROJ-41-Kandidaten (OSS-Screening, EU-Route) | In PROJ-40-Validierung fixiert, damit das Instrument isoliert geprüft wird |
| **Tester-Modell-Stärke** | Instrument (Stufe 2) | schwach (`gemini-3.1-flash-lite`) · stark (Frontier, z.B. `claude-sonnet-4-5`) | EU-frei, ADR-020 D1 |
| **Tester-Offenlegungs-Modus** | Instrument/Kontrolle (C) | A `withhold_tools_and_numbers` · B `withhold_numbers_only` | Entkoppelt von Persona-Persönlichkeit |
| **Judge-Modell** | Instrument (Stufe 1) | Prod-Judge (`claude-haiku-4-5` / `gemini-3.1-flash-lite` cross-vendor) · Referenz-Judge (Frontier) | Kalibrierung Prod vs. Referenz |
| **Persona** | Block | buchhalter · vertriebler · it-support | Persönlichkeiten bleiben divers (C); Block, kein Treatment |

## 3. Zielgrößen (Antwortvariablen)

**Gate-Metriken (Pass/Fail, nach Revision):**
`completionCorrectness`, `dedupSlotCoverage` (≥0.75), `stepRegistrationCoverage` (≥0.8),
`dialogNaturalness` (≥0.65), `blockedRate` (<0.1), `potenzialCoverage` (⟶ Schwelle aus erstem Benchmark).

**Primäre KI-Potenzial-Diskriminatoren (maximize, nicht zwingend Gate):**
`potenzialCoverage` (ROI-Facetten), Abhängigkeits-Erfassung, `conversationalEfficiency` (Slots/Turn,
Turns-bis-Completion), `slotDepth` (fokussiert auf Automatisierbarkeits-Felder).

**Diagnose (berichtet, nicht Gate):**
`slotCoverage` (raw, Fragmentierungs-Gap), `schemaConformanceRate`, `hallucinationRate` (nach Prüfer-
Umbau), `toolCallPlausibility`, `confidenceTrigger`, `anchoringViolations`, `phaseProgression/-adherence`,
`overwrite_churn`, `talker_grounding_violations` (nach KI-18-Fix).

**Latenz/TTFT:** im pglite-Eval NICHT erhoben (synthetischer Tester, Buffer-then-stream-Talker). Erst
PROJ-41 Stage-2 gegen die echte Provider-API (ADR-020, Metrik-Audit §5).

**Kosten:** drei Buckets (Interview / Test / Eval) je Lauf (Batch 1), `$/Run` und je Bucket.

## 4. Kontrollen (konstant gehalten)
- Seed `42` (Perturbation `seed + runIndex − 1`).
- Persistenz `--store pglite` (DB-frei, reproduzierbar, PROJ-34).
- Talker-/Analyst-Thinking-Budgets, Prompt-Versionen, `MAX_TURNS=35`.
- Persona-Definitionen + Ground-Truth-Block (eingefroren je Benchmark-Charge).
- Greeting/Reconnect-Prompts.

## 5. Replikation
- **3 Läufe je Zelle** (Modell × Persona), fester Seed, Median-basiert (Min/Max als Streuung).
- Aggregat-Report je Modell×Persona (vorhandene `writeAggregateReport`-Mechanik).
- Stufe-1/2-Validierung getrennt (eigene Harnesses, Batch 1): Judge-Kalibrierung offline auf den
  fixierten Transkripten (stratifizierte Stichprobe, 29 Stück), Tester-Stabilität über frische Läufe.

## 6. Schwellen aus Stufe 1 und 2

### Stufe 1 — Judge-Kalibrierung (Design-Eignung Eval-Rolle)
- **Anker-Vorprüfung:** der Referenz-Judge muss selbst stabil sein — zwei Läufe auf derselben
  Stichprobe, Selbst-Übereinstimmung `Cohen-κ ≥ 0.8`. Sonst ist die Kalibrierung wertlos (Edge Case).
- **Kriterium je eval-zeitlichem Judge:** Übereinstimmung Prod-Judge vs. Referenz-Judge auf der
  stratifizierten Stichprobe `Cohen-κ ≥ 0.61` (Landis-Koch „substantial"), Level-Match-Quote als
  Begleitwert berichtet. `κ < 0.61` ⟶ Verdikt „Prod-Judge nicht ausreichend" für diese Dimension.
- Gilt je Judge-Dimension (dialog_naturalness, slot_depth, talker_grounding) getrennt.

### Stufe 2 — Tester-Stabilität (Eignung Test-Rolle)
- **Tester-Stärke:** Interview-Modell-Ranking über schwachen vs. starken Tester, `pairAgreement ≥ 0.8`
  UND Top-Rang stabil. Darunter ⟶ der schwache Tester verzerrt das Ranking ⟶ Verdikt „nicht
  ausreichend", PROJ-41 braucht stärkeren Tester.
- **Offenlegungs-Modus (C):** Ranking über Modus A vs. B, gleiches Band `pairAgreement ≥ 0.8`. Kippt
  das Ranking, ist der Modus ein starker Confounder und muss vor dem Benchmarking kontrolliert
  (fixiert) werden, nicht frei gelassen.
- Konservativ bei Uneindeutigkeit: teils-stabil ⟶ als „nein/unklar" werten (Edge Case).

### Datengestützte Schwellen ⟶ aus erstem Benchmark
- `potenzialCoverage`-Gate-Schwelle: nach dem ersten vollständigen Benchmark aus der realen Verteilung
  setzen (nicht blind). Bis dahin berichtet.
- `schemaConformanceRate`: bleibt Diagnose, Gate-Erwägung erst nach Verteilungs-Sicht.

## 7. Analyse, Entscheidungsregel und Gating

**Analyse:** je Zelle Median über 3 Läufe; Modellvergleich über Median + Streuung; Kosten je Bucket
gegenübergestellt.

**Entscheidungsregel PROJ-41 (Modellwechsel) — satisficing + kosten-/rausch-bewusst, kein argmax:**
1. **Gate-Pass ist Pflicht** (hart, alle Schwellen erfüllt).
2. **Nicht-Unterlegenheit auf KI-Potenzial:** der Kandidat darf auf den primären Diskriminatoren
   (`potenzialCoverage`, Abhängigkeits-Erfassung, `conversationalEfficiency`) nicht *bedeutsam*
   schlechter sein als die Baseline. Differenz innerhalb der 3-Lauf-Streuung gilt als gleichwertig.
3. **Auswahl primär nach Kosten/Latenz** unter den qualifizierten Kandidaten (Interview-Bucket; Test-/
   Eval-Overhead getrennt; Latenz aus Stage-2). Anlass des Benchmarks ist ein günstigeres/besseres
   Modell, Kosten sind Ziel, nicht bloße Nebenbedingung.
4. **Ausnahme:** ein Kandidat darf höhere Kosten rechtfertigen, wenn er auf den KI-Potenzial-
   Diskriminatoren *bedeutsam* (über die Lauf-zu-Lauf-Streuung hinaus) besser ist.
5. **Bedeutsamkeits-Schwelle:** jeder Wechsel (für Qualität oder Kosten) verlangt einen Vorteil größer
   als die 3-Lauf-Streuung — sonst bleibt die Baseline (Status-quo-Reibung gegen Rauschen).
6. **Widersprüchliche Diskriminatoren** (A besser auf Potenzial, B auf Effizienz): kein Auto-Argmax,
   sondern dokumentierte Abwägung über die kleine Kandidatenmenge.

**Gating (Kriterium F):** PROJ-41-Screening darf erst starten, wenn Stufe 1 UND Stufe 2 mit
dokumentiertem Go/No-Go-Verdikt je Rolle bestanden sind. Bei „nein" ohne verfügbares stärkeres Modell
bleibt das Verdikt „nein"; Beschaffung/Auswahl ist PROJ-41, PROJ-40 blockt sauber statt zu beschönigen.

## 8. Offen vor Ausführung
- Judge-API-Key-Preflight (Referenz-Judge), Google-Quota-Status (KI-18-Risiko: AI-Studio-Spend-Cap).
- Code-Voraussetzungen aus Batch 2 / C: neue Scorer, `disclosureMode`-Parametrisierung, Ground-Truth-
  Block, hallucination-Prüfer-Umbau. Stufe-1-Judge-Kalibrierung läuft schon jetzt (offline auf
  bestehenden Transkripten, Harness aus Batch 1).
