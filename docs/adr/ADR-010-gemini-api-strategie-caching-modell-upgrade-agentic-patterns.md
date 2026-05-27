# ADR-010: Gemini API Strategie — Caching, Modell-Upgrade-Pfad und Agentic Patterns

**Status:** Accepted (2026-05-27)
**Author:** lyas53
**Repository:** Roly-Bach/meridian-app
**Auslöser:** Research-Sprint Gemini Cookbook (github.com/google-gemini/cookbook) + Gemini API Docs (ai.google.dev/gemini-api/docs)
**Ergänzt:** ADR-009 (Kontext-Architektur), ADR-007 (Prompt-Strukturreform)

---

## Context

Ein Research-Sprint über Google Gemini Cookbook und die Gemini API Dokumentation hat mehrere Punkte identifiziert, die für die Weiterentwicklung der Interview-Engine und des Extraction-Service relevant sind:

**Context Caching.** Gemini bietet implizites und explizites Context Caching. Implizites Caching ist für `gemini-3.1-flash-lite` (aktuelles Default-Modell) und alle neueren Modelle automatisch aktiv — vorausgesetzt, das System-Prompt-Prefix ist zwischen Turns stabil. Der aktuelle Zustand (vor ADR-009 D2-Implementierung) injiziert den dynamischen Kontext in den System-Prompt; das verhindert Cache-Hits. Nach D2 entfällt diese Blockade.

**Modell-Lineup.** Gemini 2.x-Modelle sind veraltet. Aktuelles Lineup: `gemini-3.1-flash-lite` (budget, current default), `gemini-3.5-flash` (geplantes Upgrade-Ziel). Ein unkontrollierter Modell-Wechsel ohne Eval-Vergleich birgt das Risiko unbeobachteter Verhaltensänderungen im Interview-Agenten.

**Live API.** Die Gemini Live API kombiniert native Audio-Verarbeitung, Function Calling und Real-Time Streaming in einem API-Call. Das ist eine architektonische Weiterentwicklung gegenüber der aktuellen PROJ-7-Pipeline (ElevenLabs Scribe v2 STT → Text-Turn → Agent).

**Agentic Patterns.** Das Cookbook enthält mehrere Patterns, die mit unserer aktuellen Architektur übereinstimmen oder sie ergänzen: Multi-Turn Agent mit strukturiertem State (Barista-Bot-Pattern), annotierte Few-Shot-Transkripte (ADR-009 D6), strukturierte Ausgaben (`response_schema`) als Alternative zu Tool-Calling.

---

## Decisions

### D1 — Implizites Caching: ADR-009 D2 als technische Voraussetzung

Implizites Caching ist bereits systemseitig aktiv (`gemini-3.1-flash-lite` ist 3.x-Generation, also ≥ 2.5). Es greift jedoch nur bei stabilem System-Prompt-Prefix.

**Entscheidung:** ADR-009 D2 (Phasenblock + dynamischer Kontext → User-Turn, System-Prompt = nur Persona + Format + Tools) ist **nicht nur** eine Prompt-Engineering-Entscheidung, sondern auch die technische Voraussetzung für funktionierendes implizites Caching. Die Implementierung von D2 ist damit doppelt priorisiert.

Nach D2 greift implizites Caching ab Turn 2 jedes Interviews automatisch. `usage_metadata.cached_token_count` ist bereits geloggt und liefert den Nachweis.

Kein explizites Caching für die aktuelle Architektur — der manuelle Overhead lohnt sich nicht solange der System-Prompt unter ~5.000 Tokens bleibt.

### D2 — Explizites Caching: Deferral mit Trigger

Explizites Caching wird nicht implementiert, solange:
- `cached_token_count` nach D2-Implementierung ≥ 60% des System-Prompts trifft, **oder**
- Interview-Sessions nicht regelmäßig >45 Min dauern

Wenn einer dieser Trigger eintritt: System-Prompt + Few-Shot-Beispiele (ADR-009 D6) als expliziter Cache mit TTL = 60 Min.

### D3 — Modell-Upgrade-Pfad: Eval-gated 3.1 → 3.5

Upgrade auf `gemini-3.5-flash` erst nach Eval-Verifikation. Kein unkontrollierter Wechsel.

**Prozess:**

| Phase | Modell | Eval-Durchläufe | Ziel |
|-------|--------|-----------------|------|
| Baseline | `gemini-3.1-flash-lite` | n=3–5 | Buchhalter-Persona, gleiche Szenarien |
| Upgrade | `gemini-3.5-flash` | n=3–5 | Gleiche Persona + Szenarien |

**Entscheidungskriterien beim Vergleich:**
- Phase-Adherence (Verbleibt Agent in walkthrough_step ohne Slot-Fragen?)
- Slot-Fill-Rate (Anteil korrekt befüllter Mandatory Slots nach wrap_up)
- Anchoring-Rate (Wie oft schlägt Agent selbst eine Zahl vor? Ziel: 0%)
- Latenz (P50/P95 Time-to-First-Token)
- Kosten-Delta (Input/Output-Token-Preis 3.5 vs. 3.1)

Upgrade findet statt wenn: Qualitätsgewinn messbar UND Kostenerhöhung < 3× aktueller Kosten.
Kein Upgrade wenn kein messbarer Qualitätsgewinn gegenüber 3.1.

### D4 — Live API: Architektonischer Zielpfad für Voice-Interview

Die aktuelle PROJ-7-Architektur (ElevenLabs Scribe v2 STT → Text → Interview-Agent) ist ein valider Zwischenschritt, aber kein langfristiger Endzustand.

