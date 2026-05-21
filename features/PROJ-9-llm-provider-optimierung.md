# PROJ-9: LLM Provider Optimierung

## Status: Roadmap
**Created:** 2026-05-20
**Last Updated:** 2026-05-21

## Dependencies
- Requires: PROJ-2 (Interview Engine Backend) — `INTERVIEW_MODEL` Env-Variable, `interviewAgent.ts`
- Requires: PROJ-4 (Extraktions-Agent) — `EXTRACTION_MODEL`, `extraction.ts`
- Requires: PROJ-5 (Prozessschritt-Anreicherung) — `ENRICHMENT_MODEL`, `processEnrichment.ts`

## Kontext

### Aktueller Stand (2026-05-21)

- **Shared Utility:** `src/lib/llm-provider.ts` — zentrale `resolveModel()`-Funktion für alle Services
- **Unterstützte Provider:** `anthropic`, `google` (Format: `provider/model-id`)
- **Fallback-Modell:** `google/gemini-3.1-flash-lite` (greift wenn Env-Var nicht gesetzt)
- **interviewAgent.ts:** BUG-002 behoben — liest `INTERVIEW_MODEL`, delegiert an `resolveModel()`
- **extraction.ts:** liest `EXTRACTION_MODEL`, delegiert an `resolveModel()`
- **processEnrichment.ts:** liest `ENRICHMENT_MODEL`, delegiert an `resolveModel()`
- **embeddings.ts:** separater Scope → PROJ-14

### Offene Punkte

- **Problem 1:** Rate-Limits auf dem kostenlosen Gemini-Tier blockieren parallele Test-Interviews.
- **Problem 2:** `gemini-3.1-flash-lite` ist zu schwach für produktionsreife Interview-Qualität.
- **Problem 3:** Für den ersten realen E2E-Test braucht es sofort eine kostenpflichtige Option.

### Datenschutz-Anforderung
**EU-Unternehmen bevorzugt** als Datenverarbeiter. Das schränkt die Direktnutzung chinesischer APIs (Kimi direkt, DeepSeek direkt) aus — diese verarbeiten Daten auf chinesischen Servern.

### Provider-Entscheidung nach Recherche (Mai 2026)

**Primär: Nebius AI** (Amsterdam, NL) — niederländisches Unternehmen, Rechenzentren EU (Finnland, NL), kein CLOUD Act Risiko. Hostet Kimi K2.6 und DeepSeek V4 Pro als Open-Weight-Modelle auf EU-Servern.

**Fallback: Fireworks AI** (Frankfurt-Datacenter, US-HQ) — explizite EU Data Residency, SOC 2 Type II + GDPR-konform, aber US-Muttergesellschaft (CLOUD Act theoretisch anwendbar). Aktivieren wenn Nebius für einen Task zu langsam oder zu teuer wird.

**Preisvergleich der relevanten Anbieter (blended $/1M Tokens):**

| Provider | EU-Fit | Kimi K2.6 | DeepSeek V4 Pro | Bemerkung |
|----------|--------|-----------|-----------------|-----------|
| **Nebius AI** | Stark (NL-Unternehmen) | $1.30 | $1.90 | Primärwahl: GDPR sauberste Option |
| **Fireworks** | Mittel (US, Frankfurt-DC) | $0.70 | $0.80 | Fallback: 45–58% günstiger |
| DeepInfra (FP4) | Unklar | $0.60 | $0.80 | EU-Status ungeklärt, nicht empfohlen |
| Kimi direkt | Ungeeignet (CN-Server) | $0.70 | — | GDPR-Verletzung |
| DeepSeek direkt | Ungeeignet (CN-Server) | — | $0.71 | GDPR-Verletzung |

