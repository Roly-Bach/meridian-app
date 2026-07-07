# PROJ-41 Stage 1 — OSS-Modell-Screening: Ergebnis + Entscheidung

**Datum:** 2026-07-06/07
**Substrat:** OpenRouter (eval-only), Persona buchhalter, Seed 42, `--store pglite`, `--runs 2`
**Gate (runner.ts):** completion_correctness=true · dedupSlotCoverage≥0.75 · stepRegistrationCoverage≥0.8 · dialogNaturalness≥0.65 · blockedRate<0.1
**Referenz:** google/gemini-3.1-flash-lite (Score 25)

## Ergebnis

| Modell | Score | $/1M (in/out) | Status | dedup | dialog | stepReg | halluc | grounding | Kosten/Lauf |
|---|---|---|---|---|---|---|---|---|---|
| **deepseek-v4-pro** | 44 | 0.44/0.87 | ✅ PASS | 0.89 | 1.0 | 1.0 | 0 | 0 | ~$0.11 (21 Turns) |
| **minimax-m3** | 44 | 0.30/1.20 | ✅ PASS | 0.89 | 1.0 | 1.0 | 0 | 0 | ~$0.11 (19 Turns) |
| deepseek-v4-flash | 40 | 0.09/0.18 | ⚠️ marginal | 0.67–0.89 | 1.0 | 1.0 | 0 | 0–0.5 | — |
| glm-5.2 | 51 | 0.91/2.86 | ❌ infra | 0 | 1.0 | 0 | — | — | — |
| kimi-k2.6 | 43 | 0.66/3.41 | ❌ infra | — | — | — | — | — | — |
| mimo-v2.5-pro | 42 | 0.44/0.87 | ❌ infra | — | — | — | — | — | — |
| mimo-v2.5 | 40 | 0.11/0.28 | ❌ infra | — | — | — | — | — | — |

Weitere Metriken der zwei Finalisten (identisch stark): schemaConformanceRate 1.0, toolCallPlausibility 0.92–0.96, potenzialCoverage 1.0, phaseAdherence 1.0, depth_score 2.0. Beide deutlich über der Referenz gemini-lite (Score 25) bei vergleichbaren/niedrigeren Kosten.

## Substrat-Befund: OpenRouter-Instabilität

4 von 7 Kandidaten waren auf OpenRouter **nicht messbar** — keine Qualitätsfrage, sondern Verbindungsabbrüche:
- Erste Fehlerform: HTTP/2 `stream timeout after 300000` + `ECONNRESET` (`ClientHttp2Stream`), Interview crashte hart (rc=1, kein Aggregat).
- Nach dem H1-Fix (siehe unten): Fehler wandelte sich zu HTTP/1.1 `SocketError: other side closed` (`UND_ERR_SOCKET`). Der Lauf crasht nicht mehr (Retry fängt ab), kriecht aber — kimi-Smoke: 3 Turns in 40 Min bei 8 Socket-Fehlern, nicht messbar.
- Ursache liegt am gerouteten Backend: OpenRouter schickte diese Modelle zu **DeepInfra** (im rohen Response bestätigt), das die Verbindung für diese Reasoning-Modelle wiederholt kappt.
- glm-5.2 „überlebte" mit zerschossener Tool-Schleife (stepRegistrationCoverage=0), unfaire Nullmessung.

**Selbst die Finalisten waren nicht immun:** run2 von deepseek-v4-pro (11 Socket-Fehler) und minimax-m3 (2) degradierte, daher `run_count=1` je Aggregat. Sie routeten nur zu stabileren Backends und überlebten je 1 von 2 Läufen.

## H1-Fix (llm-provider.ts, openrouter-Zweig)

`allowH2: false` via undici-Agent + `Accept-Encoding: identity` (der custom Dispatcher umgeht sonst die Auto-Dekompression von `fetch` → „Invalid JSON response"). Wandelt den Hard-Crash in einen überlebbaren Socket-Fehler, löst aber die Backend-Instabilität nicht. Bleibt als Härtung im Code (openrouter ist eval-only).

## Entscheidung

**Shortlist für Stage 1 Pass B: deepseek-v4-pro + minimax-m3.**

Begründung:
- Beide erfüllen das Gate sauber und identisch stark, beide günstig, beide über EU-Inference-Provider verfügbar (relevant für Stage 1.5/2).
- Die 4 nicht-messbaren Modelle sind ohnehin unattraktiv: glm-5.2 (teuerstes, zeigte Code-Switching „Du mentioned"), kimi-k2.6 (teuer im Output $3.41), mimo-v2.5/pro (niedrigster Score + dokumentiertes Halluzinations-Risiko, PROJ-9). Der Grenznutzen weiteren Infra-Kampfs (Backend-Pinning) war negativ — Nutzer-Entscheidung 2026-07-07.
- deepseek-v4-flash (marginal) wird nicht in Pass B geführt: ein Lauf unter 0.75, plus Datenkontamination durch Altläufe.

## Konsequenz für Pass B

Die OpenRouter-Instabilität trifft auch die Finalisten (je 1/2 Läufe verloren). Pass B (3 Personas × 3 Läufe × Shortlist+Referenz) auf OpenRouter wird unzuverlässig. Zu erwägen vor Pass-B-Start: die eigentliche Prod-Route (dedizierter EU-Provider, Stage 1.5) früher ziehen und Pass B dort statt auf OpenRouter fahren, da Stage 2 ohnehin dort validiert.

## Artefakte

`docs/evals/interview/2026-07-06/` + `2026-07-07/`: run-/aggregate-/transcript-Files je Modell. Kontaminierte Altläufe (deepseek-v4-flash, minimax run1 39-Turn) aus abgebrochenen Parallel-Versuchen sind im Ordner, aber nicht Entscheidungsgrundlage.
