# PROJ-41: Interview-Modell-Auswahl (OSS-Screening + EU-Prod-Route)

## Status: Planned
**Type:** Revision
**Domain:** Platform
**Extends:** PROJ-9
**Appetite:** L
**Bugs:** —
**Created:** 2026-07-02
**Last Updated:** 2026-07-02

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
  zu ändern — und der neue Provider (Nebius) muss dafür in `llm-provider.ts` registriert sein.
- Als Solo-Developer möchte ich die monatlichen LLM-Kosten senken, ohne Interview-Qualität messbar zu
  verschlechtern — das Screening liefert die Datengrundlage für diese Entscheidung.
- Als Entwickler möchte ich, dass der Prod-Guard-Judge nach dem Modellwechsel EU-konform und
  bias-frei bleibt (kein Modell bewertet seine eigene Ausgabe).
- Als Entwickler möchte ich nach Abschluss eine dokumentierte Entscheidung haben, welches Modell
  in Produktion geht und warum — nachvollziehbar für Audit und spätere Revisionen.

## Acceptance Criteria

### Hartes Gate (vor Stage 1)
- [ ] PROJ-40 Stufe 1 UND Stufe 2 haben ein dokumentiertes Go-Verdikt — kein Screening ohne dieses Gate

### Stage 1 — Screening via OpenRouter

- [ ] `openrouter`-Provider in `llm-provider.ts` verfügbar (eval-only, Format `openrouter/provider/model`)
- [ ] `OPENROUTER_API_KEY` in `.env.local.example` dokumentiert (eval-only, kein Prod-Env)
- [ ] Stage 1 ausgeführt: 3 Kandidaten (Kimi K2.6, DeepSeek V4 Flash, Gemini 3.5 Flash) × 3 Personas × 3 Runs, Versuchsplan (Seed 42, `--store pglite`, MAX_TURNS=35) strikt befolgt
- [ ] Aggregate-Reports je Kandidat × Persona vorhanden (`docs/evals/` Artefakte)
- [ ] Finalist per Entscheidungsregel des Versuchsplans (§7: Gate-Pass + Nicht-Unterlegenheit + Kosten) dokumentiert
- [ ] Entscheidungs-Dokument schriftlich: Kandidat, Gate-Ergebnis, Kosten-Vergleich ($/Run nach Bucket), Begründung

### Stage 2 — Prod-Validierung auf EU-Route (Nebius)

- [ ] `nebius`-Provider in `llm-provider.ts` verfügbar (OpenAI-kompatibler Endpoint, Format `nebius/model-id`, NEBIUS_API_KEY)
- [ ] Finalist auf Nebius-Route erneut evaluiert: 3 Personas × 3 Runs, sonst gleiche Parameter wie Stage 1
- [ ] Latenz/TTFT pro Turn gemessen — Stage-2-spezifisch (echter Netz-Call, nicht pglite-synthetisch), TTFT-Zielwert < 3s (aus PROJ-9)
- [ ] Go/No-Go dokumentiert: Stage-2-Gate-Metriken ≥ Stage-1-Werte (kein Rückschritt durch Quantisierung/Sampling-Differenz), TTFT-Ziel erfüllt
- [ ] Falls Finalist Stage 2 nicht besteht: nächster Kandidat aus Stage 1 wird Stage 2 durchlaufen; falls alle scheitern: Baseline bleibt, Entscheidung dokumentiert

### Provider-Infra

- [ ] `llm-provider.ts` erweitert: `nebius` und `openrouter` als Provider neben `anthropic`/`google`
- [ ] Fehler bei fehlendem API-Key: hard fail mit klarer Fehlermeldung, kein stiller Fallback auf Fallback-Modell
- [ ] `NEBIUS_API_KEY` in `.env.local.example` dokumentiert (Prod-Env)
- [ ] Alle drei `MODEL_PRICING`-Einträge (Interview-, Tester-, Eval-Bucket) für Nebius-Modelle ergänzt (ADR-020 D4: $/Token je vollem `provider/model`-String)

### D2 — Prod-Guard EU-Judge (ADR-020)