**Entscheidung:** Die Gemini Live API (native Audio-Input + Function Calling + Real-Time Streaming in einem API-Call) ist der bevorzugte Zielpfad für künftige Voice-Interview-Iterationen.

Begründung:
- Ein API-Call statt Pipeline aus STT-Dienst + separatem LLM-Call
- Latenz-Vorteil durch Ende-zu-Ende-Verarbeitung
- Function Calling (register_step, record_slot) bleibt architektonisch identisch
- Kein Vendor-Lock-in zu ElevenLabs für den Core-Interaction-Path

**Jetzt:** Keine Implementierung. PROJ-7 bleibt unverändert bis 3.1/3.5-Baseline stabil ist.
**Trigger für Evaluation:** Stabiler Eval-Baseline nach D3 + ≥1 Design-Partner-Interview abgeschlossen.

Alle neuen Voice-Features werden auf Live-API-Kompatibilität geprüft bevor sie implementiert werden.

### D5 — response_schema für Extraction-Service: Spike geplant

Der Extraction-Service nutzt aktuell Tool-Calling mit einem komplexen Tool-Schema. `response_schema` (Gemini Structured Output) erzwingt typisierte JSON-Ausgaben direkt — weniger Overhead als Tool-Schema, keine Tool-Use-Iteration nötig.

**Entscheidung:** Spike im Rahmen von PROJ-4 / Extraction-Service-Iteration. Kein aktueller Handlungsbedarf.

Kriterium für Umstellung: `response_schema`-Ausgabequalität ≥ Tool-Calling-Ausgabequalität bei gleichem Prompt in n=5 Stichproben.

### D6 — ReAct-Pattern: Kein Handlungsbedarf

ReAct (Reasoning + Acting-Loop) ist für unkontrollierte Multi-Tool-Workflows relevant. Die Interview-Engine hat eine klar definierte Phasen-Struktur (ADR-008/ADR-009) mit diskreten Tool-Calls per Phase — das ist architektonisch stärker als ein offener ReAct-Loop.

**Entscheidung:** Kein ReAct in der Interview-Engine. Referenz im Cookbook (Search_Wikipedia_using_ReAct.ipynb) für spätere Wissensgraph-Traversal-Features (PROJ-19 Knowledge-Informed Interviewing) relevant halten.

---

## Consequences

**Positiv:**
- ADR-009 D2 erhält zusätzliche technische Motivation (Caching-Enabler), was die Priorisierung stärkt
- Expliziter Modell-Upgrade-Pfad mit Eval-Gate verhindert Qualitätsregression bei Modellwechseln
- Live API als Zielpfad für Voice verhindert weitere Invest in die STT-Pipeline ohne strategischen Wert
- response_schema-Spike ist definiert aber nicht kritisch-path

**Negativ:**
- Kein sofortiger Caching-Gewinn — D2-Implementierung (ADR-009) muss zuerst abgeschlossen sein
- Eval-gated Upgrade verzögert den 3.5-Flash-Wechsel um 2–3 Wochen (Eval-Aufwand)

**Offene Fragen:**
- Wie genau messen wir "Phase-Adherence" objektiv? Aktuell noch manuell aus Eval-Transkript. Vor D3-Eval-Phase definieren.

---

## Umsetzung

| # | Entscheidung | Voraussetzung | Status | Aufwand |
|---|-------------|---------------|--------|---------|
| D1 | Implizites Caching aktiv nach D2 | ADR-009 D2 implementiert | **Aktiv** (2026-05-27) | 0 (automatisch) |
| D2 | Explizites Caching — monitoring via cached_token_count | D1 aktiv | Monitoring läuft | S wenn Trigger eintritt |
| D3 | Eval-Baseline auf 3.1 + Eval auf 3.5 durchführen | ADR-009 alle Ds implementiert | **Entblockt** (2026-05-27) | M (Eval-Design + n=6-10 Runs) |
| D4 | Live API Evaluation | D3 abgeschlossen + ≥1 Design-Partner | Blocked on D3 | L (neue API-Integration) |
| D5 | response_schema Spike im Extraction-Service | Kein Blocking | Offen | S |
| D6 | ReAct: kein Handlungsbedarf | — | Geschlossen | — |

Empfohlene Reihenfolge: D1 (kommt mit ADR-009 D2 kostenlos) → D3 (nach ADR-009 Implementierung) → D5 (parallel, low-prio Spike) → D4 (mittelfristig).

---

## Amendment 2026-05-27 — ADR-009 implementiert

ADR-009 vollständig implementiert. Direkte Auswirkungen auf ADR-010:

**D1 jetzt aktiv.** `buildStaticPrompt` ist invariant (Persona, turn_format, Silence-Constraint, Tool-Regeln — kein Phasenblock, keine dynamischen Felder). Das System-Prompt-Prefix ist stabil. Implizites Caching greift ab Turn 2 automatisch. Nächster Schritt: `cached_token_count` in den Logs auf positive Hits prüfen (Ziel: ≥ 60% System-Prompt-Tokens gecacht ab Turn 2).

**D3 entblockt.** Eval-Baseline auf `gemini-3.1-flash-lite` kann gestartet werden. Empfehlung: gleiche Buchhalter-Persona wie in `docs/evals/interview/2026-05-27-buchhalter.md`, n=3–5 Runs, Fokus auf Phase-Adherence und Anchoring-Rate nach ADR-009-Fixes.
