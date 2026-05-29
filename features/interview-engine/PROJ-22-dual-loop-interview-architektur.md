# PROJ-22: Dual-Loop Interview Architektur

## Status: Planned
**Created:** 2026-05-29
**Last Updated:** 2026-05-29
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-2
**Appetite:** XL (>2 Wochen, 5 Iterationen)
**Priority:** P0
**Bugs:** —

## Dependencies

- Requires: ADR-011 (Dual-Loop Interview Architektur) — alle architektonischen Entscheidungen D1-D12
- Requires: PROJ-21 (Eval-Foundation) — Baseline-Runs und Quality-Scorer für die fünf Iterations-Gates
- Requires: PROJ-13 (LLM Observability & Tracing) — Langfuse-Spans pro Komponente, Cost-Attribution
- Supersedes: PROJ-8 (Interview-Design Optimierung) — Negative Constraints, Anti-Anchoring-Block und Few-Shot-Dialoge aus PROJ-8 werden im Talker-Prompt entfernt (ADR-011 D7)
- Affects: PROJ-7 (Voice Input) — keine direkte Änderung, aber Talker-Modellwahl beeinflusst Voice-Latenz-Eignung

## Hintergrund & Motivation

Der monolithische Single-Call-Interview-Agent (PROJ-2) bündelt vier Aufgaben in einem LLM-Call: Konversation, Wissens-Extraktion, Phasen-Management, Coverage-Planung. Diese Bündelung versagt unter Last und kollabiert bei fähigeren Modellen (`gemini-3.5-flash` schlechter als `gemini-3.1-flash-lite`, Eval-Lauf 2026-05-28).

ADR-011 hat die Architektur-Antwort dokumentiert: Trennung in **Talker** (synchron, schnell, nur Text), **Analyst** (asynchron im Hintergrund, Wissens-Tools, plant nächstes Briefing) und **Orchestrator** (deterministisch, Phasen- und Lifecycle-Logik). Talker bekommt keine Tools, Analyst macht alle Tool-Calls, Orchestrator ersetzt `transition_phase`/`enter_coverage_check`/`complete_interview` durch testbare Code-Regeln.

PROJ-22 setzt ADR-011 in fünf nachvollziehbaren Iterationen um. Jede Iteration ist gegen die PROJ-21-Baseline messbar.

## User Stories

- Als **interviewter Mitarbeiter** will ich vom Agenten innerhalb von 2-3 Sekunden eine erste Reaktion auf meine Antwort sehen, damit das Gespräch flüssig bleibt.
- Als **interviewter Mitarbeiter** will ich, dass der Agent natürlich auf das eingeht, was ich gerade gesagt habe, ohne dass dieselbe Frage zweimal kommt.
- Als **Berater**, der ein Interview auswertet, will ich, dass der Tracker am Ende vollständig und korrekt ist, auch wenn das Gespräch dynamisch von der Standard-Reihenfolge abweicht.
- Als **Developer**, der die Engine wartet, will ich Phasen-Übergänge im Code als Funktionen testen können, statt sie in Prompt-Prosa zu validieren.
- Als **Developer** will ich Talker, Analyst und Orchestrator in Langfuse als separate Spans sehen, damit ich Latenz, Cost und Logik-Drift pro Komponente debuggen kann.
- Als **Developer** will ich einen Modell-Wechsel pro Komponente (Talker, Analyst) via Konfiguration durchführen können, ohne den Prompt zu ändern.

## Acceptance Criteria

### Architektur-Komponenten

- [ ] Neue Datei `src/services/interviewTalker.ts`: nimmt `briefing + history + userInput`, produziert reinen Text-Stream. Keine Tool-Definitionen. AI-SDK `streamText` ohne `tools`-Parameter.
- [ ] Neue Datei `src/services/interviewAnalyst.ts`: nimmt `state + history + userInput + talkerOutput`, führt Wissens-Tool-Calls aus (`register_step`, `record_slot`, `update_walkthrough_data`, `link_bottleneck`, `update_topics`), produziert `Briefing`-Struktur via `produce_briefing`-Tool oder responseSchema.
- [ ] Neue Datei `src/services/interviewOrchestrator.ts`: nimmt `InterviewContext` und `analystSuggestion`, berechnet finale Phase via `decideNextPhase`-Funktion (siehe ADR-011 D4). Berechnet Briefing-Override falls Analyst-Briefing stale (`analyst_status != 'done'` für letzten Turn).
- [ ] Bestehende `src/services/interviewAgent.ts`: wird zur Fassade, die Talker/Analyst/Orchestrator orchestriert. Behält `createInterviewStream` als Public API für die Route.

