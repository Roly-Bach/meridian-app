# PROJ-9: LLM Provider Optimierung

## Status: In Progress
**Created:** 2026-05-20
**Last Updated:** 2026-06-22
**Type:** Feature
**Domain:** Platform
**Extends:** —
**Appetite:** M
**Bugs:** —

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

- [x] Vergleich der Modelle anhand Interview-spezifischer Anforderungen:
  - Zuverlässige Tool Use / Function Calling (Phase-Transitions, update_topics)
  - Gesprächsqualität (natürliche Folgefragen, Paraphrasierung)
  - Latenz (Zeit bis erster SSE-Token < 3s)
  - Kosten ($/1M Tokens Input + Output)
  - Rate-Limits auf kostenpflichtigen Plänen
- [x] Kandidaten Interview-Agent (Echtzeit, Tool Use): `kimi-k2.6` via Nebius, `gemini-3.5-flash`, `claude-sonnet-4-6`, `deepseek-v4-pro` via Nebius
- [x] Kandidaten Extraktion/Anreicherung (async, JSON-Output): `deepseek-v4-flash` via Nebius, `gemini-3.5-flash`, `kimi-k2.6` via Nebius
- [x] Getrennte Empfehlung für Interview-Agent vs. Extraction/Enrichment (unterschiedliche Anforderungen)
- [x] Nebius als neuer Provider in `llm-provider.ts` evaluieren (OpenAI-kompatibler Endpoint) — Architektur-Entscheidung getroffen (siehe Tech Design unten), Implementierung selbst ist Backend-Scope
- [x] Empfehlung dokumentiert in diesem Spec — final übernommen 2026-06-22, kein Re-Validierungsbedarf trotz 1 Monat Alter (User-Entscheidung)

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

### Empfehlung (Stand Mai 2026, nach Benchmark-Auswertung)

#### Interview-Agent (Echtzeit, Tool Use)

| Prio | Modell | Provider | Preis | Begründung |
|------|--------|----------|-------|------------|
| #1 | Kimi K2.6 (Reasoning) | Nebius | $0.70/1M | τ²=95.9%, IFBench=76%, LCR=70% — ausgewogenstes Profil, EU-konform |
| #2 | DeepSeek V4 Flash (Max) | Nebius | $0.06/1M | τ²=95%, IFBench=79.2% (bester Wert aller Modelle), 12× günstiger als Kimi — Risiko: LCR=63% (schwächster, lange Interviews) und Omniscience=−23 (halluziniert bei Wissenslücken) |
| #3 | Gemini 3.5 Flash | Google AI | $1.31/1M | τ²=95.3%, IFBench=76%, APEX=47.1%, Omniscience=+23 — rundeste Bilanz inkl. Halluzinierungsvermeidung, teuerste Option |

#### Extraktion / Anreicherung (async)

> ⚠️ Änderung zur Vorversion: DeepSeek V4 Pro (Omniscience=−10) wird nicht mehr empfohlen — halluziniert mehr als er korrekt beantwortet.

| Prio | Modell | Provider | Preis | Begründung |
|------|--------|----------|-------|------------|
| #1 | Gemini 3.5 Flash | Google AI | $1.31/1M | Omniscience=+23 (beste erschwingliche Option), kein Halluzinierungsrisiko bei Prozessschritt-Extraktion |
| #2 | Claude Sonnet 4.6 | Anthropic | ~$3/1M | Omniscience=+12, LCR=70.7% (bester LCR unter Kandidaten), bereits integriert — kein neuer Provider nötig |
| #3 | Claude Opus 4.7 | Anthropic | ~$15/1M | Omniscience=+26 (Bestwert aller Modelle), für bulk async zu teuer; sinnvoll nur wenn Extraktionsqualität kritisch |

#### Fallbacks

