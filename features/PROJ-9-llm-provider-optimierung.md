# PROJ-9: LLM Provider Optimierung

## Status: Roadmap
**Created:** 2026-05-20
**Last Updated:** 2026-05-20

## Dependencies
- Requires: PROJ-2 (Interview Engine Backend) — `INTERVIEW_MODEL` Env-Variable, `interviewAgent.ts`

## Kontext

### Aktueller Stand

- **Produktiv-Modell:** `google/gemini-3.5-flash` (via `INTERVIEW_MODEL` auf Vercel)
- **Problem 1:** Das kostenlose Tier der Gemini-API stößt sehr schnell an Rate-Limits — praktisch nicht nutzbar für Tests mit mehreren parallelen Interviews.
- **Problem 2:** `gemini-3.1-flash-lite` ist merklich schwächer als `gemini-3.5-flash` — wenn das Modell gewechselt wird, muss das die richtige Variante sein.
- **Problem 3 (BUG-002 aus PROJ-2):** `interviewAgent.ts` hat den Anthropic-Provider hardcodiert (`createAnthropic`), obwohl die Architektur provider-agnostisch sein soll. Der `INTERVIEW_MODEL`-Env-Var steuert nur den Modellnamen, nicht den Provider.

### Warum das wichtig ist

Das Interview ist der Kern-Use-Case von Meridian. Qualität, Latenz und Kosten des LLM haben direkten Einfluss auf die Nutzbarkeit. Ein schwaches Modell führt zu schlechten Fragen und fehlenden Phase-Transitions. Hohe Kosten blockieren skalierbare Nutzung.

## User Stories

- Als Entwickler möchte ich den LLM-Provider per Env-Variable wechseln können ohne Code-Änderungen, damit ich schnell zwischen Modellen testen kann.
- Als Berater möchte ich, dass das Interview-Modell qualitativ hochwertige Folgefragen stellt und zuverlässig Tool Calls für Phase-Transitions ausführt.
- Als Solo-Developer möchte ich die monatlichen LLM-Kosten unter einem sinnvollen Schwellenwert halten, ohne Qualitätsverlust.

## Acceptance Criteria

### Research-Phase (muss vor Implementation abgeschlossen sein)

- [ ] Vergleich der folgenden Modelle anhand der Interview-spezifischen Anforderungen:
  - Zuverlässige Tool Use / Function Calling (Phase-Transitions, update_topics)
  - Gesprächsqualität (natürliche Folgefragen, Paraphrasierung)
  - Latenz (Zeit bis erster SSE-Token < 3s)
  - Kosten ($/1M Tokens Input + Output)
  - Rate-Limits auf kostenpflichtigen Plänen
- [ ] Kandidaten: `claude-haiku-4-5` (Anthropic), `gpt-4o-mini` (OpenAI), `gemini-2.0-flash` (Google), `gemini-1.5-flash` (Google), `claude-sonnet-4-6` (Anthropic)
- [ ] Empfehlung dokumentiert in diesem Spec

### Provider-Agnostische Implementierung (BUG-002 Fix)

- [ ] `interviewAgent.ts` implementiert echtes Provider-Routing basierend auf `INTERVIEW_MODEL` Env-Variable
- [ ] Format: `provider/model-name` (z.B. `anthropic/claude-haiku-4-5`, `openai/gpt-4o-mini`, `google/gemini-2.0-flash`)
- [ ] Provider wird aus dem Prefix geparst und das richtige AI-SDK-Paket geladen
- [ ] Fallback auf `anthropic/claude-haiku-4-5` wenn `INTERVIEW_MODEL` nicht gesetzt

### Vercel-Konfiguration

- [ ] `INTERVIEW_MODEL` auf Vercel auf das empfohlene Modell gesetzt
- [ ] Alle nötigen API-Keys als Vercel Env-Vars konfiguriert
- [ ] `.env.local.example` aktualisiert mit kommentiertem Beispiel für beide Szenarien (Standard + Test)

### Kostenkontrolle

- [ ] Recherche: Welcher Plan (Free/Pro) ist für das empfohlene Modell sinnvoll?
- [ ] Optional: Token-Budget pro Interview-Turn im System Prompt begrenzen (max_tokens Einstellung)

## Recherche-Notizen (zu füllen während Research-Phase)

| Modell | Tool Use | Qualität | Latenz | Kosten Input | Kosten Output | Rate Limit Free |
|--------|----------|----------|--------|-------------|--------------|-----------------|
| claude-haiku-4-5 | ? | ? | ? | ? | ? | ? |
| gemini-2.0-flash | ? | ? | ? | ? | ? | ? |
| gpt-4o-mini | ? | ? | ? | ? | ? | ? |
| claude-sonnet-4-6 | ? | ? | ? | ? | ? | ? |

## Edge Cases

| Szenario | Erwartetes Verhalten |
|---|---|
| `INTERVIEW_MODEL` enthält ungültiges Format | Fallback auf Standard-Modell + Fehler-Log |
| Gewählter Provider-Key nicht gesetzt | Klare Fehlermeldung beim App-Start, kein Runtime-Crash im Interview |
| Rate-Limit vom Provider erreicht | SSE `error`-Event; bestehender Retry-Mechanismus greift |

## Technical Requirements

- Änderungen ausschließlich in `src/services/interviewAgent.ts` und `.env.local.example`
- Kein Einfluss auf andere Services oder Frontend-Code
- Bestehende Unit-Tests müssen weiterhin laufen (Mocks anpassen falls nötig)

## Out of Scope

- Mehrere LLM-Modelle parallel (Ensemble-Ansatz)
- Fine-Tuning eines Modells auf Meridian-Daten
- Automatischer Modell-Fallback bei Fehler (wäre PROJ-11+)
- Kostentracking pro Interview in der DB