### Tool-Migration

- [ ] Tools `register_step`, `record_slot`, `update_walkthrough_data`, `link_bottleneck`, `update_topics` wandern vollständig in `interviewAnalyst.ts`. Talker hat keinen Zugriff.
- [ ] Tools `transition_phase`, `enter_coverage_check`, `complete_interview` werden entfernt. Phase- und Lifecycle-Übergänge berechnet der Orchestrator deterministisch.
- [ ] Neues Tool oder responseSchema `produce_briefing` (Analyst-Output): `{ tactical_goal, target_slot, suggested_question, context_note, wrap_up_question_asked }`.

### Orchestrator-Logik

- [ ] `decideNextPhase(ctx, analystSuggestion)` implementiert die Phase-Übergänge gemäß ADR-011 D4. Unit-Tests mit Snapshot-Inputs decken alle Phasen-Übergänge ab.
- [ ] Hard-Stop bei `timerMinutes >= maxDurationMinutes` setzt `status='completed'` und `extractions_pending=true`.
- [ ] Soft-Confirm-Completion (ADR-011 D12): bei Phase `wrap_up` und `wrap_up_question_asked=true` im vorherigen Briefing und kein neuer Prozess vom Analyst erkannt, setzt Orchestrator `status='completed'`.
- [ ] `analyst_status='processing'` oder `'failed'` bei Eingang eines neuen Turns: Orchestrator triggert Catch-up-Lauf (Analyst verarbeitet zwei Turns gemeinsam) und tauscht stale Briefing gegen Phase-Default-Briefing für den aktuellen Talker-Turn.

### Talker-Prompt-Struktur (ADR-011 D2 + D7)

- [ ] System-Prompt enthält ausschließlich: Persona-Identität, Format-Regeln (max 5 positiv formulierte), ein Canonical Example. Ziel: < 500 Token statisch.
- [ ] Keine Negative Constraints (`NIEMALS`, `VERBOTEN`, `Falsch: …`). Alle bisherigen Anti-Patterns ersatzlos.
- [ ] Kein Phasen-Modell im System-Prompt. Phasen-Awareness läuft ausschließlich über das Briefing im User-Turn.
- [ ] Briefing wird im User-Turn vor der History injiziert (vgl. ADR-011 D2 Talker-Input-Komposition).
- [ ] User-Beitrag steht als letztes Message im Kontext. Talker reagiert primär darauf, Briefing ist Agenda-Ebene.

### Analyst-Prompt-Struktur

- [ ] Analyst-Prompt enthält: voller Tracker-State, Phase-Kontext, Tool-Definitionen für Wissens-Tools, Briefing-Schema, Anweisung zur Briefing-Planung für nächsten Turn.
- [ ] `READ_ONLY_STATE`-Framing aus ADR-009 D1 entfällt im Analyst, da Analyst genau die leeren Felder identifizieren und planen soll.
- [ ] Analyst hat keinen Output-Stream-Zugriff. Ergebnisse landen ausschließlich in der DB.

### Asynchrone Ausführung

- [ ] Talker-Endpoint nutzt `waitUntil()` für den Analyst-Run (ADR-011 D5). Endpoint returnt zum Client sobald Talker-Stream fertig ist.
- [ ] Bei Analyst-Failure: Wrapper schreibt `analyst_status='failed'` mit Error-Snapshot in `interview_state`. Nächster Turn-Handler erkennt das und startet Catch-up.
- [ ] Analyst-Run schreibt zum Abschluss `analyst_status='done'`, `last_processed_turn_index`, `next_briefing` in `interview_state`.

### DB-Schema-Erweiterung

- [ ] Migration: `interview_state.next_briefing JSONB`, `interview_state.analyst_status TEXT DEFAULT 'idle'`, `interview_state.last_processed_turn_index INT DEFAULT 0`.
- [ ] RLS-Policies erben bestehende Regeln (keine neuen Subjekte).
- [ ] Migration ist forward-only und backward-compatible (Default-Werte).

### Provider-Compiler-Layer (ADR-011 D6, Iteration 5)

