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
| **Judge-Modell** | Instrument (Stufe 1) | Prod-Judge `claude-haiku-4-5` (Anker) · Referenz-Judge `claude-sonnet-4-5` (Frontier, Stärke-Check) | Single-Vendor-Kalibrierung; Cross-Vendor zurückgezogen (s. §6 + ADR-020-Nachtrag) |
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
- **Offenlegungs-Modus fixiert** auf `withhold_numbers_only` (Modus B, realistischer Default). Statt
  ihn als Faktor über Modus A/B zu variieren und die Ranking-Stabilität zu testen (Stufe 2, alt), wird
  er als Kontrolle konstant gehalten — ein für alle Modelle gleicher Faktor kann den Vergleich nicht
  confounden. Das entspricht der Versuchsplan-eigenen Regel „bei Confounder-Verdacht fixieren" und
  erspart den Modus-Kontrast-Sweep (s. §6 Stufe 2 neu). Der Modus-Effekt selbst bleibt damit ungemessen;
  falls er später interessiert, ist das eine eigenständige Studie, kein PROJ-41-Vorab-Gate.

## 5. Replikation
- **3 Läufe je Zelle** (Modell × Persona), fester Seed, Median-basiert (Min/Max als Streuung).
- Aggregat-Report je Modell×Persona (vorhandene `writeAggregateReport`-Mechanik).
- Stufe-1/2-Validierung getrennt (eigene Harnesses, Batch 1): Judge-Kalibrierung offline auf den
  fixierten Transkripten (stratifizierte Stichprobe, 29 Stück), Tester-Stabilität über frische Läufe.

## 6. Schwellen aus Stufe 1 und 2

### Stufe 1 — Judge-Kalibrierung (Design-Eignung Eval-Rolle)

> Neugestaltet 2026-07-02 nach den Checkpoint-D-Läufen 1–3 (drei Kalibrierungsläufe auf der
> fixierten Stichprobe). Begründung + Rohdaten:
> [checkpoint-d-stufe1-ergebnis.md](instrument-validierung/checkpoint-d-stufe1-ergebnis.md).
> Kernbefund: die frühere einheitliche `Cohen-κ ≥ 0.61`-Cross-Vendor-Forderung ist für subjektive
> Dialogqualität unrealistisch (echter Vendor-Milde-Gradient Haiku 0.69 → Sonnet 0.76 →
> gemini-3.1 0.84 → gemini-3.5 0.97, kein Instrument-Defekt), und es existiert kein tauglicher
> Cross-Vendor-Judge (gemini-3.5-flash Deckeneffekt bei Ø 0.97, gemini-3.1-flash-lite = Interviewer
> → Selbst-Bewertung). Kalibrierung daher **Single-Vendor**, Kriterium rollen- und skalen-gerecht
> statt uniform-κ.

**Aufstellung:** Prod-Judge `claude-haiku-4-5` (konservativer, trennschärfster Anker — nutzt alle
drei Stufen). Referenz-Judge `claude-sonnet-4-5` (gleiche Vendor-Familie, Frontier) als Stärke-Check
im Sinne von [ADR-020 D3.2](../adr/ADR-020-eval-methodik-modell-benchmarking.md) (schwacher Prod- vs.
starker Referenz-Judge — vendor-agnostisch formuliert). Cross-Vendor-Referenz zurückgezogen bis ein
tauglicher Google/OpenAI-Judge verfügbar ist (ADR-020-Nachtrag 2026-07-02).

**Reliabilität (Voraussetzung, ersetzt die alte Referenz-Selbststabilität):** im Single-Vendor-Design
ist der Prod-Judge (Haiku) sein eigener Anker. Daher Test-Retest auf identischer Stichprobe, zwei
Läufe, **Selbst-Match ≥ 0.85 je Dimension** (Test-Retest ist strenger als Cross-Judge-Übereinstimmung,
daher die höhere Schwelle). Darunter ist der Judge zu verrauscht, um als Anker zu dienen.

