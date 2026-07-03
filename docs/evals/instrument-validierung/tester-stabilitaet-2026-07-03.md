# Checkpoint D Stufe 2 — Tester-Stabilität, Ergebnis

Datum 2026-07-03 · Qualitäts-Kennzahl: `dedupSlotCoverage` (Median über Läufe) · Band pairAgreement ≥ 0.8

## Zellen-Inventar (Tester × Modus)

| Tester | Disclosure-Modus | Interview-Modell-Qualität |
|---|---|---|
| anthropic/claude-sonnet-4-5 | withhold_numbers_only | anthropic/claude-haiku-4-5=0.91 (n=2), google/gemini-3.1-flash-lite=0.85 (n=2) |
| google/gemini-3.1-flash-lite | withhold_numbers_only | anthropic/claude-haiku-4-5=0.925 (n=2), google/gemini-3.1-flash-lite=0.795 (n=2) |

## Kontraste

### Tester-Stärke (Modus fixiert)

Kontrast: **google/gemini-3.1-flash-lite** vs. **anthropic/claude-sonnet-4-5** · Modelle (gemeinsam): anthropic/claude-haiku-4-5, google/gemini-3.1-flash-lite

| Metrik | Wert | Schwelle |
|---|---|---|
| pairAgreement | 1 | ≥ 0.8 |
| topRankStable | true | true |

Ranking google/gemini-3.1-flash-lite: anthropic/claude-haiku-4-5 > google/gemini-3.1-flash-lite
Ranking anthropic/claude-sonnet-4-5: anthropic/claude-haiku-4-5 > google/gemini-3.1-flash-lite

**Verdikt: PASS**

### Offenlegungs-Modus (Tester fixiert)

**n/a — Modus als Kontrolle fixiert** (Reframe 2026-07-03, Versuchsplan §4/§6): der Offenlegungs-
Modus wird konstant gehalten (Modus B), nicht über A/B variiert. Ein für alle Modelle gleicher
Faktor kann den Vergleich nicht confounden — kein Kontrast nötig, das Verdikt keyt allein auf
der Tester-Stärke. Der A/B-Modus-Sweep bleibt Eskalation ([stufe2-run-plan.md](stufe2-run-plan.md)).

## Verdikt Checkpoint D Stufe 2

**GO** — der Tester-Stärke-Kontrast erfüllt das Band; der Offenlegungs-Modus ist als Kontrolle fixiert (kein Confounder). Die Test-Rolle ist für die entscheidende Ordnung ausreichend stabil (Versuchsplan §6 Stufe 2, kosten-proportionaler Check).
