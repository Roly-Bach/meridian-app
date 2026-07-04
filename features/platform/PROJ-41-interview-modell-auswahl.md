# PROJ-41: Interview-Modell-Auswahl (OSS-Screening + EU-Prod-Route)

## Status: In Progress
**Type:** Revision
**Domain:** Platform
**Extends:** PROJ-9
**Appetite:** L
**Bugs:** —
**Created:** 2026-07-02
**Last Updated:** 2026-07-04 (Stage-1-Code gebaut, keys-frei: openrouter-Provider, MODEL_PRICING der 7 Modelle, GUARD_JUDGE_MODEL + Familie-Assert)

## Dependencies
- Requires: PROJ-40 (Eval-Instrument-Validierung + Versuchsplan) — Stufe 1 + Stufe 2 PASS sind hartes Gate vor Stage 1 Screening (ADR-020 §7 Gating, Versuchsplan Kriterium F)
- Requires: PROJ-9 (LLM Provider Optimierung) — `llm-provider.ts` mit `resolveModel()`, Kandidatenliste, EU-Compliance-Analyse
- Requires: PROJ-2 (Interview Engine Backend) — `INTERVIEW_MODEL`-Env, `interviewAgent.ts`

## Kontext

PROJ-9 hat die Provider-Architektur (llm-provider.ts), die EU-Compliance-Anforderung und eine erste
Kandidaten-Shortlist für das Interview-Modell etabliert. PROJ-40 hat das Eval-Instrument validiert.
PROJ-41 führt den eigentlichen Modellvergleich durch und setzt das Ergebnis in Produktion — inklusive
EU-konformer Provider-Infra und EU-konformem Prod-Guard-Judge (ADR-020 D2, D5).

Der Versuchsplan liegt fertig in `docs/evals/versuchsplan-modell-benchmarking.md` und bindet dieses
Feature: Faktoren, Schwellen, Entscheidungsregeln und das Gating-Kriterium F sind dort festgeschrieben.

## User Stories

- Als KI-Berater möchte ich, dass das Interview-System auf einem EU-konformen Provider läuft, damit
  ich es bedenkenlos bei deutschen Unternehmenskunden einsetzen kann.
- Als Entwickler möchte ich das Interview-Modell via `INTERVIEW_MODEL`-Env wechseln können, ohne Code
  zu ändern — und der nach dem Screening gewählte EU-Inference-Provider muss dafür in `llm-provider.ts` registriert sein.
- Als Solo-Developer möchte ich die monatlichen LLM-Kosten senken, ohne Interview-Qualität messbar zu
  verschlechtern — das Screening liefert die Datengrundlage für diese Entscheidung.
- Als Entwickler möchte ich, dass der Prod-Guard-Judge nach dem Modellwechsel EU-konform und
  bias-frei bleibt (kein Modell bewertet seine eigene Ausgabe).
- Als Entwickler möchte ich nach Abschluss eine dokumentierte Entscheidung haben, welches Modell
  in Produktion geht und warum — nachvollziehbar für Audit und spätere Revisionen.

## Acceptance Criteria

### Hartes Gate (vor Stage 1)
- [x] PROJ-40 Stufe 1 UND Stufe 2 haben ein dokumentiertes Go-Verdikt — kein Screening ohne dieses Gate → beide GO (Stufe 1 2026-07-02, Stufe 2 2026-07-03).

### Kandidaten-Satz (Stage 1)

7 Open-Weight-Modelle nach Intelligence-Score, gegen die **Referenz** `google/gemini-3.1-flash-lite`
(Score 25, ~$0.22/1M). Alle 7 auf OpenRouter verfügbar (Recherche 2026-07-04):

| # | Modell | Kontext | Score | ~$/1M (Ref-Liste) |
|---|---|---|---|---|
| 1 | GLM-5.2 | 1M | 51 | 0.90 |
| 2 | MiniMax-M3 | 1M | 44 | 0.22 |
| 3 | DeepSeek V4 Pro | 1M | 44 | 0.18 |
| 4 | Kimi K2.6 | 256K | 43 | 0.70 |
| 5 | MiMo-V2.5-Pro | 1M | 42 | 0.18 |
| 6 | DeepSeek V4 Flash | 1M | 40 | 0.06 |
| 7 | MiMo-V2.5 | 1M | 40 | 0.06 |