**Warum Nebius trotz höherem Preis?**
Bei MVP-Skala (30 Interviews/Monat, ~60k Tokens/Interview) beträgt der absolute Mehrpreis gegenüber Fireworks ca. $1–2/Monat. Sobald Pilot-Kunden Unternehmensdaten einbringen, ist Nebius (kein US-Mutterkonzern, kein CLOUD Act) deutlich einfacher zu argumentieren. Der Preisaufschlag skaliert erst ab mehreren hundert Interviews spürbar — dann kann auf Fireworks gewechselt werden.

**Eigen AI (FP4):** Wurde Mai 2026 für $643M von Nebius übernommen. Infrastruktur wird in Nebius integriert; separat nicht mehr relevant.

### Kurzfristige Überbrückung (vor PROJ-9-Abschluss)
`gemini-3.5-flash` über Google AI Studio (kostenpflichtiger Plan) als Sofortmaßnahme — beseitigt Rate-Limit-Problem ohne Architektur-Änderung, bis Nebius-Integration fertig ist.

### Warum das wichtig ist

Das Interview ist der Kern-Use-Case. Qualität, Latenz und Kosten des LLM haben direkten Einfluss auf die Nutzbarkeit. Extraktion und Anreicherung laufen async — dort ist Latenz unkritisch, Kosten und Output-Qualität (JSON-Compliance) dagegen entscheidend.

## User Stories

- Als Entwickler möchte ich alle LLM-Provider per Env-Variable wechseln können ohne Code-Änderungen.
- Als Berater möchte ich, dass der Interview-Agent zuverlässig Tool Calls ausführt und qualitativ hochwertige Folgefragen stellt.
- Als Solo-Developer möchte ich die monatlichen LLM-Kosten unter einem sinnvollen Schwellenwert halten.

## Acceptance Criteria

### Research-Phase (muss vor Modell-Empfehlung abgeschlossen sein)

- [ ] Vergleich der Modelle anhand Interview-spezifischer Anforderungen:
  - Zuverlässige Tool Use / Function Calling (Phase-Transitions, update_topics)
  - Gesprächsqualität (natürliche Folgefragen, Paraphrasierung)
  - Latenz (Zeit bis erster SSE-Token < 3s)
  - Kosten ($/1M Tokens Input + Output)
  - Rate-Limits auf kostenpflichtigen Plänen
- [ ] Kandidaten Interview-Agent (Echtzeit, Tool Use): `kimi-k2.6` via Nebius, `gemini-3.5-flash`, `claude-sonnet-4-6`, `deepseek-v4-pro` via Nebius
- [ ] Kandidaten Extraktion/Anreicherung (async, JSON-Output): `deepseek-v4-flash` via Nebius, `gemini-3.5-flash`, `kimi-k2.6` via Nebius
- [ ] Getrennte Empfehlung für Interview-Agent vs. Extraction/Enrichment (unterschiedliche Anforderungen)
- [ ] Nebius als neuer Provider in `llm-provider.ts` evaluieren (OpenAI-kompatibler Endpoint)
- [ ] Empfehlung dokumentiert in diesem Spec

### Implementierung (bereits abgeschlossen)

- [x] `src/lib/llm-provider.ts` erstellt — exportiert `resolveModel(modelString?: string)`
- [x] Format: `provider/model-id` (z.B. `google/gemini-3.1-flash-lite`, `anthropic/claude-haiku-4-5`)
- [x] Fallback auf `google/gemini-3.1-flash-lite` wenn Env-Var nicht gesetzt
- [x] `interviewAgent.ts` — liest `INTERVIEW_MODEL`, nutzt `resolveModel()`
- [x] `extraction.ts` — liest `EXTRACTION_MODEL`, nutzt `resolveModel()`
- [x] `processEnrichment.ts` — liest `ENRICHMENT_MODEL`, nutzt `resolveModel()`

### Vercel-Konfiguration (durch User vorzunehmen)