**Kriterium je Dimension — rollen- und skalen-gerecht (nicht mehr uniform nominal-κ):**

- **dialog_naturalness** (einzige Judge-Dimension, die in `evaluateGate` gatet → muss validiert sein):
  Prod (Haiku) vs. Referenz (Sonnet) auf der Stichprobe —
  **Level-Match ≥ 0.66** UND **Adjazenz ≥ 0.90** (`|idxProd − idxRef| ≤ 1`) UND
  **|mittlerer signierter Versatz| ≤ 0.5** (kein grober systematischer Bias). Nominal-κ ist KEINE
  Schwelle (ordinaler Offset + Prävalenz machen es ungeeignet), gewichtetes κ wird als Begleitwert
  berichtet. Verfehlt eine der drei Bedingungen ⟶ „Judge nicht ausreichend kalibriert für dialog".

- **slot_depth** (primärer Diskriminator, kein Gate in runner):
  **PABAK ≥ 0.5** (prävalenz-adjustiert, = Level-Match ≥ 0.75) UND **Adjazenz = 1.0**. Nominal-κ
  explizit verworfen (Kappa-Paradox über drei Läufe bestätigt: Match 0.79–0.83 bei κ 0.30–0.34,
  22/29 Stufe 2). Caveat: die Skala ist stark prävalenz-degeneriert (fast konstant Stufe 2, nie
  Stufe 3) → geringe Diskriminierung; als Ranking-Diskriminator nur mit dieser Einschränkung nutzen.

- **talker_grounding**: zu **Diagnose deklassiert, KEIN Kalibrierungs-Gate**. Begründung: (a) in
  `evaluateGate` ohnehin keine Gate-Metrik; (b) Übereinstimmung auch same-vendor schwach (Match 0.72 /
  κ 0.46), die Verletzungs-Definition ist zu subjektiv; (c) an offenes KI-18 gekoppelt (Grounding-
  Guard/-Judge noch nicht robust). Wird berichtet, nicht als validiert gelabelt, bis KI-18 gelöst ist.

**Verdikt-Logik:** Stufe 1 gilt als bestanden, wenn **Reliabilität + dialog + depth** ihre Bedingungen
erfüllen. grounding zählt nicht ins Gate. Ein Nicht-Bestehen auf **dialog** blockt PROJ-41 (dialog gatet
die Läufe). Ein Nicht-Bestehen auf **depth** degradiert depth zu „mit Vorbehalt berichtet", blockt
allein nicht.

### Stufe 2 — Tester-Stabilität (Eignung Test-Rolle)

> Neugestaltet 2026-07-03: von einem blanket Vorab-Gate (alle Modelle × beide Tester × beide Modi,
> ~$14–24) auf einen **kosten-proportionalen, gezielten In-Benchmark-Check** umgestellt. Grund: der
> teure Vorab-Sweep ist nicht gerechtfertigt, solange er nur einen generischen Ranking-Vergleich
> validiert; PROJ-41 braucht nur die Zusicherung, dass *seine konkrete Entscheidung* kein Tester-
> Artefakt ist. Der blanket-Sweep bleibt als optionale Eskalation geparkt
> ([stufe2-run-plan.md](instrument-validierung/stufe2-run-plan.md)). ADR-020-Nachtrag 2026-07-03.

- **Offenlegungs-Modus (C): fixiert statt getestet.** Der Modus wird als Kontrolle konstant gehalten
  (§4, Modus B), nicht über A/B variiert. Ein für alle Modelle gleicher Faktor kann nicht confounden;
  der Modus-Kontrast-Sweep entfällt kostenlos.