Exakte OpenRouter-Slugs + reale Preise weichen je Backend ab (z.B. GLM-5.2 $0.90 vs. $1.40 input je
Quelle) und werden beim Stage-1-Bau direkt aus OpenRouter gepinnt, nicht aus dieser Liste.

### Stage 1 — Screening via OpenRouter (getiert)

- [x] `openrouter`-Provider in `llm-provider.ts` verfügbar (eval-only, Format `openrouter/<vendor>/<modell>`) — 2026-07-04, OpenAI-kompatibel via `.chat()`, Test in `llm-provider.test.ts`
- [x] `OPENROUTER_API_KEY` in `.env.local.example` dokumentiert (eval-only, kein Prod-Env) — 2026-07-04, mit Pin-Hinweis + „nie auf Vercel"
- [ ] Reproduzierbarkeit: OpenRouter je Kandidat auf ein festes Backend gepinnt (Routing-Präferenz), sonst untergräbt Backend-Varianz Seed 42 — Run-Konfig, vor Stage-1-Ausführung zu fixieren (Anleitung in `.env.local.example`)
- [ ] **Pass A (Vorfilter):** alle 7 × 1 Persona × 2 Läufe (Seed 42, pglite) → Shortlist Top 2–3 nach Gate-Pass + Diskriminatoren
- [ ] **Pass B (voll):** Shortlist + Referenz × 3 Personas × 3 Läufe, Versuchsplan strikt (Seed 42, `--store pglite`, MAX_TURNS=35)
- [ ] Aggregate-Reports je Kandidat × Persona vorhanden (`docs/evals/` Artefakte)
- [ ] Finalist per Entscheidungsregel §7 (Gate-Pass + Nicht-Unterlegenheit + Kosten, Ranking über mehrere Kennzahlen) + eingefalteter Sonnet-Tester-Spot-Check (PROJ-40 Stufe 2) dokumentiert
- [ ] Entscheidungs-Dokument schriftlich: Kandidat, Gate-Ergebnis, Kosten-Vergleich ($/Run nach Bucket), Begründung

### Stage 1.5 — Inference-Provider-Recherche (nach Screening, vor Verifikation)

Der Prod-Inference-Provider wird erst gewählt, wenn der Finalist feststeht — nicht vorab auf Nebius festgelegt.

- [ ] Für den Finalisten geeignete Inference-Provider recherchiert auf: EU-Datenresidenz (ADR-020 D1), Modell-Abdeckung (hostet er den Finalisten?), Kosten $/1M, Latenz/TTFT, Reife/SLA
- [ ] Kandidaten-Provider verglichen — Nebius ist EINE Option (EU-stark, aber vermutlich teurer + dünnere Abdeckung); Fireworks, DeepInfra o.a. als Alternativen
- [ ] Provider-Wahl dokumentiert mit Begründung (EU-Fit vs. Kosten vs. Abdeckung vs. Latenz)

### Stage 2 — Prod-Verifikation auf gewähltem Backend

- [ ] Gewählter Provider in `llm-provider.ts` verfügbar (`<provider>/<modell-id>`, `<PROVIDER>_API_KEY`)
- [ ] Finalist auf der Prod-Route erneut evaluiert: 3 Personas × 3 Läufe, sonst gleiche Parameter wie Stage 1 Pass B
- [ ] Latenz/TTFT pro Turn gemessen — Stage-2-spezifisch (echter Netz-Call, nicht pglite-synthetisch), TTFT-Zielwert < 3s (aus PROJ-9)
- [ ] Go/No-Go dokumentiert: Stage-2-Gate-Metriken ≥ Stage-1-Pass-B-Werte (kein Rückschritt durch Quantisierung/Sampling/Backend-Differenz), TTFT-Ziel erfüllt
- [ ] Falls Finalist Stage 2 nicht besteht: nächster Shortlist-Kandidat wird verifiziert; falls alle scheitern: Baseline bleibt, Entscheidung dokumentiert

### Provider-Infra