- [ ] `INTERVIEW_MODEL` auf Vercel auf das empfohlene Interview-Modell setzen
- [ ] `EXTRACTION_MODEL` auf Vercel setzen (z.B. `google/gemini-3.1-flash-lite`)
- [ ] `ENRICHMENT_MODEL` auf Vercel setzen (z.B. `google/gemini-3.1-flash-lite`)
- [ ] `GOOGLE_GENERATIVE_AI_API_KEY` auf Vercel hinterlegt (falls nicht vorhanden)
- [ ] `.env.local.example` aktualisiert mit allen drei Env-Vars

### Kostenkontrolle

- [ ] Recherche: Welcher Plan (Free/Pro) ist für das empfohlene Modell sinnvoll?
- [ ] Optional: Token-Budget pro Turn via `maxOutputTokens` begrenzen

## Recherche-Notizen

### Empfehlung (Stand Mai 2026, nach Provider-Analyse)

| Task | Modell | Provider | Preis | Begründung |
|------|--------|----------|-------|------------|
| Interview-Agent (Echtzeit) | Kimi K2.6 | Nebius | $1.30/1M | EU-konform, TTFT ~2.85s, Intelligence Score 54 |
| Extraktion / Anreicherung (async) | DeepSeek V4 Pro | Nebius | $1.90/1M | EU-konform, Latenz unkritisch, starkes Reasoning |
| Fallback Interview-Agent | Kimi K2.6 | Fireworks | $0.70/1M | Bei Skalierung oder falls Nebius-Latenz unakzeptabel |
| Fallback Async | DeepSeek V4 Pro | Fireworks | $0.80/1M | Bei Skalierung |

### Offene Tool-Use-Validierung (vor Implementierung zu prüfen)

| Modell | Tool Use zuverlässig? | Quelle |
|--------|----------------------|--------|
| kimi-k2.6 | ? | Manuell testen: Phase-Transition Tool Calls |
| deepseek-v4-pro | ? | Manuell testen: JSON-Schema Compliance |

### Provider-Benchmarks (Artificial Analysis, Mai 2026)

| Modell | Provider | TTFT | Speed | Preis (blended) |
|--------|----------|------|-------|-----------------|
| Kimi K2.6 | Nebius | 25.81s E2E | 187 t/s | $1.30 |
| Kimi K2.6 | Fireworks | 22.94s E2E | 203 t/s | $0.70 |
| DeepSeek V4 Pro | Nebius | 110s E2E | 40 t/s | $1.90 |
| DeepSeek V4 Pro | Fireworks | 25.88s E2E | 176 t/s | $0.80 |

Hinweis: DeepSeek V4 Pro auf Nebius hat hohe E2E-Latenz (110s). Für async Extraktion irrelevant; für Echtzeit-Einsatz ungeeignet.

## Edge Cases

| Szenario | Erwartetes Verhalten |
|---|---|
| Env-Var enthält kein `/` (kein Provider-Prefix) | Legacy-Fallback: wird als Anthropic-Modell interpretiert |
| Env-Var enthält unbekannten Provider | `throw new Error(...)` beim App-Start |
| Gewählter Provider-Key nicht gesetzt | Klare Fehlermeldung beim ersten LLM-Call |
| Rate-Limit vom Provider erreicht | SSE `error`-Event; bestehender Retry-Mechanismus greift |

## Technical Requirements

- Routing-Logik ausschließlich in `src/lib/llm-provider.ts` — Services importieren nur `resolveModel()`
- Kein Einfluss auf Frontend-Code oder API-Routes
- Bestehende Unit-Tests müssen weiterhin laufen (Mocks auf `resolveModel` anpassen)

## Out of Scope

- Fireworks als dauerhafter Primär-Provider (Datenschutz-Kompromiss nicht akzeptiert)
- OpenAI als Provider für Text-Generation (würde `@ai-sdk/openai` Erweiterung in `llm-provider.ts` erfordern)
- Embedding-Modell-Wechsel (eigener Scope, nach PROJ-9)
- Mehrere LLM-Modelle parallel (Ensemble-Ansatz)
- Fine-Tuning auf Meridian-Daten
- Automatischer Modell-Fallback bei Fehler
- Kostentracking pro Interview in der DB
