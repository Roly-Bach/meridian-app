# Checkpoint D Stufe 2 — Tester-Stabilität: Run-Plan

> **Status: ESKALATIONS-OPTION (der Blanket-Sweep unten ist NICHT ausgeführt).** Der reguläre
> Stufe-2-Check — der kosten-proportionale, fokussierte Tester-Stärke-Spot-Check — ist am **2026-07-03
> ausgeführt und mit GO bestanden**: [checkpoint-d-stufe2-ergebnis.md](checkpoint-d-stufe2-ergebnis.md)
> (Paar gemini-3.1-flash-lite vs. claude-haiku-4-5, buchhalter ×2, C1 schwacher vs. C2 starker Tester;
> `pairAgreement=1`, `topRankStable=true` über dedup/dialog/potenzial). Damit ist Stufe 2 erfüllt und
> PROJ-41 kann unter der günstigen Regel starten.
>
> Der hier beschriebene Blanket-Sweep (~$14–24, ~1.5–3 h) bleibt die **Eskalation**, falls PROJ-41s
> Spot-Check auf seinem *tatsächlichen* Finalisten-Paar die Ordnung kippt — nur dann ist sein Mehrwert
> genuin hoch. Regulärer Weg: [Versuchsplan §6/§7](../versuchsplan-modell-benchmarking.md)
> + [ADR-020-Nachtrag 2026-07-03](../../adr/ADR-020-eval-methodik-modell-benchmarking.md). Der
> Vorabtest-Befund unten (kontraintuitive n=1-Ranking-Richtung) motivierte das Ranking über mehrere
> Kennzahlen (Versuchsplan §7 Punkt 7) — im ausgeführten Check mit n=2 war die Ordnung über alle drei
> Kennzahlen konsistent (Vorabtest war reines n=1-Rauschen).

## Vorabtest-Ergebnis (2026-07-03) — Spread bestätigt, Ranking kontraintuitiv

Mini-Charge (3 Modelle × buchhalter × 1 Run, Zelle C1: schwacher Tester, Modus B), je n=1:

| Interview-Modell | turns | dedupSlotCoverage | dialogNaturalness | potenzialCoverage |
|---|---|---|---|---|
| gemini-3.1-flash-lite | 17 | **0.94** | 0.67 | 1.0 |
| gemini-3.5-flash | 27 | 0.81 | 0.33 | 0.83 |
| claude-haiku-4-5 | 19 | **0.70** | 1.0 | 0.67 |

- **Spread existiert** (Range 0.24) → das Ranking ist nicht-degeneriert, die Stabilitätsprüfung wäre
  aussagekräftig. Der Vorabtest hat seinen Zweck erfüllt.
- **Kontraintuitive Richtung:** das billigste Modell (gemini-lite) rankt am besten auf der Gate-Kennzahl,
  das stärkste (haiku) am schlechtesten; `dialogNaturalness` läuft exakt gegenläufig. `dedupSlotCoverage`
  scheint ein knappes, effizientes Interview zu belohnen und ein längeres, natürlicheres zu bestrafen.
  n=1, verrauscht, aber ein echtes Signal — und ein **Metrik-Validitäts-Hinweis** (Kriterium A): ob
  `dedupSlotCoverage` das für das KI-Potenzial-Ziel Richtige misst, ist erneut zu prüfen, bevor ein
  Modell-Ranking daraus PROJ-41-Entscheidungen trägt.
- depth (`slotDepth`) ist im Live-Lauf `null` (erwartet — der Live-Runner rechnet den depth-Judge nicht,
  nur der Kalibrierungs-Harness auf fixierten Transkripten). Für das Ranking irrelevant.
- **Kostenfrei nachrüstbar bei Reaktivierung:** der Harness re-aggregiert aus denselben Transkripten,
  Stabilität lässt sich auf mehreren Kennzahlen rechnen (`STABILITY_QUALITY_KEY=dialogNaturalness` etc.)
  ohne Extra-Läufe — entschärft die Kennzahl-Richtungs-Frage.

Artefakte des Vorabtests: `docs/evals/interview/2026-07-03/*.transcript.json` (getaggt).

## Frage (Versuchsplan §6 Stufe 2)
Bleibt das Ranking der Interview-Modelle stabil, wenn (1) der Tester stärker wird und (2) der
Offenlegungs-Modus wechselt? Wenn nicht, ist der Tester/Modus Teil des Messfehlers und PROJ-41
kann dem Benchmark nicht trauen. Band je Kontrast: `pairAgreement ≥ 0.8` UND Top-Rang stabil.

## Versuchsdesign — 3-Zellen-Shared-Baseline
Zwei 2-stufige Kontraste, die sich eine Basiszelle teilen (spart ein Drittel der Läufe):