- [ ] Neue Datei `src/services/providers/types.ts`: `ProviderCompiler`-Interface mit Methoden `compileSystemPrompt(briefing, persona) → string`, `compileToolSchema(tools) → unknown`, `getThinkingConfig(component) → object`.
- [ ] Implementierung `src/services/providers/gemini.ts`: nutzt klare Sektionen, OpenAPI-kompatible Tool-Schemas, `thinking_level` Config pro Komponente.
- [ ] Anthropic- und OpenAI-Compiler sind als Stubs vorbereitet (`anthropic.ts`, `openai.ts`), Implementierung in späteren PROJ-Iterationen.
- [ ] `resolveModel` in `src/lib/llm-provider.ts` wird erweitert, sodass Modell-String auch den passenden Compiler aktiviert.

### Modell-Allokation (ADR-011 D9)

- [ ] Talker-Default: `google/gemini-3.1-flash-lite` (vorläufig, eval-getrieben in Iteration 4 final entschieden).
- [ ] Analyst-Default: `google/gemini-3.5-flash` mit `thinking_level: 'medium'`.
- [ ] Konfiguration via `INTERVIEW_TALKER_MODEL` und `INTERVIEW_ANALYST_MODEL` env-vars, Fallback auf `INTERVIEW_MODEL` (Kompatibilität).
- [ ] Cross-Vendor-Test (Claude Haiku als Talker, Claude Sonnet als Analyst) ist in Iteration 4 dokumentiert, kein Hard-Requirement.

### Observability (ADR-011 D11)

- [ ] Drei separate Langfuse-Spans pro Turn: `interview.talker`, `interview.analyst`, `interview.orchestrator`.
- [ ] Tag `component` (Werte: `talker`, `analyst`, `orchestrator`) zusätzlich zu bestehenden Tags.
- [ ] Cost-Tracking pro Span via existierender `usage`-Telemetry.
- [ ] Briefing-Content als strukturiertes Attribut auf Analyst-Span (Snapshot für spätere Drift-Analyse).

### Eval-Gates (jede Iteration)

- [ ] Pro Iteration: ein Eval-Run gegen die PROJ-21-Baseline auf allen drei Personas und mindestens zwei Modellen.
- [ ] Eval-Gate für Merge: keine Regression > 5 Prozentpunkte in `slot_coverage`, `phase_adherence`, `tool_call_plausibility`. Verbesserung in mindestens einem Score erwartet.
- [ ] Eval-Report pro Iteration in `docs/evals/interview/PROJ-22/iteration-<n>/` archiviert.

## Out of Scope

- **Live API von Gemini (Voice nativ).** Bleibt ADR-010 D4 vorbehalten, nachgelagert.
- **Voice-Integration mit Talker-spezifischer Optimierung.** PROJ-7 bleibt unverändert. Talker-Modellwahl wird so getroffen, dass spätere Voice-Migration möglich ist (siehe ADR-011 D9).
- **Extraktion-Service-Refactor (PROJ-20).** Bleibt unverändert. Post-Interview-Extraction läuft weiter parallel.
- **Knowledge-Informed Interviewing (PROJ-19).** Wird vorbereitet aber nicht implementiert. Analyst-Architektur ist offen für Wissensgraph-Lookups im Briefing-Schritt.
- **UI-Anpassungen (PROJ-3).** Briefing-Drift oder Stale-Briefing werden nicht an den User kommuniziert. Keine UI-Änderung.
- **Migration zu Vercel Queues oder Inngest.** Bleibt bei `waitUntil()`. Migration nur falls Eval-Resultate Queue-Resilienz fordern.
- **Anthropic- und OpenAI-Compiler-Implementierung.** Stubs ja, vollständige Implementierung nicht in PROJ-22. Folge-PROJ falls Cross-Vendor-A/B-Tests in Iteration 4 dies rechtfertigen.

## Architektur-Notizen

### Iterative Implementierung (5 Schritte)

Jede Iteration ist ein eigenständiger PR mit Eval-Gate gegen PROJ-21-Baseline.

**Iteration 1 (D7-Talker, ~3 Tage):** Talker-Prompt-Refactor im Single-Call-Modell. Negative Constraints entfernen, Phase-Methodologie auf taktisches Briefing in der jeweiligen Phase verschlanken, Few-Shots auf ein Canonical Example. Noch keine Architektur-Trennung, nur Prompt-Shrink. Eval-Gate erwartet: deutliche Verbesserung auf `gemini-3.5-flash`, kein Regress auf Flash-Lite.