- [x] `llm-provider.ts`: `openrouter` (eval-only) ergänzt — 2026-07-04. Der in Stage 1.5 gewählte Prod-Provider folgt dort; `nebius`/`fireworks` existieren bereits (PROJ-9).
- [x] Fehler bei fehlendem API-Key: kein stiller Fallback auf ein anderes Modell — `resolveModel` konstruiert den Client, der Call schlägt hart mit Auth-Fehler des Provider-SDK fehl; unbekannter Provider wirft mit klarer Meldung (Test vorhanden)
- [ ] Key des gewählten Prod-Providers in `.env.local.example` dokumentiert (Prod-Env) — pending Stage 1.5 (Provider noch offen)
- [~] `MODEL_PRICING`-Einträge: **7/7 Screening-Modelle** (OpenRouter, gepinnte reale Preise) ergänzt 2026-07-04 (Katalog-Stand OpenRouter, `input_cache_read`/prompt/completion); Finalist-Eintrag auf Prod-Provider folgt Stage 2 (ADR-020 D4)

### D2 — Prod-Guard EU-Judge (ADR-020)

- [x] `talkerGroundingGuard.ts` nicht mehr hardcoded Gemini/Anthropic, sondern via `GUARD_JUDGE_MODEL`-Env konfigurierbar (`resolveGuardJudgeModel`) — 2026-07-04; Cross-Vendor-Default bleibt als Dev/Eval-Fallback
- [ ] Default für EU-Route: `<gewählter-Provider>/<andere-familie-als-talker>` — Mechanismus fertig, konkreter EU-Wert erst nach Provider-Wahl in Stage 1.5
- [x] Constraint dokumentiert und per Assert geprüft: Guard-Judge-Familie ≠ Talker-Familie — `modelFamily` + `assertGuardFamilyDiffersFromTalker`, hard fail außerhalb des Judge-try/catch (nicht als no-violation geschluckt); Tests vorhanden
- [x] `GUARD_JUDGE_MODEL` in `.env.local.example` dokumentiert — 2026-07-04

### Extraction/Enrichment (keine Screening-Läufe)

- [ ] `EXTRACTION_MODEL` auf Vercel auf `google/gemini-3.5-flash` gesetzt (PROJ-9-Empfehlung, Omniscience +23)
- [ ] `ENRICHMENT_MODEL` auf Vercel auf `google/gemini-3.5-flash` gesetzt
- [ ] `GOOGLE_GENERATIVE_AI_API_KEY` auf Vercel hinterlegt (falls nicht vorhanden)

### Vercel-Produktion

- [ ] `INTERVIEW_MODEL` auf Vercel auf den Finalist (Stage-2-validiertes Modell) gesetzt
- [ ] API-Key des gewählten Prod-Providers auf Vercel hinterlegt
- [ ] `GUARD_JUDGE_MODEL` auf Vercel gesetzt (EU-konformer Guard-Judge für Prod-Guard)

### Entscheidungs-Dokumentation

- [ ] Spec (dieses Dokument) wird um die finale Modellwahl + Begründung ergänzt nach Stage-2-Abschluss
- [ ] ADR-020 bekommt einen PROJ-41-Nachtrag mit Stage-1/2-Ergebnis und Entscheidung

## Edge Cases

- **OpenRouter Key fehlt bei Stage 1:** hartes Eval-Fail mit Fehlermeldung, kein stiller Fallback — verhindert, dass ein Kandidat auf dem falschen Provider gemessen wird
- **Prod-Provider transienter Fehler bei Stage 2:** bestehende `withRetry()`-Logik (KI-11) greift; TTFT-Messung zählt Wall-Clock (inkl. Retry), repräsentiert echte Prod-Latenz
- **Guard-Judge-Modell nicht erreichbar:** Interview schlägt fehl (kein stiller Fallback) — der Prod-Guard muss immer laufen, Degradation auf "kein Guard" ist kein akzeptierter Zustand
- **Finalist besteht Stage 2 Gate-Metriken nicht** (Rückschritt durch Quantisierung/Backend auf dem gewählten Provider): nächster Shortlist-Kandidat; falls alle scheitern: Baseline (`gemini-3.1-flash-lite`) bleibt, Entscheidung dokumentiert
- **Kein Provider hostet den Finalisten EU-konform/bezahlbar (Stage 1.5):** nächster Shortlist-Kandidat, dessen Provider-Lage besser ist; im Zweifel Baseline behalten und dokumentieren
- **Alle 7 Kandidaten scheitern Stage 1:** kein Wechsel, Baseline bleibt, Erkenntnisse für zukünftige Kandidaten-Recherche festgehalten
- **TTFT-Ziel knapp verfehlt (3–4s):** User-Entscheidung ob akzeptabel (kein Auto-Reject) — Entscheidungsregel §7 erlaubt Abwägung
- **Guard-Judge-Familie = Talker-Familie durch Fehlkonfiguration:** Assert fängt das bei Start, hartes Fail
- **Prod-Modell-ID ändert sich nach Deployment:** Fehler bricht den Call, kein stiller Fallback — Env-Var-Update nötig