| Task | Modell | Provider | Preis | Bedingung |
|------|--------|----------|-------|-----------|
| Interview-Agent | Kimi K2.6 | Fireworks | $0.70/1M | Bei Skalierung oder falls Nebius-Latenz unakzeptabel |
| Extraktion | Gemini 3.5 Flash | Google AI | ~$0.60/1M | Kein Fallback nötig — bereits günstigster Primärkandidat |

### Benchmark-Auswertung (Mai 2026, Quelle: artificialanalysis.ai)

#### τ²-Bench Telecom (Konversationsagent-Qualität, höher = besser)

| Modell | Score |
|--------|-------|
| DeepSeek V4 Pro (Max) | 96.2% |
| Kimi K2.6 (Reasoning) | 95.9% |
| Gemini 3.5 Flash | 95.3% |
| DeepSeek V4 Flash (Max) | 95.0% |
| GPT-5.5 (xhigh) | 93.9% |
| Kimi K2.6 | 93.9% |
| Claude Opus 4.7 (max) | 88.6% |
| GPT-5.5 (low) | 83.9% |
| Claude Sonnet 4.6 (max) | 75.7% |
| Claude 4.5 Haiku | 32.5% |
| Gemini 3.1 Flash-Lite Preview | 31.3% |

#### IFBench (Instruction Following, höher = besser)

| Modell | Score |
|--------|-------|
| DeepSeek V4 Flash (Max) | 79.2% |
| Gemini 3.1 Flash-Lite Preview | 77.2% |
| DeepSeek V4 Pro (Max) | 76.5% |
| Gemini 3.5 Flash | 76.3% |
| Kimi K2.6 | 76.0% |
| GPT-5.5 (xhigh) | 75.9% |
| GPT-5.5 (low) | 64.4% |
| Claude Opus 4.7 (max) | 58.6% |
| Claude Sonnet 4.6 (max) | 56.6% |
| Claude 4.5 Haiku | 54.3% |

#### APEX-Agents-AA (Langzeit-Agentic Tasks, höher = besser)

| Modell | Score |
|--------|-------|
| Gemini 3.5 Flash | 47.1% |
| GPT-5.5 (xhigh) | 37.7% |
| Claude Opus 4.6 (max) | 33.0% |
| Claude Sonnet 4.6 (max) | 28.0% |
| DeepSeek V4 Pro (Max) | 24.3% |
| Gemini 3.1 Flash-Lite Preview | 12.2% |

#### AA-LCR (Long Context Reasoning, höher = besser)

| Modell | Score |
|--------|-------|
| GPT-5.5 (xhigh) | 74.3% |
| GPT-5.5 (low) | 72.0% |
| Claude Sonnet 4.6 (max) | 70.7% |
| Claude 4.5 Haiku | 70.3% |
| Claude Opus 4.7 (max) | 70.3% |
| Kimi K2.6 | 69.7% |
| Gemini 3.5 Flash | 69.3% |
| DeepSeek V4 Pro (Max) | 66.3% |
| Gemini 3.1 Flash-Lite Preview | 65.3% |
| DeepSeek V4 Flash (Max) | 63.0% |

#### AA-Omniscience Index (Halluzinierungsvermeidung, Skala −100 bis +100, höher = besser)

| Modell | Score |
|--------|-------|
| Claude Opus 4.7 (max) | +26 |
| Gemini 3.5 Flash | +23 |
| GPT-5.5 (xhigh) | +20 |
| GPT-5.5 (low) | +15 |
| Claude Sonnet 4.6 (max) | +12 |
| Claude 4.5 Haiku | −4 |
| DeepSeek V4 Pro (Max) | −10 |
| Gemini 3.1 Flash-Lite Preview | −16 |
| DeepSeek V4 Flash (Max) | −23 |

### Offene Tool-Use-Validierung (vor Implementierung zu prüfen)

