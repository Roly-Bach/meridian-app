# PROJ-41 Stage 1.5 — Inference-Provider-Recherche für die Shortlist

**Datum:** 2026-07-07
**Shortlist aus Pass A:** `deepseek-v4-pro` + `minimax-m3` (beide Gate-PASS, siehe [Stage-1-Entscheidung](PROJ-41-stage1-screening-entscheidung.md))
**Frage:** Welcher EU-taugliche Inference-Provider hostet welchen Kandidaten, zu welchem Preis, mit welcher EU-Daten-Reife? (ADR-020 D1: harte EU-Hosting-Pflicht für alle Prod-LLM-Calls auf Kundendaten)

## Geprüfte Provider

Nebius, Fireworks, DeepInfra, Together AI, Novita, GMI Cloud (Nutzer-Vorgabe) — zusätzlich SiliconFlow und
Parasail (tauchen als OpenRouter-Endpoints für die zwei Modelle auf) sowie zwei EU-Souveränitäts-Cloud-
Anbieter (Scaleway, OVHcloud) als gezielte Suche nach einer günstigeren EU-nativen Alternative zu Nebius
(Nutzer-Rückfrage 2026-07-07: „Nebius ist vergleichsweise teuer, ich bevorzuge einen günstigeren Provider").

## Hosting-Matrix

| Provider | Firmensitz / CLOUD-Act-Status | deepseek-v4-pro | minimax-m3 | EU-Datenverarbeitung für **Standard-API** (nicht Enterprise) |
|---|---|---|---|---|
| **Nebius** | NL (Amsterdam), kein CLOUD-Act-Risiko | ✅ `deepseek-ai/deepseek-v4-pro` $1.75/$3.50 | ❌ **nicht gehostet** (nur `minimax-m2.5`, anderes Modell) | Ja — native EU-Rechenzentren (Finnland/NL) sind die reguläre Serving-Infra, kein Enterprise-Add-on |
| **Fireworks** | US (CLOUD-Act anwendbar) | ✅ $1.74/$3.48 | ✅ $0.30/$1.20 | **Nein für Standard-Zugang** — Frankfurt/Iceland-Region existiert, aber laut Fireworks-eigener Doku ist Regionswahl Teil des **Enterprise-Produkts**; Serverless/Pay-as-you-go läuft auf dem globalen US-lastigen Fleet. Bestätigt durch Microsoft-Foundry-Integration: „EU Data Boundary coverage is not currently available" |
| **Together AI** | US (San Francisco) | ✅ $2.10/$4.40 | ✅ $0.30/$1.20 | Unklar — EU-GPU-Kapazität (UK/Spain/France/Portugal/Iceland) wird für **dedizierte Cluster** beworben, keine Bestätigung für Serverless-Region-Pinning |
| **DeepInfra** | US (Delaware/Palo Alto) | ✅ $1.74/$3.48 | gelistet, Preis nicht verifiziert | Unklar/nicht beworben — zusätzlich der Backend-Anbieter, der in Pass A die Verbindungsabbrüche verursacht hat (operatives Warnsignal, unabhängig von Compliance) |
| **Novita** | US (San Francisco), Infra auf AWS | ✅ $1.60/$3.20 | ✅ $0.30/$1.20 | Kein bestätigtes eigenes EU-Rechenzentrum — GDPR-Compliance nur über SCCs/Vertragsmechanismen, nicht über physische EU-Residenz |
| **GMI Cloud** | US (Silicon Valley/Colorado) + APAC (Taiwan/Thailand/Malaysia) | unklar | ✅ | **Keine EU-Präsenz** — ausgeschlossen |
| **SiliconFlow** | China (Peking) | — | ✅ (OpenRouter-Endpoint) | **Ausgeschlossen** — chinesische Server, gleiche Kategorie wie „DeepSeek direkt"/„Kimi direkt" in PROJ-9 (GDPR-Verletzung) |
| **Parasail** | US (San Mateo) | — | ✅ $0.30/$1.20 | US-Firma, keine EU-Behauptung gefunden — gleiche CLOUD-Act-Kategorie wie Fireworks/Together/Novita |
| **Scaleway** | FR (EU-Souveränitäts-Cloud, „Generative APIs … hosted in European data centers") | ❌ nicht im Katalog | ❌ nicht im Katalog | Katalog geprüft: nur DeepSeek-R1-Distill (viel kleiner/älter), GLM-5.2, Qwen3.6 — **weder deepseek-v4-pro noch minimax-m3 gehostet** |
| **OVHcloud** | FR (EU-Souveränitäts-Cloud) | ❌ nicht im Katalog | ❌ nicht im Katalog | Katalog direkt geprüft (21 Modelle: Qwen/Mistral/Llama/gpt-oss/Whisper) — **weder deepseek-v4-pro noch minimax-m3 gehostet** |

**Explizite Suche nach einer günstigeren EU-nativen Alternative zu Nebius:** negativ. Die zwei echten
EU-Souveränitäts-Cloud-Anbieter (Scaleway, OVHcloud — französische Unternehmen, eigene EU-Rechenzentren,
kein CLOUD-Act-Thema) hosten typischerweise kleinere/ältere Open-Weight-Modelle (Mistral, Qwen, Llama,
DeepSeek-R1-Distill) und aktuell **keinen** der zwei Pass-A-Finalisten. Nebius bleibt damit der einzige
Provider, der überhaupt sowohl EU-nativ ist als auch einen der beiden Kandidaten hostet.

## Zentraler Befund: EU-Fit ist asymmetrisch zwischen den zwei Pass-A-Finalisten

**deepseek-v4-pro hat eine saubere EU-native Option (Nebius).** Gleiche Firma, gleiche Argumentation wie in PROJ-9 bereits etabliert (Nebius = kein CLOUD-Act-Risiko, echte EU-Rechenzentren als Regelbetrieb).

**minimax-m3 hat aktuell keine saubere EU-native Option.** Jeder Provider, der es hostet (Fireworks, Together, Novita, DeepInfra, GMI), ist eine US-Firma. Und der einzige davon mit einer öffentlich beworbenen EU-Region (Fireworks, Frankfurt) stellt sich bei genauerem Hinsehen als **Enterprise-only** heraus — der Standard-API-Zugang, den ein Solo-Developer-MVP nutzen würde, läuft nicht garantiert in der EU. Das ist eine Korrektur/Verfeinerung gegenüber der PROJ-9-Recherche (Mai 2026), die Fireworks pauschal als „explizite EU Data Residency" eingestuft hatte, ohne zwischen Serverless- und Enterprise-Zugang zu unterscheiden.

Konsequenz nach der im Edge-Cases-Abschnitt der Spec bereits festgeschriebenen Regel („Kein Provider hostet den Finalisten EU-konform/bezahlbar → nächster Shortlist-Kandidat"): **minimax-m3 kann nach heutigem Stand nicht Prod-Modell werden**, unabhängig vom Ausgang von Pass B — es gibt schlicht keinen Provider, der es EU-konform auf Standard-Zugang anbietet.

## Preisvergleich (nur die zwei Finalisten, $/1M Input–Output)

| Modell | Nebius | Fireworks | Together | Novita | DeepInfra |
|---|---|---|---|---|---|
| deepseek-v4-pro | **$1.75 / $3.50** | $1.74 / $3.48 | $2.10 / $4.40 | $1.60 / $3.20 | $1.74 / $3.48 |
| minimax-m3 | — (nicht gehostet) | $0.30 / $1.20 | $0.30 / $1.20 | $0.30 / $1.20 | (nicht verifiziert) |

Bemerkenswert: deepseek-v4-pro ist bei allen Providern deutlich teurer als in Stage 1 auf OpenRouter gemessen (~$0.44/$0.87 dort war der DeepSeek-Direktpreis, den OpenRouter durchreicht — kein Provider im Vergleich oben kommt in dessen Nähe). Der reale Prod-Preis von deepseek-v4-pro liegt also 3–4× über dem Stage-1-Screening-Preis. minimax-m3 bleibt dagegen über alle Provider konstant bei $0.30/$1.20 (deckt sich mit dem Stage-1-Preis).

### Ist Nebius wirklich teurer? (Nutzer-Rückfrage 2026-07-07)

**Nein, nicht mehr für dieses Modell.** Die Einschätzung „Nebius teurer" stammt aus PROJ-9 (Mai 2026) und
war für die damalige Modell-Generation korrekt: Kimi K2.6 kostete auf Nebius $1.30 vs. $0.70 auf Fireworks
(1.9×), DeepSeek V4 Pro (alt) $1.90 vs. $0.80 (2.4×) — ein echter, dokumentierter Preisunterschied.

Für die **aktuelle** deepseek-v4-pro-Generation (Stand 2026-07-07) hat sich dieser Abstand geschlossen:

| Provider | Input | Output | EU-konform (Standard-Zugang)? |
|---|---|---|---|
| Novita | $1.60 | $3.20 | Nein |
| Fireworks | $1.74 | $3.48 | Nein (Enterprise-only) |
| DeepInfra | $1.74 | $3.48 | Nein |
| **Nebius** | **$1.75** | **$3.50** | **Ja** |
| Together | $2.10 | $4.40 | Nein |

Nebius liegt praktisch gleichauf mit den zwei günstigsten Nicht-EU-Optionen (Fireworks/DeepInfra, ~0.6%
Unterschied) und nur 9% über der günstigsten Nicht-EU-Option (Novita). Es gibt aktuell **keinen** Provider,
der spürbar günstiger UND EU-konform ist — die einzige Möglichkeit für einen niedrigeren Preis wäre, die
harte EU-Anforderung (ADR-020 D1) zu lockern, was eine bewusste, dokumentierte Architektur-Entscheidung
wäre, keine Nebenentscheidung dieser Recherche.

Zusätzlich bietet Nebius selbst zwei Hebel, die noch nicht verifiziert sind (Doku-Fund, nicht modellspezifisch
bestätigt): Batch-Inference zu 50% Rabatt (für nicht-Echtzeit-Zwecke wie Extraktion/Anreicherung interessant,
nicht für den synchronen Talker) und Volumen-Rabatte (10% ab 1M Tokens/Monat, bis 50% ab 1B/Monat) — bei
Meridians MVP-Volumen (~30 Interviews/Monat × ~60k Tokens ≈ 1.8M Tokens/Monat) evtl. bereits die 10%-Stufe
erreichbar. Vor Stage 2 zu verifizieren, falls der Preis eine Rolle für die Endentscheidung spielt.

## Empfehlung

**deepseek-v4-pro auf Nebius** ist der einzige der zwei Kandidaten mit einer sauberen EU-Geschichte und ist bereits in `llm-provider.ts` als `nebius/<model-id>` verkabelt (kein Code nötig, nur Env-Var `NEBIUS_API_KEY` + Modell-String `nebius/deepseek-ai/deepseek-v4-pro`).

**minimax-m3** bleibt vorerst ohne Prod-Pfad. Optionen für Pass B (offene Entscheidung, siehe Rückfrage im Chat):
1. Pass B nur für deepseek-v4-pro + Referenz auf Nebius fahren (spart Kosten, da minimax-m3 ohnehin nicht Prod werden kann); minimax-m3-Ergebnis aus Pass A bleibt als Dokumentation stehen.
2. Pass B trotzdem für beide fahren (auf dem jeweils besten verfügbaren Provider — minimax-m3 z.B. auf Fireworks), um eine vollständige Vergleichsbasis zu haben, falls ein EU-Provider das Modell später aufnimmt.

## Quellen

- [Nebius Token Factory Pricing (Requesty-Katalog)](https://www.requesty.ai/models/nebius)
- [Nebius Token Factory Modelliste via OpenRouter](https://openrouter.ai/provider/nebius)
- [DeepSeek V4 Pro Provider-Vergleich (Artificial Analysis)](https://artificialanalysis.ai/models/deepseek-v4-pro/providers)
- [MiniMax M3 Provider-Vergleich (Artificial Analysis)](https://artificialanalysis.ai/models/minimax-m3/providers)
- [Fireworks Regions-Doku](https://docs.fireworks.ai/deployments/regions)
- [Fireworks Trust Center](https://trust.fireworks.ai/)
- [Fireworks DeepSeek-V4-Pro Modellseite](https://fireworks.ai/models/deepseek-ai/deepseek-v4-pro)
- [Fireworks MiniMax M3 Launch Blog](https://fireworks.ai/blog/minimax-m3-launch)
- [Together AI Data Center Locations](https://www.together.ai/data-center-locations)
- [Together AI DeepSeek V4 Pro Modellseite](https://www.together.ai/models/deepseek-v4-pro)
- [Novita AI Trust Center](https://trust.novita.ai/)
- [GMI Cloud Pricing-Doku](https://docs.gmicloud.ai/inference-engine/billing/price)
- [Scaleway Generative APIs — Supported Models](https://www.scaleway.com/en/docs/generative-apis/reference-content/supported-models/)
- [OVHcloud AI Endpoints Catalog](https://www.ovhcloud.com/en/public-cloud/ai-endpoints/catalog/)
- [Nebius Token Factory — Batch Inference Doku](https://docs.tokenfactory.nebius.com/ai-models-inference/batch-inference)
- [Nebius Pricing-Katalog (Requesty)](https://www.requesty.ai/models/nebius)
- [OpenRouter Provider-Vergleich deepseek-v4-pro](https://openrouter.ai/deepseek/deepseek-v4-pro/providers)
- [OpenRouter Provider-Vergleich minimax-m3](https://openrouter.ai/minimax/minimax-m3/providers)