## Technical Requirements

- **EU-Compliance:** Talker (Interview-Rolle) UND Guard-Judge müssen auf EU-gehosteten Providern laufen (ADR-020 D1). Extraction/Enrichment hat keine EU-Pflicht (async, Gemini bleibt). Screening (Stage 1) ist eval-only → EU-frei (ADR-020 D1), OpenRouter zulässig.
- **Stage 2 TTFT:** < 3s Zeit bis erster Token (echter Netz-Call gegen den in Stage 1.5 gewählten Prod-Endpoint)
- **Model Pricing vollständig:** alle 7 Screening-Modelle (OpenRouter) + der Finalist auf dem gewählten Prod-Provider mit realen $/Token-Werten in `MODEL_PRICING` (ADR-020 D4), kein Fallback auf Gemini-Lite-Preis
- **OpenRouter:** ausschließlich eval-only — nicht in Prod konfigurierbar, kein Prod-Env-Eintrag; je Kandidat auf ein festes Backend gepinnt (Reproduzierbarkeit unter Seed 42)
- **Versuchsplan-Bindung:** Stage 1 folgt dem festgeschriebenen Versuchsplan (Seed 42, pglite, Personas buchhalter/vertriebler/it-support, Entscheidungsregel §7). Einzige gebilligte Abweichung: die getierte Screening-Struktur (Pass A Vorfilter → Pass B voll), im Versuchsplan §5 festgeschrieben.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Erstellt 2026-07-04, revidiert 2026-07-04 nach Nutzer-Korrektur: (1) **7 Kandidaten** statt 3,
> (2) **Provider erst nach Screening** wählen (Nebius nicht vorausgesetzt), (3) Versuchsplan
> angeglichen. Screening-Route (Nutzer-Entscheid): **OpenRouter** als eval-only Aggregator. Baut auf
> PROJ-9 (Provider-Layer, EU-Analyse) und PROJ-40 (validiertes Eval-Instrument, Stufe 1+2 GO).

### Überblick — was gebaut wird

Kein UI, kein DB-Schema, kein Nutzer-Flow. Reines Infra-/Konfig-Feature in vier Bausteinen plus ein
**dreistufiger** Mess- und Entscheidungs-Prozess:

1. **Provider-Erweiterung** — OpenRouter als eval-only Aggregator (fürs Screening aller 7 Kandidaten,
   inkl. der Modelle, die einzelne Prod-Provider nicht hosten). Der Prod-Provider wird erst nach dem
   Screening gewählt, nicht vorab.
2. **Kosten-Modell** — reale Preise für die 7 Screening-Modelle + den Finalisten eintragen (kein stiller Fallback).
3. **Prod-Guard EU-tauglich** — der Faktentreue-Wächter darf nach dem Modellwechsel nicht mehr fest auf
   Anthropic/Google verdrahtet sein, sondern konfigurierbar + EU-konform (Familie ≠ Talker).
4. **Umgebungs-Konfiguration** — API-Keys + Modell-Wahl lokal (eval) und auf Vercel (prod).

Ablauf: **Stage 1 Screening (getiert)** → **Stage 1.5 Provider-Recherche** → **Stage 2 Verifikation** → Modellwahl.

### A) Modul-/Konfig-Struktur (was sich ändert)

```
PROJ-41
├── Provider-Layer (src/lib/llm-provider.ts)
│   └── + openrouter (eval-only, OpenAI-kompatibler Endpoint — Muster wie nebius/fireworks)
│       Prod-Provider aus Stage 1.5; nebius/fireworks existieren (PROJ-9), sind Kandidaten
├── Kosten-Modell (MODEL_PRICING, scorers/costSummary.ts)
│   └── + Einträge für die 7 Screening-Modelle (OpenRouter, gepinnte reale Preise)
│       + Finalist auf gewähltem Prod-Provider; fehlender Eintrag warnt/failt (PROJ-40 B)
├── Prod-Guard (src/services/talkerGroundingGuard.ts)
│   └── crossVendorJudgeModel() → GUARD_JUDGE_MODEL-Env; Default = <prod-provider>/<andere-Familie>
│       Assert: Guard-Familie ≠ Talker-Familie (nie Selbstbewertung)
├── Umgebung (.env.local.example + Vercel)
│   └── + OPENROUTER_API_KEY (eval-only), <PROD-PROVIDER>_API_KEY, GUARD_JUDGE_MODEL
│       Vercel: INTERVIEW_MODEL=Finalist, EXTRACTION_MODEL/ENRICHMENT_MODEL=google/gemini-3.5-flash
└── Dokumente
    ├── Stage-1/1.5/2 Reports (docs/evals/) + Provider-Recherche + Entscheidungs-Dokument
    └── ADR-020 PROJ-41-Nachtrag (Ergebnis + Modell- + Provider-Wahl)
```