**Iteration 2 (D4 + D11 + D12, ~3 Tage):** Orchestrator-Modul extrahiert. `transition_phase`/`enter_coverage_check`/`complete_interview` werden im Talker entfernt, Orchestrator übernimmt deterministisch. Observability-Spans erweitert. Lifecycle-Übergang via Hard-Stop + Soft-Confirm. Eval-Gate erwartet: stabile oder bessere Phase-Adherence, keine Completion-Regression.

**Iteration 3 (D3 + D5 + D8 + D10, ~5 Tage):** Talker/Analyst-Split implementiert. `waitUntil` für Analyst-Background-Run. Native Reasoning-Steuerung (`thinking_level`). DB-Schema-Migration. Catch-up-Logik. Größte Iteration, hohes Risiko. Eval-Gate erwartet: vergleichbare oder bessere Qualität, niedrigere First-Token-Latenz.

**Iteration 4 (D9, ~2 Tage):** Modell-Allokation pro Komponente final festlegen. Cross-Vendor-Eval (Claude Sonnet als Analyst, Claude Haiku als Talker). Eval-Gate entscheidet Default-Modelle für Produktion.

**Iteration 5 (D6, ~3 Tage):** Provider-Compiler-Layer extrahiert. Gemini-Compiler vollständig, Anthropic-Stub. Refactor von `resolveModel`. Eval-Gate erwartet: kein Regress, sauberes Multi-Provider-Skelett.

Gesamt: ca. 16 Tage (3 Wochen kalendarisch mit Eval-Wartezeiten).

### Migration und Rollback

- Jede Iteration wird hinter ein Feature-Flag `INTERVIEW_DUAL_LOOP_ENABLED` gelegt, das per `.env.local` aktivierbar ist. Default false bis Iteration 3 erfolgreich.
- Rollback per Flag möglich bis Iteration 3 inkludiert. Ab Iteration 4 ist der Flag entfernt und der Code-Pfad einer.
- DB-Migration (`next_briefing`, `analyst_status`) ist forward-only mit Defaults, sodass alter Code weiter funktioniert.

### Bekannte Risiken und Mitigations

| Risiko | Mitigation |
|---|---|
| Briefing-Drift bei schnellen User-Turns | Phase-Default-Briefing als Fallback (ADR-011 D2 Schutzmechanismus 3) |
| Analyst-Crashes verlieren Tracker-Updates | Catch-up im nächsten Turn, `analyst_status='failed'`-Erkennung |
| Talker reagiert nicht auf User-Beitrag | Explizite Talker-Aufgaben-Regel: "Reagiere primär auf den aktuellen Beitrag" (ADR-011 D2 Klärung) |
| Modell-Wechsel bricht Tracker-Konsistenz | Provider-Compiler-Interface in Iteration 5, vor Cross-Vendor-Wechsel |
| Phase-Default-Briefing zu generisch | Pro Phase ein vorgefertigtes Briefing mit phasen-typischer Frage, basierend auf aktueller PROJ-8/ADR-009-Methodologie |

### Persistenz-Modell

- Tracker bleibt in `interview_state.step_tracker` als JSONB (kein Event-Sourcing).
- `next_briefing` wird bei jedem erfolgreichen Analyst-Run überschrieben, kein History-Log.
- `analyst_status` ist Enum: `idle | processing | done | failed`. Bei `failed`: zusätzlicher Error-Snapshot in `analyst_error` (TEXT, nullable).
- Bei Interview-Reconnect: Orchestrator liest aktuellen State, nutzt verfügbares Briefing oder Default.

## Referenzen

- ADR-011: Dual-Loop Interview Architektur (Source of Truth für alle architektonischen Entscheidungen)
- ADR-009: Kontext-Architektur, Observable State (D1 READ_ONLY_STATE betrifft nur noch Talker, im Analyst entfällt)
- ADR-007: Prompt-Strukturreform (wird durch D7 in Iteration 1 ergänzt/teilweise ersetzt)
- PROJ-2: Interview Engine Backend (wird durch diese Revision grundlegend umgebaut, bleibt formal als Epic erhalten)
- PROJ-8: Interview-Design Optimierung (Negative Constraints/Few-Shots werden in Iteration 1 entfernt, PROJ-8 als superseded markiert)
- PROJ-21: Eval-Foundation (Mess-Instrument für die fünf Iterations-Gates)
- PROJ-7: Voice Input (nicht direkt betroffen, aber Talker-Modellwahl beeinflusst Voice-Eignung)
- Research-Bericht: `docs/Prompting-Strategien_für_deutsche_Multi-Turn-Agenten.md`
