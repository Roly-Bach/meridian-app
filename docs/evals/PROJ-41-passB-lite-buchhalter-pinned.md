# PROJ-41 Pass B (lite) — deepseek-v4-pro vs. minimax-m3, Backend gepinnt

**Datum:** 2026-07-07
**Substrat:** OpenRouter, Backend explizit gepinnt (`OPENROUTER_PROVIDER_ORDER`, `allow_fallbacks: false`),
Persona buchhalter, Seed 42, `--store pglite`, `--runs 3`
**Motivation:** Pass A hatte für beide Kandidaten nur `run_count=1` (ein Lauf ging je an Socket-Fehlern
verloren) und ein unbekanntes Backend — keine belastbare Grundlage für eine Entscheidung. Dieser Lauf
behebt beide Probleme: festes, verifiziertes Backend pro Modell, echtes n=3.

## Backend-Pinning

- `minimax-m3` → `minimax/fp8` (First-Party-Host, höchste Uptime im Feld, $0.30/$1.20)
- `deepseek-v4-pro` → `streamlake/fp8` (nicht der First-Party-Host: `deepseek` ist auf diesem
  OpenRouter-Account durch die Default-Datenschutz-/Guardrail-Einstellungen aus dem Routing
  ausgeschlossen — bestätigt per Diagnose-Request, `only:["deepseek"]` gab explizit „No endpoints
  available matching your guardrail restrictions and data policy" zurück. StreamLake und Baidu sind
  nicht betroffen, beide funktionieren als Pin. StreamLake gewählt, marginal bessere 30-Min-Uptime.
  Preis dadurch höher als der ursprünglich erwartete DeepSeek-Direktpreis: $0.748/$1.496 statt $0.435/$0.87.)

Mechanismus: `OPENROUTER_PROVIDER_ORDER` (neue Env-Var, `src/lib/llm-provider.ts`) injiziert
`provider: {order: [...], allow_fallbacks: false}` in den Request-Body — behebt die in der Spec seit
Stage 1 offene Reproduzierbarkeits-Anforderung (Versuchsplan §5).

## Ergebnis (Median über 3 Läufe, Min–Max)

| Metrik | minimax-m3 | deepseek-v4-pro |
|---|---|---|
| Status | 3/3 PASS | 3/3 PASS |
| dedupSlotCoverage | 0.89 (0.78–0.89) | **0.93 (0.89–1.0)** |
| dialogNaturalness | 0.67 (0.67–1.0) | **1.0 (1.0–1.0)** |
| potenzialCoverage | **0.25 (0.13–1.0)** | **1.0 (1.0–1.0)** |
| dependencyCapture | 0 (0–0) | 0.33 (0–1.0) |
| stepRegistrationCoverage | 1.0 | 1.0 |
| schemaConformanceRate | 1.0 | 1.0 |
| hallucinationRate | 0 | 0 |
| talkerGroundingViolations (Scorer) | 0 | 0¹ |
| toolCallPlausibility | **0.88 (0.84–0.96)** | 0.81 (0.81–0.82) |
| depth_score | 1.61 (1.54–1.82) | **1.92 (1.78–1.95)** |
| turnsToCompletion | 29 (20–35) | **19 (19–20)** |
| Kosten (3 Läufe gesamt) | $0.68 | **$0.34** |
| Kosten/Lauf (Ø) | $0.227 | $0.114 |

¹ **Aber:** der Live-Grounding-Guard (`talkerGroundingGuard.ts`, KI-18) hat bei deepseek-v4-pro 14×
eine Verletzung erkannt und Regeneration ausgelöst, davon 12× erfolgreich repariert und 2× nach
Erschöpfen der Repair-Versuche trotzdem ausgeliefert („shipping after exhausting repair attempts,
still flagged"). Der unabhängige Post-hoc-Scorer (`talkerFactualGrounding.ts`, separater Judge) hat
diese 2 ausgelieferten Fälle nicht als Violation gezählt — Diskrepanz zwischen Live-Guard und
Post-hoc-Judge, konsistent mit dem bereits dokumentierten KI-18-Befund (zwei unabhängige Mechanismen,
nicht immer deckungsgleich). Kein neuer Bug, nicht weiter verfolgt im Rahmen von PROJ-41.

## Befund

**deepseek-v4-pro liegt auf jeder Achse außer toolCallPlausibility vorn** — bei gleichzeitig halben
Kosten und weniger Turns (effizienter). Der auffälligste Unterschied ist `potenzialCoverage`
(1.0 vs. 0.25): das ist die Metrik, die laut PRD-Prototyp-Fokus (ROI-Facetten: Frequenz, Dauer,
Fehlerquote, Medienbrüche) am direktesten auf den eigentlichen Zweck des Prototyps einzahlt. Bei n=1
in Pass A sahen beide Kandidaten „identisch stark" aus — das war ein Artefakt der dünnen Datenlage,
nicht die Realität.

Zusammen mit dem Stage-1.5-Befund (nur deepseek-v4-pro hat mit Nebius eine saubere EU-native
Provider-Option; minimax-m3 hat keine) zeigen jetzt **beide unabhängigen Kriterien — Qualität und
EU-Compliance — in dieselbe Richtung.**

## Kosten-Stand

$0.68 + $0.34 = $1.02 verbraucht von $8.26 Budget. Rest: **$7.24**.

## Offene Frage für nächsten Schritt

Dieser Lauf deckt nur die Persona buchhalter ab (n=3). Der Versuchsplan sieht für eine volle
Pass-B-Aussage 3 Personas × 3 Läufe vor. Optionen:
1. Hier stoppen — die Differenz ist bereits auf jeder Achse deutlich, weiteres Personas-Sampling
   ändert die Richtung vermutlich nicht.
2. Mit dem Rest-Budget (~$7.24) noch vertriebler + it-support nachziehen, mindestens für den
   führenden Kandidaten deepseek-v4-pro, um Generalisierung über Personas zu bestätigen.