- **Tester-Stärke: gezielter Spot-Check auf dem entscheidenden Paar, in PROJ-41 eingefaltet.** PROJ-41
  fährt seine Kandidaten ohnehin unter dem Produktions-Tester (schwach). Zusätzlich läuft der starke
  Tester (`claude-sonnet-4-5`) **nur auf den zwei Modellen, die die Entscheidung tragen** (Baseline +
  führender Kandidat) × 1 Persona × 2 Läufe (~4 Interviews, ~$1–3). Der Harness
  ([testerStability.ts](instrument-validierung/../../../src/services/__evals__/interview/validation/testerStability.ts))
  vergleicht automatisch die in beiden Tester-Zellen gemeinsame Modell-Teilmenge (`buildContrast`
  restringiert darauf) — kein neuer Code. **Kriterium:** die relative Ordnung des entscheidenden Paars
  bleibt unter dem starken Tester erhalten (`topRankStable` für das Paar, `pairAgreement = 1` bei zwei
  Modellen). Kippt sie ⟶ Entscheidung ist tester-abhängig ⟶ dann (und erst dann) ist der größere
  Tester-Sweep gerechtfertigt (Eskalation).

- Rationale für „nur das entscheidende Paar": die Entscheidungsregel (§7) ist satisficing +
  Nicht-Unterlegenheit + kosten-primär, kein Argmax. Die exakte Platzierung abgeschlagener Modelle ist
  irrelevant; robust muss nur der Sieger-gegen-Herausforderer-Vergleich sein.

- Konservativ bei Uneindeutigkeit: kippt das Paar oder ist der Spot-Check nicht berechenbar ⟶ als
  „nein/unklar" werten, Entscheidung aussetzen bis der Eskalations-Sweep Klarheit schafft (Edge Case).

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
7. **Ranking über mehrere Kennzahlen, nicht `dedupSlotCoverage` allein.** Der Stufe-2-Vorabtest
   (2026-07-03) zeigte, dass `dedupSlotCoverage` gegenläufig zu `dialogNaturalness` rankt (das billigste
   Modell schnitt auf dedup am besten, auf dialog am schlechtesten ab). Ein Ein-Kennzahl-Argmax wäre
   irreführend. Das Ranking wird daher auf mehreren Kennzahlen berichtet (`dedupSlotCoverage`,
   `dialogNaturalness`, `potenzialCoverage`); der Harness re-aggregiert dieselben Transkripte je
   `STABILITY_QUALITY_KEY` ohne Extra-Läufe. Ein Kandidat, dessen Vorteil nur auf einer Kennzahl steht
   und auf einer anderen umkippt, ist kein klarer Fall (Punkt 6 greift).

**Gating (Kriterium F) — angepasst 2026-07-03:** PROJ-41-Screening darf starten, sobald **Stufe 1**
mit dokumentiertem Go/No-Go bestanden ist (erfüllt, 2026-07-02). **Stufe 2 ist kein Vorab-Gate mehr,
sondern in PROJ-41 eingefaltet:** der gezielte Tester-Stärke-Spot-Check (§6 neu) läuft als Teil des
Benchmarks auf dem entscheidenden Paar. Gegated ist damit nicht der *Start* von PROJ-41, sondern die
*Entscheidung*: ein Modellwechsel wird erst festgeschrieben, wenn der Spot-Check die Ordnung des
entscheidenden Paars unter dem starken Tester bestätigt. Kippt er ⟶ Entscheidung aussetzen, größeren
Tester-Sweep als Eskalation fahren. Bei „nein" ohne verfügbares stärkeres Modell bleibt das Verdikt
„nein"; PROJ-40 blockt sauber statt zu beschönigen.

## 8. Offen vor Ausführung
- Judge-API-Key-Preflight: nach dem Single-Vendor-Umbau (§6) sind Prod- und Referenz-Judge beide
  Anthropic → nur der Anthropic-Key ist Stufe-1-kritisch. Google-Quota (AI-Studio-Spend-Cap) blockt
  Stufe 1 nicht mehr, bleibt aber Risiko für die Interview-Modell-Läufe selbst (KI-18).
- Code-Voraussetzungen aus Batch 2 / C: neue Scorer, `disclosureMode`-Parametrisierung, Ground-Truth-
  Block, hallucination-Prüfer-Umbau. Stufe-1-Judge-Kalibrierung läuft schon jetzt (offline auf
  bestehenden Transkripten, Harness aus Batch 1).