| Modell | Tool Use zuverlässig? | Quelle |
|--------|----------------------|--------|
| kimi-k2.6 | ? | Manuell testen: Phase-Transition Tool Calls |
| deepseek-v4-flash | ? | Manuell testen: Phase-Transition Tool Calls + Verhalten bei langen Interviews (LCR-Schwäche) |
| gemini-3.5-flash | ? | Manuell testen: JSON-Schema Compliance bei Extraktion |

### Evaluations-Benchmarks für Interview-Engine-Qualität (Artificial Analysis, Mai 2026)

Quelle: https://artificialanalysis.ai/evaluations

Beim Modellvergleich für die Interview-Engine sind folgende Benchmarks aussagekräftig:

**Primär (direkter Transfer auf Interview-Kontext):**

| Benchmark | Was er misst | Relevanz für Interview-Engine |
|-----------|-------------|-------------------------------|
| `τ²-Bench Telecom` | Multi-Turn-Dialog zwischen Agent und Nutzer zur Zielerreichung (Kundensupport-Simulation) | Stärkste Analogie: Agent muss Wissensextraktion durch natürliche Konversation erreichen |
| `IFBench` | Präzise Befolgung von Anweisungen (58 verifiable constraints) | Direkt relevant: Interview-Agent hat komplexes System-Prompt mit Phasenlogik, Fragestrategien, Abbruchbedingungen |

**Sekundär (mittelbar relevant):**

| Benchmark | Was er misst | Relevanz für Interview-Engine |
|-----------|-------------|-------------------------------|
| `APEX-Agents-AA` | Agenten in Professional-Service-Umgebungen, Langzeithorizont, Toolnutzung | Mehrphasiger Ablauf + Tool Calls (save_knowledge_object, phase transitions) |
| `AA-LCR` | Informationsextraktion aus 10k–100k Token Dokumenten | Gesprächsgedächtnis über langen Transcript, frühere Aussagen korrekt referenzieren |
| `AA-Omniscience` | Faktentreue und Halluzinierungsrate in wirtschaftlichen Kontexten | Wissensobjekt-Extraktion: kein Erfinden von Prozessschritten die nicht genannt wurden |

**Nicht geeignet:** MATH-500, AIME, SciCode, LiveCodeBench, GPQA Diamond, MMLU-Pro — zu weit vom Konversationsagenten-Kontext entfernt.

**Nutzungshinweis:** Diese Benchmarks eignen sich als Vorfilter beim Modellwechsel (z.B. Kimi K2.6 vs. Alternativen). Sie ersetzen nicht die eigenen Evals (`src/services/__evals__/`) — die bleiben die einzige verlässliche Quelle für Interview-Engine-Qualität auf Meridian-spezifischen Szenarien.

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

## Tech Design (Solution Architect)

### Was gebaut wird

Reines Backend-/Konfigurations-Feature — keine UI, keine neue Seite, kein neuer Nutzer-Flow. Alle 9 Stellen im Code, die aktuell ein LLM aufrufen (Interview-Agent, Extraktion, Anreicherung, PDF-Report, Use-Case-Insights, …), rufen bereits eine einzige zentrale Weiche auf (`resolveModel()`) und kennen den Provider dahinter nicht. Dieses Feature erweitert nur diese eine Weiche um zwei neue Ziele — alle 9 Aufrufer bleiben unverändert.

```
Service ruft auf:           resolveModel("nebius/kimi-k2.6-reasoning")
                                      │
                                      ▼
                          ┌─ zentrale Weiche (llm-provider.ts) ─┐
                          │  anthropic/...   → bestehend          │
                          │  google/...      → bestehend          │
                          │  nebius/...      → NEU                │
                          │  fireworks/...   → NEU (manueller     │
                          │                     Fallback-Pfad)    │
                          └────────────────────────────────────────┘
```

### Komponenten-Struktur

Kein UI-Komponentenbaum — dieses Feature hat keine sichtbare Oberfläche. Betroffen ist ausschließlich die Service-Schicht (`src/services/*` → `src/lib/llm-provider.ts`).

### Datenmodell