### B) Konfig-Modell (Klartext, keine Geheimnisse im Repo)

**Modell-Kennungen** (als Format, nicht als Code):
- Screening (eval): `openrouter/<vendor>/<modell>` — ein Aggregator-String je Kandidat, Backend gepinnt.
- Prod: `<gewählter-provider>/<modell-id>` — erst nach Stage 1.5 bekannt.
- Referenz (Vergleich): `google/gemini-3.1-flash-lite` (unverändert, Score 25).

**Kandidaten Stage 1** — 7 Open-Weight-Modelle (Score/~$ s. Kandidaten-Satz oben): GLM-5.2, MiniMax-M3,
DeepSeek V4 Pro, Kimi K2.6, MiMo-V2.5-Pro, DeepSeek V4 Flash, MiMo-V2.5. Alle auf OpenRouter verfügbar
(Recherche 2026-07-04); exakte Slugs + reale Preise werden beim Bau gepinnt.

**Umgebungs-Variablen:**
| Variable | Wo | Zweck |
|---|---|---|
| `OPENROUTER_API_KEY` | nur lokal (.env.local) | Stage-1-Screening; NIE auf Vercel/Prod |
| `<PROD-PROVIDER>_API_KEY` | lokal + Vercel | Stage-2 + Prod-Interview + Prod-Guard (Provider aus Stage 1.5) |
| `GUARD_JUDGE_MODEL` | lokal + Vercel | EU-konformer Faktentreue-Wächter, Familie ≠ Talker |
| `INTERVIEW_MODEL` | Vercel | der gewählte Finalist |
| `EXTRACTION_MODEL` / `ENRICHMENT_MODEL` | Vercel | `google/gemini-3.5-flash` (PROJ-9, async, keine EU-Pflicht) |

### C) Tech-Entscheidungen (WARUM, PM-lesbar)

| Entscheidung | Begründung |
|---|---|
| OpenRouter nur fürs Screening, nie in Prod | Ein Aggregator erreicht alle 7 Kandidaten mit einem Key — billiges Wegwerf-Screening, egal welcher Anbieter ein Modell hostet. Für Prod ungeeignet, weil intransparent geroutet (Datenschutz) → dort ein dedizierter EU-Provider. |
| Provider erst nach dem Screening wählen (Stage 1.5) | Welcher Inference-Provider optimal ist, hängt vom Sieger ab (hostet er ihn? Preis, Latenz, EU-Fit). Nebius vorab festzulegen wäre verfrüht — vermutlich teurer + dünnere Abdeckung. Provider-Wahl ist ein eigener, dokumentierter Rechercheschritt. |
| Getiertes Screening (Pass A Vorfilter → Pass B voll) | 7 Modelle × 3 Personas × 3 Läufe wäre teuer und größtenteils an chancenlosen Modellen verschwendet. Pass A (billig, 1 Persona × 2 Läufe) filtert auf die Top 2–3, Pass B misst nur die mit vollem Versuchsplan-Rigor. Kosten-/Rigor-Balance. |
| Dreistufig (Screening ≠ Prod-Route) mit Stage-2-Gate „≥ Stage 1" | Ein auf OpenRouter gescreentes Modell kann auf dem Prod-Provider anders quantisiert/gesampelt sein. Der Finalist wird auf der echten Prod-Route erneut gemessen; sinkt eine Gate-Metrik, gilt er als durchgefallen (nächster Kandidat oder Baseline bleibt). |
| Guard-Judge konfigurierbar + Familie ≠ Talker | Kein Modell darf seine eigene Ausgabe bewerten (Bias). Nach dem Wechsel auf ein OSS-Modell muss der Wächter EU-konform auf dem gewählten Provider laufen, nicht mehr fest Anthropic/Google. |
| Kein stiller Preis-Fallback | Ein unbekanntes Modell mit Gemini-Lite-Preisen zu rechnen verfälscht den Kostenvergleich — der ganze Anlass des Features. Fehlender Preis warnt/failt (PROJ-40 B). |
| Tester-Stärke-Spot-Check eingefaltet (PROJ-40 Stufe 2) | Der starke Sonnet-Tester läuft zusätzlich auf dem entscheidenden Paar (Referenz + Finalist); kippt die Ordnung, ist die Entscheidung tester-abhängig → Eskalation. Gegated ist die Entscheidung, nicht der Start. |