- [ ] `talkerGroundingGuard.ts` `crossVendorJudgeModel` nicht mehr hardcoded Gemini/Anthropic, sondern via `GUARD_JUDGE_MODEL`-Env konfigurierbar
- [ ] Default für EU-Route: `nebius/<andere-familie-als-talker>` (z.B. Talker = DeepSeek auf Nebius → Guard-Judge = Kimi auf Nebius oder umgekehrt; nie gleiche Modellfamilie)
- [ ] Constraint dokumentiert und per Assert geprüft: Guard-Judge-Familie ≠ Talker-Familie
- [ ] `GUARD_JUDGE_MODEL` in `.env.local.example` dokumentiert

### Extraction/Enrichment (keine Screening-Läufe)

- [ ] `EXTRACTION_MODEL` auf Vercel auf `google/gemini-3.5-flash` gesetzt (PROJ-9-Empfehlung, Omniscience +23)
- [ ] `ENRICHMENT_MODEL` auf Vercel auf `google/gemini-3.5-flash` gesetzt
- [ ] `GOOGLE_GENERATIVE_AI_API_KEY` auf Vercel hinterlegt (falls nicht vorhanden)

### Vercel-Produktion

- [ ] `INTERVIEW_MODEL` auf Vercel auf den Finalist (Stage-2-validiertes Modell) gesetzt
- [ ] `NEBIUS_API_KEY` auf Vercel hinterlegt
- [ ] `GUARD_JUDGE_MODEL` auf Vercel gesetzt (EU-konformer Guard-Judge für Prod-Guard)

### Entscheidungs-Dokumentation

- [ ] Spec (dieses Dokument) wird um die finale Modellwahl + Begründung ergänzt nach Stage-2-Abschluss
- [ ] ADR-020 bekommt einen PROJ-41-Nachtrag mit Stage-1/2-Ergebnis und Entscheidung

## Edge Cases

- **OpenRouter Key fehlt bei Stage 1:** hartes Eval-Fail mit Fehlermeldung, kein stiller Fallback — verhindert, dass ein Kandidat auf dem falschen Provider gemessen wird
- **Nebius API transienter Fehler bei Stage 2:** bestehende `withRetry()`-Logik (KI-11) greift; TTFT-Messung zählt Wall-Clock (inkl. Retry), repräsentiert echte Prod-Latenz
- **Guard-Judge-Modell nicht erreichbar:** Interview schlägt fehl (kein stiller Fallback) — der Prod-Guard muss immer laufen, Degradation auf "kein Guard" ist kein akzeptierter Zustand
- **Finalist besteht Stage 2 Gate-Metriken nicht** (Rückschritt durch Quantisierung auf Nebius): nächster Kandidat aus Stage-1-Ranking; falls alle scheitern: Baseline (`gemini-3.1-flash-lite`) bleibt, Entscheidung dokumentiert
- **Alle drei Kandidaten scheitern Stage 1:** kein Wechsel, Baseline bleibt, Erkenntnisse für zukünftige Kandidaten-Recherche festgehalten
- **TTFT-Ziel knapp verfehlt (3–4s):** User-Entscheidung ob akzeptabel (kein Auto-Reject) — Entscheidungsregel §7 erlaubt Abwägung
- **Guard-Judge-Familie = Talker-Familie durch Fehlkonfiguration:** Assert fängt das bei Start, hartes Fail
- **Nebius-Modell-ID ändert sich nach Deployment:** Fehler bricht den Call, kein stiller Fallback — Env-Var-Update nötig

## Technical Requirements

- **EU-Compliance:** Talker (Interview-Rolle) UND Guard-Judge müssen auf EU-gehosteten Providern laufen (ADR-020 D1). Extraction/Enrichment hat keine EU-Pflicht (async, Gemini bleibt).
- **Stage 2 TTFT:** < 3s Zeit bis erster Token (echter Netz-Call gegen Nebius-Endpoint)
- **Model Pricing vollständig:** alle Nebius-Modelle mit realen $/Token-Werten in `MODEL_PRICING` (ADR-020 D4), kein Fallback auf Gemini-Lite-Preis
- **OpenRouter:** ausschließlich eval-only — nicht in Prod konfigurierbar, kein Prod-Env-Eintrag
- **Versuchsplan-Bindung:** Stage 1 folgt strikt dem festgeschriebenen Versuchsplan (Seed 42, pglite, Personas buchhalter/vertriebler/it-support, Entscheidungsregel §7) — keine Ad-hoc-Abweichungen

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

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