| Zelle | Tester | Disclosure-Modus | Rolle |
|---|---|---|---|
| C1 | schwach (`gemini-3.1-flash-lite`) | `withhold_numbers_only` (B) | Basis (in beiden Kontrasten) |
| C2 | stark (`claude-sonnet-4-5`) | `withhold_numbers_only` (B) | Tester-Stärke-Kontrast (C1 vs C2) |
| C3 | schwach (`gemini-3.1-flash-lite`) | `withhold_tools_and_numbers` (A) | Disclosure-Kontrast (C1 vs C3) |

Referenz-Modus = B, Referenz-Tester = schwach (matcht die Harness-Defaults
`TESTER_REFERENCE_MODE` / `TESTER_REFERENCE_TESTER`).

## Interview-Modell-Satz (das Gerankte) — ENTSCHEIDUNG offen
Vorschlag: 3 Modelle mit plausiblem Qualitäts-Spread → 3 Paare, nicht-degeneriertes Ranking:
`google/gemini-3.1-flash-lite` (Baseline) · `google/gemini-3.5-flash` (mittel) ·
`anthropic/claude-haiku-4-5` (stark).

**Risiko (Spread):** die Gate-Kennzahl `dedupSlotCoverage` liegt für gute Modelle eng beieinander
(gemini-lite bereits ~0.89). Falls die drei Modelle nicht klar streuen, misst „Ranking-Stabilität"
Rauschen statt Signal. Gegenmittel: ein bewusst schwaches viertes Modell aufnehmen, oder eine
trennschärfere Kennzahl wählen (`STABILITY_QUALITY_KEY`). Vor dem großen Lauf mit einer Mini-Charge
(1 Persona, 1 Run) prüfen, ob überhaupt ein Spread existiert.

## Sweep-Größe + Kosten — ENTSCHEIDUNG offen
Läufe gesamt = 3 Modelle × Personas × Runs × 3 Zellen. Kosten grob (getrackt Interview+Eval
~$0.15–0.35/Lauf je nach Interview-Modell; Tester-Bucket ungetrackt: schwach ~$0.02, Sonnet
~$0.10–0.15/Lauf, betrifft nur C2):

| Option | Personas × Runs | Läufe | Kosten grob | Zeit grob |
|---|---|---|---|---|
| Minimal | 1 × 2 | 18 | ~$5–8 | ~30–60 min |
| **Moderat (empfohlen)** | 3 × 2 | 54 | ~$14–24 | ~1.5–3 h |
| Voll | 3 × 3 | 81 | ~$21–36 | ~2.5–4 h |

Moderat: 3 Personas geben eine über-Persona-stabile Qualitätsschätzung je Modell, 2 Runs minimale
Replikation. Seed `42`, `--store pglite` (reproduzierbar, DB-frei).

## Ausführung (nach Freigabe)

**Preflight (Pflicht):** Keys für die 3 Interview-Modelle + beide Tester validieren:
```bash
EVAL_REFERENCE_JUDGE_MODELS="anthropic/claude-sonnet-4-5,anthropic/claude-haiku-4-5,google/gemini-3.5-flash" \
  npx tsx scripts/judge-preflight.ts
```

**Sweep (je Zelle ein Runner-Aufruf, Disclosure über Env → wird ins Tag geschrieben):**
```bash
MODELS="google/gemini-3.1-flash-lite,google/gemini-3.5-flash,anthropic/claude-haiku-4-5"
PERS="buchhalter,vertriebler,it-support"

# C1 — schwacher Tester, Modus B (Basis)
TESTER_MODEL=google/gemini-3.1-flash-lite TESTER_DISCLOSURE_MODE=withhold_numbers_only \
  npm run eval:interview -- --models "$MODELS" --personas "$PERS" --runs 2 --seed 42 --store pglite

# C2 — starker Tester, Modus B
TESTER_MODEL=anthropic/claude-sonnet-4-5 TESTER_DISCLOSURE_MODE=withhold_numbers_only \
  npm run eval:interview -- --models "$MODELS" --personas "$PERS" --runs 2 --seed 42 --store pglite

# C3 — schwacher Tester, Modus A
TESTER_MODEL=google/gemini-3.1-flash-lite TESTER_DISCLOSURE_MODE=withhold_tools_and_numbers \
  npm run eval:interview -- --models "$MODELS" --personas "$PERS" --runs 2 --seed 42 --store pglite
```

**Auswertung:**
```bash
npx tsx src/services/__evals__/interview/validation/testerStability.ts --dir docs/evals/interview/<datum>
```
Schreibt `tester-stabilitaet-<datum>.md` mit Zellen-Inventar + beiden Kontrasten + GO/NO-GO.

## Offene Entscheidungen (vor Ausführung)
1. **Interview-Modell-Satz** (3 wie vorgeschlagen? viertes schwaches Modell für klaren Spread?).
2. **Sweep-Größe** (Minimal / Moderat / Voll).
3. **Spread-Vorabtest** (empfohlen: Mini-Charge 1×1 vor dem großen Lauf).