Keine neuen Datenbank-Tabellen, keine Schema-Änderung. Die drei bestehenden Konfigurationswerte (`INTERVIEW_MODEL`, `EXTRACTION_MODEL`, `ENRICHMENT_MODEL`) bekommen nur neue Inhalte — das Format `provider/modell-id` bleibt exakt wie es ist.

### Modell-Zuweisung (aus der Recherche oben)

| Konfigurationswert | Neuer Inhalt | Grund |
|---|---|---|
| `INTERVIEW_MODEL` | `nebius/kimi-k2.6-reasoning` | Bestes Profil für Echtzeit-Gespräch mit Tool Use, EU-Datenverarbeiter |
| `EXTRACTION_MODEL` | `google/gemini-3.5-flash` | Bereits unterstützter Provider, nur neuer Modellname — kein Code-Risiko |
| `ENRICHMENT_MODEL` | `google/gemini-3.5-flash` | Gleiche Begründung wie Extraktion |

**Manueller Ausweichpfad (kein Auto-Failover, bewusst — siehe Out of Scope):** Falls Nebius im Betrieb zu langsam oder zu teuer wird, ändert der Betreiber `INTERVIEW_MODEL` von Hand auf `fireworks/kimi-k2.6`. Beide Werte existieren parallel als gültige Konfiguration, es gibt keine automatische Umschaltung.

### Tech-Entscheidungen

| Entscheidung | Begründung |
|---|---|
| Nebius/Fireworks über die Bibliothek anbinden, die schon als Abhängigkeit im Projekt eingetragen ist, aber noch nirgends aktiv verwendet wird (kein neues Package) | Beide bieten eine zu OpenAI kompatible Schnittstelle an — dieselbe Bibliothek kann auf eine andere Adresse als die von OpenAI selbst zeigen. Das ist eine Verkabelungs-Frage, kein "OpenAI als Modell-Anbieter" im Sinne des Out-of-Scope-Punkts oben. **Korrektur gegenüber erster Annahme:** Die Bibliothek wird *nicht* schon für Embeddings benutzt — dort wurde sie bewusst umgangen (eigener Direkt-`fetch`), weil Jinas Embedding-Antwortformat an der strikten Schema-Validierung der Bibliothek scheiterte. Für Chat-Antworten (was hier gebraucht wird) ist das Risiko geringer, aber nicht null — siehe Risiken unten |
| Zwei getrennte neue Ziele (`nebius/...`, `fireworks/...`) statt einem gemeinsamen | Beide haben unterschiedliche Adressen und unterschiedliche Zugangsschlüssel — getrennt zu halten macht den Ausweichpfad eindeutig nachvollziehbar |
| Kein automatischer Fallback bei Fehler | Bewusste Spec-Entscheidung (Out of Scope) — bei einer Person als Betreiber ist eine stille Umschaltung schwerer zu durchschauen als ein expliziter, sichtbarer Eingriff |
| Tool-Use-Verlässlichkeit vor Rollout manuell prüfen, nicht automatisiert | Es gibt noch keinen bestehenden automatisierten Test dafür; der vorhandene Eval-Lauf (`/eval-interview`) deckt das im selben Zug ab, sobald die Umstellung steht |

### Abhängigkeiten (Pakete)

Keine neuen Pakete. Die Bibliothek für die Anbindung ist bereits als Abhängigkeit installiert, wurde bisher aber im Code nirgends aufgerufen — dieses Feature ist ihre erste tatsächliche Verwendung.

### Neue Konfigurationswerte (Secrets)

Zwei neue Zugangsschlüssel nötig, analog zu den bestehenden Provider-Schlüsseln: einer für Nebius, einer für Fireworks (auch wenn Fireworks nur als Ausweichpfad gedacht ist — der Schlüssel muss vorhanden sein, bevor er im Notfall gebraucht wird).

### Risiken

