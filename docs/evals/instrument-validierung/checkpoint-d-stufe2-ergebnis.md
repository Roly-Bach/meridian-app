# Checkpoint D Stufe 2 — Tester-Stabilität: Ergebnis + Verdikt

> Ausgeführt 2026-07-03 (kosten-proportionaler In-Benchmark-Check, nicht der zurückgestellte
> Blanket-Sweep). Bindet: [Versuchsplan §6 Stufe 2](../versuchsplan-modell-benchmarking.md),
> [ADR-020-Nachtrag 2026-07-03](../../adr/ADR-020-eval-methodik-modell-benchmarking.md),
> [stufe2-run-plan.md](stufe2-run-plan.md) (Eskalations-Option). Rohartefakt:
> [tester-stabilitaet-2026-07-03.md](tester-stabilitaet-2026-07-03.md).

## Frage (Versuchsplan §6 Stufe 2)

Bleibt die relative Ordnung des entscheidenden Modell-Paars stabil, wenn der Tester (Persona-
Simulator) von schwach auf stark wechselt? Kippt sie, ist die Tester-Stärke Teil des Messfehlers und
eine PROJ-41-Entscheidung dürfte dem Benchmark nicht trauen. Der Offenlegungs-Modus wird nicht als
Faktor getestet, sondern als Kontrolle fixiert (Modus B, §4) — ein für alle Modelle gleicher Faktor
kann den Vergleich nicht confounden.

## Versuchsdesign (fokussiert)

Zwei Zellen, gemeinsame Basis, nur die Tester-Stärke variiert:

| Zelle | Tester | Modus | Rolle |
|---|---|---|---|
| C1 | schwach `google/gemini-3.1-flash-lite` | B `withhold_numbers_only` | Referenz (Produktions-Tester) |
| C2 | stark `anthropic/claude-sonnet-4-5` | B `withhold_numbers_only` | Stärke-Kontrast |

- **Entscheidendes Paar (Proxy):** `google/gemini-3.1-flash-lite` (Baseline) vs. `anthropic/claude-haiku-4-5`.
  PROJ-41s echte OSS-Kandidaten (Kimi K2.6, DeepSeek V4, Gemini 3.5) sind noch nicht als Provider
  verdrahtet (OpenRouter = PROJ-41 Stage 1). Für die **Instrument-Eigenschaft** „ändert Tester-Stärke
  das Ranking?" genügt ein Paar mit reellem Qualitäts-Spread — hier das weiteste heute verfügbare Paar.
  Der Spot-Check auf PROJ-41s tatsächlichem Finalisten bleibt die codifizierte Entscheidungs-Gate (§7).
- Persona buchhalter, 2 Läufe je Zelle, Seed 42, `--store pglite`. Identischer Seed über C1/C2
  isoliert den Tester-Effekt (gleiche Persona-Perturbation, nur der Tester wechselt). 8 Interviews.
- Preflight bestanden (Anthropic Sonnet+Haiku, Google gemini-lite — Keys gültig, Google-Quota frei).

## Ergebnis — Ranking stabil über alle drei Kennzahlen

Median je Modell über 2 Läufe. Ranking wurde auf drei Kennzahlen gerechnet (Versuchsplan §7 Punkt 7,
Konsequenz aus dem kontraintuitiven n=1-Vorabtest — der Harness re-aggregiert dieselben Transkripte
je `STABILITY_QUALITY_KEY` ohne Extra-Läufe):

| Kennzahl | C1 schwach: haiku / lite | C2 stark: haiku / lite | pairAgreement | topRankStable |
|---|---|---|---|---|
| `dedupSlotCoverage` (Gate) | 0.925 / 0.795 | 0.91 / 0.85 | 1.0 | true |
| `dialogNaturalness` (Gate) | 1.0 / 0.67 | 1.0 / 0.67 | 1.0 | true |
| `potenzialCoverage` (Diskriminator) | 1.0 / 0.875 | 0.915 / 0.805 | 1.0 | true |

Unter **beiden** Testern rankt `claude-haiku-4-5` über `gemini-3.1-flash-lite` — auf jeder Kennzahl.
Die Tester-Stärke verschiebt Absolutwerte leicht (haiku dedup 0.925→0.91, lite dedup 0.795→0.85: der
starke Tester hebt das schwächere Modell etwas an und senkt das stärkere etwas — plausibel, ein
härterer Gesprächspartner nivelliert), **kippt die Ordnung aber nicht**. `pairAgreement = 1.0` und
`topRankStable = true` in allen drei Läufen.

**Korrektur der Vorabtest-Beobachtung:** der n=1-Vorabtest (2026-07-03 vormittags) sah gemini-lite
(0.94) über haiku (0.70) auf dedup — das war reines Einzellauf-Rauschen. Mit n=2 kehrt sich das um
und ist über beide Tester und alle drei Kennzahlen konsistent (haiku oben). Das bestätigt die n=1-
Warnung im Vorabtest und die Wahl von ≥2 Läufen für das formale Verdikt.

## Verdikt Checkpoint D Stufe 2: **GO**

Die Test-Rolle ist als Instrument für die entscheidende Ordnung ausreichend stabil. Das Ranking des
entscheidenden Paars hängt nicht an der Tester-Stärke (Band `pairAgreement ≥ 0.8` mit tatsächlichem
Wert 1.0 klar erfüllt, Sieger unverändert). Der Offenlegungs-Modus ist als Kontrolle fixiert, kein
Confounder. Damit ist die kosten-proportionale Stufe-2-Bedingung des Versuchsplans erfüllt.

**Grenzen (bewusst):**
- Das Verdikt gilt für das getestete Proxy-Paar und die Persona buchhalter. PROJ-41 muss den Spot-Check
  auf **seinem** tatsächlichen Finalisten-Paar wiederholen (Versuchsplan §6/§7); kippt er dort, greift
  die Eskalation (Blanket-Sweep, [stufe2-run-plan.md](stufe2-run-plan.md)).
- Absolutwert-Verschiebung durch Tester-Stärke ist real (siehe oben), nur ordnungsneutral. Ein
  künftiger Benchmark mit sehr eng beieinanderliegenden Kandidaten sollte den Spot-Check nicht als
  Freibrief lesen — bei Sub-Streuungs-Abständen ist die Ordnung ohnehin nicht belastbar (§7 Punkt 5).

## Artefakte
- Harness-Rohbericht: [tester-stabilitaet-2026-07-03.md](tester-stabilitaet-2026-07-03.md) (Gate-Kennzahl dedup).
- 8 Transkripte: `docs/evals/interview/2026-07-03/*-run{1,2}.transcript.json` (getaggt `testerModel` + `disclosureMode`).
- Auswertung reproduzierbar: `npx tsx src/services/__evals__/interview/validation/testerStability.ts --dir <dir>`
  (Kennzahl via `STABILITY_QUALITY_KEY`, Default `dedupSlotCoverage`).