### D) Dependencies

**Keine neuen npm-Pakete.** OpenRouter spricht denselben OpenAI-kompatiblen Endpoint wie Nebius/Fireworks
und nutzt das schon installierte `@ai-sdk/openai` (nur andere Basis-URL + Key). Nebius/Fireworks-Provider
existieren bereits (PROJ-9). Ein etwaiger neuer Prod-Provider aus Stage 1.5 folgt demselben Muster.

### E) Prozess-Ablauf (drei Stufen)

```
Stage 1 — Screening (eval-only, OpenRouter, getiert)
  Pass A: alle 7 × 1 Persona × 2 Läufe (Seed 42, pglite) → Shortlist Top 2–3
  Pass B: Shortlist + Referenz × 3 Personas × 3 Läufe (Versuchsplan §4–7)
  → Aggregate-Reports; Finalist per §7 (Gate + Nicht-Unterlegenheit + Kosten, Multi-Kennzahl-Ranking)
  → + eingefalteter Tester-Stärke-Spot-Check auf Referenz+Finalist (PROJ-40 Stufe 2)

Stage 1.5 — Inference-Provider-Recherche (nach Finalist)
  Provider für den Finalisten vergleichen: EU-Fit · Abdeckung · Kosten · Latenz · SLA
  (Nebius = eine Option, nicht gesetzt) → dokumentierte Provider-Wahl

Stage 2 — Prod-Verifikation (gewählter Provider)
  Finalist × 3 Personas × 3 Läufe, gleiche Parameter wie Pass B
  + Latenz/TTFT gegen echten Netz-Call (Ziel < 3s) — hier erstmals real messbar
  → Go/No-Go: Gate-Metriken ≥ Stage-1-Pass-B, TTFT-Ziel erfüllt
  → Fällt durch: nächster Shortlist-Kandidat; alle durch: Baseline bleibt
  → Entscheidungs-Doc + ADR-020-Nachtrag
```

### F) Abgrenzung + Risiken