- Nebius ist ein neuer, bisher ungetesteter Anbieter für dieses Projekt — die Tool-Use-Zuverlässigkeit (Phase-Übergänge, `update_topics`) ist laut Recherche oben noch nicht real validiert, nur anhand von Benchmark-Zahlen eingeschätzt. Vor Produktiv-Umstellung: manueller Testlauf Pflicht.
- Höhere Latenz als die bisherige Übergangslösung ist möglich (Benchmark zeigt 187 t/s bei Nebius vs. teilweise schnellere Werte bei Fireworks) — bei spürbarer Verschlechterung greift der manuelle Ausweichpfad.

## Implementation Notes (2026-06-22, /backend)

**Code-Änderung (abgeschlossen):**
- `src/lib/llm-provider.ts`: zwei neue Branches `nebius` und `fireworks`, beide über `createOpenAI({ apiKey, baseURL }).chat(modelId)` — **wichtig:** der direkte Provider-Aufruf `provider(modelId)` (wie bei den 2 anderen Anbietern) würde stattdessen OpenAIs proprietäre Responses-API ansteuern, die Drittanbieter-Endpoints nicht implementieren. `.chat(modelId)` ist für OpenAI-kompatible Drittanbieter zwingend.
- Base-URLs recherchiert (Web-Suche, nicht aus Trainingsdaten übernommen, da bekannt veraltungsanfällig): `https://api.tokenfactory.nebius.com/v1` (Nebius — Produkt seit Spec-Erstellung von "Nebius AI Studio" zu "Nebius Token Factory" umbenannt, gleiche Firma/EU-Datenschutz-Lage, andere URL als ursprünglich angenommen), `https://api.fireworks.ai/inference/v1` (Fireworks, unverändert).
- 7 neue Unit-Tests in `src/lib/llm-provider.test.ts` (vorher keine dedizierte Testdatei für `resolveModel` — andere Tests mocken die Funktion statt sie zu testen). Deckt alle 4 Provider + Legacy-Fallback + Default + Error-Fall ab.
- `.env.local.example`: `NEBIUS_API_KEY`, `FIREWORKS_API_KEY` dokumentiert.
- `npm test`: 637/638 grün (7 neu), `npm run build` clean.

**Korrektur der Tech-Design-Annahme:** Ursprünglich stand hier, die Bibliothek (`@ai-sdk/openai`) sei "schon für Embeddings genutzt" — falsch. Sie ist zwar als Dependency installiert, wird in `embeddings.ts` aber bewusst *nicht* verwendet (Kommentar dort: Jinas Embedding-Antwortformat scheiterte an der strikten Schema-Validierung der Bibliothek, Direkt-`fetch` als Workaround). Für Chat-Completions (dieser Use Case) ist das Risiko ähnlicher Schema-Inkompatibilitäten geringer, aber nicht ausgeschlossen — fließt in die Tool-Use-Validierung unten ein.

**Bewusst NICHT gemacht (braucht echte Zugangsdaten + explizite Freigabe, kein Code-Blocker):**
- `INTERVIEW_MODEL` weder lokal noch auf Vercel auf `nebius/...` umgestellt — kein echter `NEBIUS_API_KEY` vorhanden, Umstellung ohne reale Validierung wäre nur Theater.
- Manuelle Tool-Use-Validierung (Phase-Transition Tool Calls gegen echte Nebius-API) nicht durchgeführt — braucht echten Schlüssel.
- Vercel-Env-Vars nicht gesetzt (Approval-Gate: Env-Var-Änderung in Produktion).

**Nächster Schritt vor Produktiv-Nutzung:** Echten `NEBIUS_API_KEY` beschaffen (https://tokenfactory.nebius.com) → lokal gegen reale API testen (insb. Tool Use) → `/eval-interview` mit `INTERVIEW_MODEL=nebius/<aktuelles-modell-id>` laufen lassen → erst danach Vercel-Env-Var-Änderung mit Freigabe.