- **Transfer-Validität** (OpenRouter-Screening → Prod-Provider): Kernrisiko der getrennten Routen, bewusst
  von Stage 2 abgefangen (Re-Validierung auf der Prod-Route mit Gate „≥ Stage 1").
- **OpenRouter-Reproduzierbarkeit:** der Aggregator kann denselben Modell-String über Läufe an
  unterschiedliche Backends/Quantisierungen routen — das untergräbt Seed 42. **Empfehlung:** OpenRouter
  je Kandidat auf ein festes Backend pinnen (Routing-Präferenz), vor Stage 1 zu fixieren. Betrifft auch
  die Preise (variieren je Backend, s. Kandidaten-Satz).
- **DeepSeek V4 Flash / MiMo-V2.5** (billigste Kandidaten): niedrigster Score im Satz; V4 Flash mit
  bekanntem Halluzinations-Risiko bei Wissenslücken (PROJ-9) — Screening muss `hallucinationRate` +
  `talker_grounding` besonders beobachten; das offene KI-18 (Guard-Sensitivität) berührt genau das.
- **Kosten:** Pass A ~$2–4, Pass B ~$5–8, Spot-Check ~$1–3 → gesamt ~$7–12. Vor jeder Ausführung bestätigen.
- **Externe Blocker:** Stage 1 braucht `OPENROUTER_API_KEY`, Stage 2 den Key des gewählten Providers —
  beide aktuell nicht gesetzt. Der Code (Provider, Pricing, Guard) ist ohne Keys baubar; die Läufe nicht.
- **Kein Eingriff in Extraktion/Anreicherung außer Env** — die bleiben auf Gemini (async, keine EU-Pflicht).

## Implementation Notes

### Stage-1-Code (keys-frei) — 2026-07-04

Der komplette code-baubare Teil von Stage 1 + D2 steht; die eigentlichen Läufe bleiben blockiert bis
`OPENROUTER_API_KEY` gesetzt ist. Kein DB-Schema, kein UI, reines Infra/Konfig.

**Geänderte Dateien:**
- `src/lib/llm-provider.ts` — `openrouter`-Provider (eval-only), OpenAI-kompatibler Endpoint
  `https://openrouter.ai/api/v1` via `.chat()` (gleiche `.chat()`-Regel wie nebius/fireworks, sonst
  träfe der Call OpenAIs Responses-API). Modell-String `openrouter/<vendor>/<modell>` → id nach dem
  ersten Slash = OpenRouters eigener Slug. Fehlermeldung um openrouter erweitert. +1 Test.
- `src/services/__evals__/interview/scorers/costSummary.ts` — `MODEL_PRICING` um die 7 Screening-Modelle
  ergänzt, reale Preise aus dem OpenRouter-Katalog gepinnt (Stand 2026-07-04, prompt/`input_cache_read`/
  completion → $/1M):
  | Key | in | cache | out |
  |---|---|---|---|
  | openrouter/z-ai/glm-5.2 | 0.91 | 0.169 | 2.86 |
  | openrouter/minimax/minimax-m3 | 0.30 | 0.06 | 1.20 |
  | openrouter/deepseek/deepseek-v4-pro | 0.435 | 0.003625 | 0.87 |
  | openrouter/moonshotai/kimi-k2.6 | 0.66 | 0.14 | 3.41 |
  | openrouter/xiaomi/mimo-v2.5-pro | 0.435 | 0.0036 | 0.87 |
  | openrouter/deepseek/deepseek-v4-flash | 0.09 | 0.018 | 0.18 |
  | openrouter/xiaomi/mimo-v2.5 | 0.105 | 0.105¹ | 0.28 |

  ¹ mimo-v2.5 hat keinen Cache-Read-Tarif → Cache zum Input-Preis. Keys = voller geloggter Modell-String
  (inkl. `openrouter/`-Präfix), damit `estimateTokenCost` nicht auf 0 fällt. +2 Tests.
- `src/services/talkerGroundingGuard.ts` — `crossVendorJudgeModel` → `resolveGuardJudgeModel`
  (liest `GUARD_JUDGE_MODEL`, sonst Cross-Vendor-Default). Neu: `modelFamily()` (normalisiert
  Provider-/Aggregator-Präfixe auf die Vendor-Familie) + `assertGuardFamilyDiffersFromTalker()`
  (wirft bei gleicher Familie). Assert liegt **vor** dem Judge-try/catch und vor dem Empty-History-
  Return — ein Konfig-Fehler failt das Interview hart, wird nicht als no-violation geschluckt. +8 Tests.
- `.env.local.example` — `OPENROUTER_API_KEY` (eval-only, „nie auf Vercel" + Pin-Hinweis) und
  `GUARD_JUDGE_MODEL` (Familie ≠ Talker) dokumentiert; Provider-Liste im Kommentar erweitert.

**Verifikation:** `tsc --noEmit` grün; volle Unit-Suite 858 passed / 1 skipped / 0 failed.

**Design-Notiz `modelFamily`:** heuristische Substring-Tabelle (claude/gemini/deepseek/glm/minimax/
kimi/mimo/qwen/llama/mistral/gpt) mit strukturellem Fallback auf das Vendor-Segment. Bewusst eher
zu grob gruppierend als zu fein — die Kosten eines falschen „gleiche Familie" ist nur ein vom Operator
behebbarer Konfig-Fehler, ein falsches „verschieden" würde ein Modell sich selbst bewerten lassen.

**Noch offen (externe Blocker):** `OPENROUTER_API_KEY` (Stage 1), Prod-Provider-Key (Stage 2, Provider
erst in Stage 1.5 gewählt). Alle Läufe (Pass A/B, Provider-Recherche, Verifikation) hängen daran.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

## Post-Mortem
_To be added by /deploy_

| Aspekt | Bewertung |
|--------|-----------|
| Spec-Genauigkeit | — |
| Appetite vs. tatsächlich | geschätzt: L / tatsächlich: — |
| Größte Überraschung | — |
| Vorgeschlagene Regeländerung | — |
| Build-Loop-Iterationen | tatsächlich: — (geplant: ≤5) |
| Häufigste Fehlerkategorie im Loop | — |
