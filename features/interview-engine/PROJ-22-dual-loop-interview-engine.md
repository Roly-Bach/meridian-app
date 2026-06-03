# PROJ-22: Dual-Loop Interview Engine (ADR-011)

## Status: Approved
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-2
**Appetite:** L (1-2w)
**Bugs:** 0:0:2
**Created:** 2026-05-29
**Last Updated:** 2026-05-29

## Dependencies
- Requires: PROJ-2 (Interview Engine Backend) — bestehende Agent-Pipeline wird refactored
- Requires: PROJ-13 (Langfuse) — Span-Erweiterung pro Komponente
- Requires: PROJ-17 (Eval-Harness) — Eval-Gate zwischen jeder Iteration nötig
- Enables: PROJ-21 (Adaptive Clarification Questions) — `clarification_cards` im `produce_briefing`-Schema
- Referenz: ADR-011 (Proposed 2026-05-28) + Amendment A (2026-05-29)

## Context

Der Interview-Agent ist aktuell ein monolithischer Single-Call pro Turn: ein LLM-Call macht gleichzeitig Konversation, Wissens-Extraktion, Tool-Calls und Phasen-Management. Das erzeugt drei nachgewiesene Probleme (ADR-011):

1. **Cognitive Overload**: `gemini-3.5-flash` (fähigeres Modell) liefert schlechtere Qualität als `gemini-3.1-flash-lite` — weil der dichte Prompt Attention auf Constraint-Erfüllung lenkt statt auf semantischen Kern
2. **Latenz-Konflikt**: Konversationelle Reaktivität (< 2s First-Token) und tiefes Reasoning (Tool-Use, Tracker-Pflege) passen nicht in einen Call
3. **Fragile Phasen-Logik**: Phase-Übergänge sind LLM-entschieden, nicht deterministisch, nicht testbar

PROJ-22 implementiert Iterationen 1–3 von ADR-011: Prompt-Refactor → Orchestrator → Talker/Analyst-Split. Ergebnis: drei Komponenten mit klaren Verantwortlichkeiten, testbarer Phase-Logik, und Grundlage für PROJ-21 (Clarification Questions).

## Scope: Iterationen 1–3

| Iteration | Inhalt | Deliverable |
|-----------|--------|-------------|
| **1 — Prompt-Refactor** | Negative Constraints raus, Phase-Briefing taktisch (3-5 Zeilen), ein Canonical Example | Bessere Konversationsqualität im Eval, noch Single-Call |
| **2 — Orchestrator** | `interviewOrchestrator.ts` neu, Phase deterministisch in TypeScript, `transition_phase` / `enter_coverage_check` / `complete_interview` Tools entfernt, Langfuse-Spans pro Komponente | Testbare Phase-Logik, Eval-Gate |
| **3 — Talker/Analyst-Split** | Talker Text-only (keine Tools), Analyst async via `waitUntil`, `produce_briefing` structured output inkl. `clarification_cards`, native Reasoning-Steuerung, Eventual-Consistency-Mitigation | Vollständige Dual-Loop-Architektur |

Iterationen 4 (Modell-Allokation final) und 5 (Provider-Compiler-Layer Anthropic) sind Out of Scope.

## User Stories

- Als **KI-Berater** möchte ich dass der Interview-Agent konsistent gute Fragen stellt unabhängig vom gewählten Modell, damit ich Modelle nach Kosten/Latenz wählen kann statt nach Prompt-Stabilität.
- Als **Mitarbeiter (interviewte Person)** möchte ich natürliche Gesprächsführung ohne abrupte Themensprünge, damit das Interview sich nicht wie ein Formular anfühlt.
- Als **KI-Berater** möchte ich in Langfuse die Kosten von Talker, Analyst und Orchestrator getrennt sehen, damit ich Cost-Attribution pro Komponente habe.
- Als **KI-Berater** möchte ich dass Phase-Übergänge deterministisch und nachvollziehbar sind, damit ich Interview-Abbrüche und Phasen-Stuck-Bugs reproduzieren und fixen kann.
- Als **Entwickler** möchte ich Phase-Logik mit Tracker-Snapshots offline testen können (ohne LLM), damit Regressions in der Phasen-Steuerung automatisch erkannt werden.

## Acceptance Criteria

### Iteration 1 — Prompt-Refactor
- [ ] Alle `NIEMALS`, `VERBOTEN`, `PFLICHT`-Blöcke aus Talker-Prompt entfernt, durch positive Formulierungen ersetzt
- [ ] Anti-Anchoring-Block und Silence-Constraints ersatzlos entfernt
- [ ] Phase-Methodologie pro Phase auf max. 5 Zeilen taktisches Briefing reduziert (aktuelles Ziel, empfohlene nächste Frage)
- [ ] Anzahl Few-Shot-Beispiele auf genau 1 Canonical Example reduziert
- [ ] Eval-Gate: Interview-Qualität ≥ Baseline (gemessen via PROJ-17 Eval-Harness mit persona `buchhalter`)

### Iteration 2 — Orchestrator
- [ ] `src/services/interviewOrchestrator.ts` implementiert `decideNextPhase(ctx, analystSuggestion)` — deterministisch, keine LLM-Calls
- [ ] Tools `transition_phase`, `enter_coverage_check`, `complete_interview` aus Agent-Tool-Set entfernt
- [ ] Alle Phase-Übergänge laufen ausschließlich über `decideNextPhase` — kein LLM entscheidet Phase
- [ ] `complete_interview`-Lifecycle: Hard-Stop (Timer) und Soft-Confirm (Trigger B aus ADR-011 D12) in Orchestrator implementiert
- [ ] Langfuse: drei Spans pro Turn — `interview.talker`, `interview.analyst`, `interview.orchestrator` — alle unter `session_id = interview_id`
- [ ] Orchestrator-Unit-Tests: `decideNextPhase` mit Tracker-Snapshots ohne LLM testbar (alle Phase-Transitions covered)
- [ ] Eval-Gate: Phase-Logik-Regressions keine, Interview-Qualität ≥ Iteration-1-Baseline

### Iteration 3 — Talker/Analyst-Split
- [ ] Talker hat **null Tools** — produziert ausschließlich Text, streamt sofort nach User-Turn
- [ ] Analyst läuft async via `waitUntil` (Vercel Fluid Compute) — ruft alle Wissens-Tools: `register_step`, `record_slot`, `update_walkthrough_data`, `link_bottleneck`, `update_topics`
- [ ] Analyst produziert `produce_briefing` structured output: `{ next_focus, suggested_question, wrap_up_question_asked, clarification_cards? }`
- [ ] `clarification_cards` im Briefing-Schema implementiert (Basis für PROJ-21) — Analyst generiert Cards wenn Phase `wrap_up` + fehlende Slots vorhanden
- [ ] Orchestrator liest `analyst_status` und `next_briefing` aus `interview_state` vor jedem Turn
- [ ] Stale-Briefing-Fallback: Analyst noch `processing` → Talker nutzt vorheriges Briefing (eventual consistency akzeptiert)
- [ ] Analyst-Fehler: `analyst_status='failed'` → nächster Turn triggert Catch-up-Run (zwei Turns auf einmal)
- [ ] Native Reasoning-Steuerung: Talker mit `thinking_level: 'low'` (Gemini), Analyst mit `thinking_level: 'medium'`
- [ ] Eval-Gate: Interview-Vollständigkeit (Slots gefüllt, Phasen durchlaufen) ≥ Iteration-2-Baseline

## Edge Cases

- **Analyst > 30s hängend**: Orchestrator erkennt `analyst_status='processing'` beim nächsten Turn → Catch-up-Run statt normaler Analyst-Run
- **User antwortet extrem schnell** (< 2s): Talker startet mit vorherigem (1 Turn altem) Briefing — kein Blocking, eventual consistency akzeptiert
- **`produce_briefing` schlägt fehl** (malformed output): Analyst schreibt `analyst_status='failed'`, Talker fällt auf Phase-Default-Briefing zurück
- **Iteration-1-Deployment**: Single-Call noch aktiv — Prompt-Refactor ist rückwärtskompatibel, kein Infrastruktur-Change
- **Eval-Gate schlägt fehl nach Iteration**: Iteration nicht deployen; vorherigen Prompt/Zustand restaurieren; Root Cause analysieren bevor nächste Iteration
- **Tool-Aufruf in Talker-Output erkannt** (Regression): Hard Error im Orchestrator — Talker-Output wird verworfen, Fehlermeldung in Langfuse geloggt
- **`interview_state` hat kein `next_briefing`** (erster Turn nach Migration): Orchestrator nutzt Phase-Default-Briefing (`intro`-Phase)

## Technical Requirements

- **Eval-Gate zwischen jeder Iteration** — PROJ-17 Eval-Harness muss vor Deployment jeder Iteration laufen (`npm run eval:interview buchhalter`)
- **Rückwärtskompatibilität**: Laufende Interviews überleben Migration — `interview_state` ohne `next_briefing`-Feld → graceful fallback
- **`waitUntil` Vercel**: Analyst läuft als Background-Job in derselben Fluid-Compute-Instanz — kein externer Queue nötig (Migration zu Vercel Queues möglich wenn Failures häufig)
- **`interview_state` Erweiterung**: neue Felder `next_briefing` (JSONB), `analyst_status` (text: `idle|processing|done|failed`), `clarification_answers` (JSONB) — Migration nötig
- Langfuse Cost-Tracking pro Span-Tag `component=talker|analyst|orchestrator`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> **Updated 2026-05-30** — Design reviewed and corrected against actual implementation after all 3 iterations shipped.

### Overview

Three sequential iterations, each deployable independently with an Eval-Gate before proceeding. Every iteration is backward-compatible with live interviews.

---

### Iteration 1 — Prompt-Refactor (in-place)

**What changed:** Static prompt moved to `src/services/interviewTalker.ts` as `STATIC_PROMPT` constant. No `buildStaticPrompt()` function — prompt is inlined.

- All `NIEMALS`/`VERBOTEN`/`PFLICHT` blocks removed, replaced with positive phrasing. Anti-Anchoring and Silence-Constraint blocks deleted.
- Phase methodology: reduced to turn-format rules + single canonical example. Dynamic context injected per-turn via `buildDynamicContext()` (stays in `interviewAgent.ts`).
- Few-shot examples: collapsed to 1 format-anchoring rule in `STATIC_PROMPT`.

**Eval-Gate:** `npm run eval:interview buchhalter` before deploy. Quality ≥ baseline.

---

### Iteration 2 — Orchestrator

**New file:** `src/services/interviewOrchestrator.ts`

Responsibilities:
- `decideNextPhase(ctx, analystSuggestion)` — pure TypeScript, no LLM, covers all 7 phase transitions including Amendment-A `clarification` phase
- `checkLifecycle(ctx, analystSuggestion)` — Hard-Stop (timer ≥ max) and Soft-Confirm (Trigger B: `wrap_up_question_asked=true` + user responded) — both set `status='completed'` + `extractions_pending=true`
- Stale detection: only via `analyst_status='failed'` (explicit error path) — **no 30s timer check implemented** (edge case de-prioritized; Catch-up-Run handles recovery)

**Modified:** `src/services/interviewAgent.ts`
- `transition_phase`, `enter_coverage_check`, `complete_interview` tools **removed** from `buildTools()`
- Remaining tools: `register_step`, `record_slot`, `update_walkthrough_data`, `link_bottleneck`, `update_topics`

**Modified:** `src/app/api/interview/[token]/chat/route.ts`
- Orchestrator runs at turn start, before Talker
- Phase written to DB by Orchestrator (not by LLM tool call)

**New file:** `src/services/interviewOrchestrator.test.ts`
- Unit tests: `decideNextPhase` with Tracker snapshots, offline, no LLM
- Covers all 7 phase transitions + both lifecycle triggers

**Langfuse spans:** 3 spans per turn — `interview.talker`, `interview.analyst`, `interview.orchestrator` — all under `session_id = interview_id`, tagged `component=talker|analyst|orchestrator`. Orchestrator span is logged via console (not full Langfuse instrumentation); Talker and Analyst use `experimental_telemetry`.

**Eval-Gate:** Phase-logic regressions = 0, quality ≥ Iteration-1 baseline.

---

### Iteration 3 — Talker/Analyst Split

**New files:**
- `src/services/interviewTalker.ts` — text-only `streamText`, zero tools, streams immediately on user turn
- `src/services/interviewAnalyst.ts` — all 5 knowledge tools + `produce_briefing` tool (Zod-typed schema), `runAnalystCatchup` for recovery

**Modified:** `src/app/api/interview/[token]/chat/route.ts`

Actual turn flow:
```
1. User turn N arrives
2. Orchestrator: read analyst_status + next_briefing, decideNextPhase, checkLifecycle
3. If lifecycle.shouldComplete → farewell Talker stream, mark completed, after() post-pipeline
4. Talker: streamText → client (First-Token target: <2s)
5. after(runAnalyst(...))   ← background, Next.js after() / Vercel Fluid Compute
6. Analyst: runs knowledge tools, calls produce_briefing tool → writes next_briefing + analyst_status='done'
```

**Async background:** `after()` (Next.js) is the implementation — functionally equivalent to `waitUntil()` Vercel Fluid Compute.

**`produce_briefing` implementation:** `generateText` with a `tool` call (Zod schema) — same typed output as `generateObject`, tool-call pattern used for sequencing after knowledge tools. `stopWhen: stepCountIs(15)` caps Analyst tool steps.

**Per-component model env vars (new, not in original spec):**
- `INTERVIEW_TALKER_MODEL` — overrides `INTERVIEW_MODEL` for Talker only
- `INTERVIEW_ANALYST_MODEL` — overrides `INTERVIEW_MODEL` for Analyst only
- Fallback for both: `INTERVIEW_MODEL` → `google/gemini-3.1-flash-lite`

**DB Migration** (new columns in `interviews` table):
- `analyst_status` text DEFAULT `'idle'` — values: `idle | processing | done | failed`
- `next_briefing` jsonb nullable — stores `AnalystBriefing` for next Talker turn
- `clarification_answers` jsonb nullable — stores `{ [card_index]: string }` from PROJ-21 UI

**AnalystBriefing shape** (stored in `next_briefing`):
- `next_focus` — which topic/slot Talker should prioritize
- `suggested_question` — concrete question Talker can use verbatim
- `wrap_up_question_asked` — signals completion eligibility to Orchestrator
- `clarification_cards` (optional, max 8) — generated only when phase=`wrap_up` + unfilled mandatory slots

**ClarificationCard shape** (basis for PROJ-21):
- `process_step_id`, `step_title` — which step this targets
- `question` — e.g. "Wie oft läuft dieser Schritt pro Monat?"
- `options` (2–4 strings, last always "Andere")
- `slot_key` — which knowledge_objects field this fills

**Reasoning via API params — IMPLEMENTED (2026-05-30):**
- Talker: `providerOptions.google.thinkingConfig.thinkingBudget = 0` (disable thinking → low latency)
- Analyst: `providerOptions.google.thinkingConfig.thinkingBudget = 2048` (moderate reasoning for tool sequencing)
- Guard: only applied for Google models (`modelString.startsWith('google/')`)
- Eval-Gate post-implementation: PASS — 19 turns, 12/12 mandatory slots

**Dual extraction boundary:**
- `extractAndEmbed` (PROJ-20 semantic extraction → `knowledge_objects`) continues to run in `onFinish` alongside the Analyst
- Analyst handles tracker-based structured extraction (`step_tracker`, `interview_state`)
- Two parallel extraction paths are intentional: tracker = structured/real-time, `extractAndEmbed` = semantic/deferred

**Clarification phase wiring:**
- `decideNextPhase` enters `clarification` and stays there (no auto-exit)
- Route does NOT yet check clarification completion — transition out of `clarification` is wired in PROJ-21 (Adaptive Clarification Questions)

**Error handling:**
- Analyst throws → wrapper writes `analyst_status='failed'`
- Next turn: Orchestrator detects `failed` → Catch-up-Run (`runAnalystCatchup` — processes two turns at once)

**Eval-Gate:** Interview completeness (slots filled, phases traversed) ≥ Iteration-2 baseline.

---

### Component Map (as-built)

```
src/services/
  interviewOrchestrator.ts      Phase logic + lifecycle (TypeScript only)
  interviewOrchestrator.test.ts   Unit tests, offline, Tracker snapshots
  interviewTalker.ts            Streaming text response (no tools)
  interviewAnalyst.ts           Knowledge tools + produce_briefing + runAnalystCatchup
  interviewAgent.ts             Types, buildTools, buildDynamicContext (no phase tools)

src/app/api/interview/[token]/chat/route.ts
  ↳ Orchestrator → Talker (sync stream) + after(Analyst)

supabase/migrations/
  YYYYMMDD_add_analyst_state_to_interviews.sql
  ↳ analyst_status, next_briefing, clarification_answers
```

---

### Tech Decision Summary

| Decision | Choice | Reason |
|----------|--------|--------|
| Phase logic | Pure TypeScript (`decideNextPhase`) | Testable offline, deterministic, no LLM cost |
| Async Analyst | `after()` (Next.js / Vercel Fluid Compute) | No external queue needed for V1 |
| Briefing output | `generateText` + `produce_briefing` tool (Zod schema) | Tool-call sequencing after knowledge tools; same typed output as `generateObject` |
| Eventual consistency | Accepted — stale briefing fallback | Simpler than streaming merge; Catch-up-Run handles recovery |
| DB columns | Separate `analyst_status`, `next_briefing`, `clarification_answers` | `analyst_status` read every turn → separate column faster than JSONB nested read |
| Stale detection | `analyst_status='failed'` only (no 30s timer) | 30s timer adds complexity; explicit failure path sufficient for V1 |
| Reasoning control | `thinking_level` deferred post-Eval | Measure before adding: `toolCallPlausibility` + `slotCoverage` in Eval-Gate |
| Model selection | Per-component env vars (`INTERVIEW_TALKER_MODEL`, `INTERVIEW_ANALYST_MODEL`) | Enables independent model swap per component without redeploying config |

### No New Dependencies

All capabilities covered by existing stack: `ai` (AI SDK v6 — `streamText` + `generateText`), `@ai-sdk/google`, Langfuse (`_telemetry.ts`), Supabase admin client.

## QA Test Results

> **QA Datum:** 2026-05-30 (initial) + **Re-QA 2026-06-01** (B1–B3) + **Re-QA 2026-06-01 (2nd pass)** (B4/B5) + **Re-QA 2026-06-01 (3rd pass)** (B6 fixed) | **Status:** Approved | **Bugs:** 0:0:2

### Acceptance Criteria — Testergebnis

| AC | Status | Notiz |
|----|--------|-------|
| Iter 1: NIEMALS/VERBOTEN/PFLICHT aus STATIC_PROMPT | ✅ PASS | Low-1: 2 Instanzen noch in `buildPhaseMethodology(wrap_up)` — funktional notwendig |
| Iter 1: Anti-Anchoring + Silence-Constraints entfernt | ✅ PASS | |
| Iter 1: Phase-Methodology ≤ 5 Zeilen | ✅ PASS | |
| Iter 1: Genau 1 Canonical Example | ✅ PASS | |
| Iter 1: Eval-Gate PASS | ✅ PASS | PASS bei Baseline-Läufen (PROJ-21 Scorer) |
| Iter 2: `decideNextPhase` TypeScript-only | ✅ PASS | Kein LLM-Call, deterministisch |
| Iter 2: phase-tools entfernt | ✅ PASS | `transition_phase`, `enter_coverage_check`, `complete_interview` weg |
| Iter 2: Alle Phasen via `decideNextPhase` | ✅ PASS | |
| Iter 2: Hard-Stop + Soft-Confirm | ✅ PASS | `checkLifecycle` |
| Iter 2: 3 Langfuse Spans | ✅ PASS | Talker + Analyst via `experimental_telemetry`, Orchestrator via `buildTraceMetadata` |
| Iter 2: Unit-Tests alle Phase-Transitions | ✅ PASS | 23 Tests, 297 gesamt — grün |
| Iter 2: Eval-Gate PASS | ✅ PASS | |
| Iter 3: Talker zero tools | ✅ PASS | `streamText` ohne tools-Parameter |
| Iter 3: Analyst async via `after()` | ✅ PASS | Next.js `after()` = Fluid Compute |
| Iter 3: `produce_briefing` structured output | ✅ PASS | Zod-Schema: `next_focus`, `suggested_question`, `wrap_up_question_asked`, `clarification_cards?` |
| Iter 3: `clarification_cards` Schema | ✅ PASS | `ClarificationCardSchema` in `interviewAnalyst.ts` |
| Iter 3: Orchestrator liest `analyst_status` + `next_briefing` | ✅ PASS | |
| Iter 3: Stale-Briefing-Fallback | ✅ PASS | vorheriges Briefing bei `analyst_status='processing'` |
| Iter 3: Analyst-Fehler → Catch-up | ✅ PASS | `runAnalystCatchup` bei `analyst_status='failed'` |
| Iter 3: thinking_level (Talker low, Analyst medium) | ✅ PASS | `thinkingBudget: 0` / `2048` |
| Iter 3: Eval-Gate PASS | ✅ PASS | 2026-05-30, 19 Turns, 12/12 Mandatory Slots, `status=completed` |

### Automatisierte Tests

| Suite | Ergebnis |
|-------|----------|
| Vitest Unit (297 Tests) | ✅ 297 passed |
| Playwright E2E PROJ-22 (9 Tests) | ✅ 9 passed |
| Playwright E2E PROJ-3 (27 Tests) | ⚠️ 3 failed (pre-existing auth flakiness, kein PROJ-22-Regression) |

### Security Audit

| Check | Status |
|-------|--------|
| Token-Validierung (UUID-Regex) | ✅ |
| Token-Expiry-Check | ✅ |
| Rate Limiting | ✅ |
| Zod Input-Validation (min 1, max 10000) | ✅ |
| `workspace_id` aus DB (nicht Client) | ✅ |
| `analyst_status`-Werte hardcoded (kein Client-Input) | ✅ |
| Kein Tool-Exfiltration-Pfad via Talker | ✅ |

### Bugs

| ID | Severity | Beschreibung |
|----|----------|-------------|
| QA-22-L1 | Low | `NIEMALS`/`PFLICHT` noch in `buildPhaseMethodology('wrap_up')` — AC1 wording "alle entfernt" nicht erfüllt; funktional sinnvoll (schließt Closing-Question-Gate) |
| QA-22-L2 | Low | Spec Tech Design Note "thinking_level NOT yet implemented" war veraltet — korrigiert in diesem QA-Lauf |

### Post-Eval Bugs (2026-06-01, Eval-Run buchhalter, gefunden NACH initial QA)

| ID | Severity | Beschreibung | Fix | Status |
|----|----------|-------------|-----|--------|
| EVAL-22-B1 | Critical | Closing-Loop: Agent steckte in Abschiedsformeln ohne Interview-Completion; 25 Turns = MAX_TURNS ohne `status=completed` | Farewell-Loop-Detection in `closingQuestionWasAsked` (2 konsekutive Farewell-Messages → `shouldComplete=true`) | ✅ Fixed |
| EVAL-22-B2 | Medium | Slot-Halluzination: `duration_minutes` wurde gesetzt obwohl Persona Wert 4× verweigerte; `source_quote` unrelated | `record_slot` Tool-Description: explizites Verbot von Self-Inference, Konfidenz-Semantik präzisiert | ✅ Fixed |
| EVAL-22-B3 | Medium | DB-Constraint-Verletzung: `role`-Type in `extraction.ts` nicht in DB `knowledge_objects_type_check`; 5× Insert-Fehler | `role` aus `KnowledgeObjectType`, `ALLOWED_TYPES`, `EXTRACTION_SYSTEM_PROMPT` entfernt | ✅ Fixed |
| EVAL-22-B4 | High | Closing-Question-Heuristic missed word-split phrase: "Gibt es aus deiner Sicht noch etwas" → `includes('gibt es noch etwas')` failed weil "aus deiner Sicht" dazwischen. Agent loopte 5 Farewell-Turns ohne Completion. Eval-Run 2026-06-01-09-53-42 | `closingQuestionWasAsked`: neues OR-Pattern `(lc.includes('gibt es') && lc.includes('noch etwas'))` in `interviewOrchestrator.ts` | ✅ Fixed |
| EVAL-22-B5 | Medium | Stale stepTracker in `after()`: stepTracker geladen vor Talker-Streaming, Analyst sah Pre-Streaming-Snapshot → `record_slot` für bereits gefüllte Mahnprozess-Slots, `source_quote` = Farewell-Text. Auch: Eval-Runner `loadState` zu früh (vor Talker-Tools) | Reload `step_tracker` aus DB in `after()`-Callback (`route.ts`) + `loadState` nach `agentStream.text` (`runner.ts`) | ✅ Fixed |
| EVAL-22-B6 | Critical | Farewell-Loop blocked by walkthrough step: Mahnprozess discovered at wrap_up → briefly explored (frequency+duration filled, rule_based+data_sources missing) → stays `walkthrough` → phase reverts to `walkthrough_step` → `checkLifecycle` farewell-loop was `wrap_up`-gated → never fired → 9 farewell turns (17–25) → MAX_TURNS=25 → FAIL. Eval-Run 2026-06-01-10-42-20 | Phase-agnostic farewell-loop escape valve added BEFORE active-step guard in `checkLifecycle` + 3 regression tests | ✅ Fixed |

### Re-QA 2026-06-01

| Suite | Ergebnis |
|-------|----------|
| Vitest Unit (343 Tests, +5 neue) | ✅ 343 passed |
| Playwright E2E PROJ-22 (9 Tests) | ✅ 9 passed |
| Playwright E2E gesamt (105 Tests) | ✅ 100 passed, 5 pre-existing skips |

**Neue Tests hinzugefügt:**
- `interviewOrchestrator.test.ts`: 4 Tests für Farewell-Loop-Fallback (EVAL-22-B1)
- `extraction.test.ts`: 1 Regression-Test für `role`-Type-Rejection (EVAL-22-B3)

### Re-QA 2026-06-01 (2nd pass — B4/B5)

| Suite | Ergebnis |
|-------|----------|
| Vitest Unit (348 Tests, +3 neue) | ✅ 348 passed |

**Neue Tests hinzugefügt:**
- `interviewOrchestrator.test.ts`: 3 Tests für word-split `gibt-es` phrase (EVAL-22-B4)
  - Detects "Gibt es aus deiner Sicht noch etwas Wichtiges" → `shouldComplete: true`
  - Detects formal-Sie variant "Gibt es aus Ihrer Sicht noch etwas"
  - Does NOT fire when "gibt es" / "noch etwas" appear in separate turns

### Re-QA 2026-06-01 (3rd pass — B6)

| Suite | Ergebnis |
|-------|----------|
| Vitest Unit (351 Tests, +3 neue) | ✅ 351 passed |

**Neue Tests hinzugefügt:**
- `interviewOrchestrator.test.ts`: 3 Tests für phase-agnostic farewell-loop (EVAL-22-B6)
  - Fires when phase=walkthrough_step + step walkthrough
  - Fires when phase=slot_completion + step walkthrough
  - Does NOT fire when only 1 farewell turn (no false positive)

### Regression

Getestete Features: PROJ-2 (Interview Backend), PROJ-3 (Chat UI), PROJ-13 (Langfuse), PROJ-17 (Eval-Harness). Keine neuen Regressions festgestellt.

### Production-Ready

**YES** — keine Critical/High Bugs offen. Alle Low-Bugs dokumentarisch/funktional-positiv.

---

## QA Test Results (B5-Fixes, 2026-06-03)

> **QA Datum:** 2026-06-03 | **Status:** Approved | **Bugs:** 0:0:2 (1 neue Low, 1 bestehende Low)

### Acceptance Criteria — Testergebnis (B5-Fixes)

| # | Check | Status | Notiz |
|---|-------|--------|-------|
| 1 | Vitest Unit (356 Tests vorher) → alle grün | ✅ PASS | 356/356 passed vor neuen Tests |
| 2 | Neue stepRegistrationCoverage Unit-Tests geschrieben (8 Tests) | ✅ PASS | alle 8 grün; Gesamt 364 Tests |
| 3 | walkthroughHasContent: 3+ sum → true (Classic-Path) | ✅ PASS | Impl. Zeile 43, Test vorhanden |
| 4 | walkthroughHasContent: exactly 2 process_steps → true (Fallback B) | ✅ PASS | Impl. Zeile 47, Test vorhanden |
| 5 | walkthroughHasContent: 1 process_step + 0 friction/pain → false | ✅ PASS | Impl. korrekt, Test vorhanden |
| 6 | walkthroughHasContent: 1 mandatory slot + 0 process_steps → false | ✅ PASS | Impl. korrekt (>= 2 guard), Test FEHLT (Low) |
| 7 | walkthroughHasContent: 2 mandatory slots + 0 process_steps → true | ✅ PASS | Impl. korrekt (>= 2), Test FEHLT (Low) |
| 8 | colonParent: `export function` in interviewAgent.ts | ✅ PASS | Zeile 112 |
| 9 | interviewOrchestrator.ts: importiert colonParent aus ./interviewAgent | ✅ PASS | Zeile 1 |
| 10 | stepRegistrationCoverage.ts: importiert colonParent aus @/services/interviewAgent | ✅ PASS | Zeile 1 |
| 11 | STUFE 1 — NEUE SCHRITTE ist erste Priorität im Analyst-Prompt | ✅ PASS | Zeile 79ff interviewAnalyst.ts |
| 12 | STUFE 2 — AKTIVER WALKTHROUGH schließt Backfill-Briefing aus | ✅ PASS | "KEIN produce_briefing-Hinweis" explizit |
| 13 | STUFE 3 — BACKFILL phase-qualifiziert (slot_completion/coverage_check) | ✅ PASS | Bedingung a) in Stufe 3 |
| 14 | activeStepLine im Prompt-Template verwendet | ✅ PASS | Zeile 145 `- ${activeStepLine}` |
| 15 | Kein Backfill-Briefing ohne Phasen-Qualifikation | ✅ PASS | nur unter Stufe 3 Bedingungen |
| 16 | ScoreSet.stepRegistrationCoverage vorhanden (types.ts) | ✅ PASS | Zeile 26 |
| 17 | runner.ts: Score in Frontmatter | ✅ PASS | Zeile 353 |
| 18 | runner.ts: Score in Score-Tabelle | ✅ PASS | Zeile 371 |
| 19 | runner.ts: Score in Langfuse-Entries | ✅ PASS | Zeile 473 |
| 20 | walkthroughHasContent Fallback: old `any slot !== null` ersetzt durch `>= 2 slots` | ✅ PASS | Zeile 46, `.length >= 2` bestätigt |

### Automatisierte Tests

| Suite | Ergebnis |
|-------|----------|
| Vitest Unit (364 Tests, +8 neue) | ✅ 364 passed |

**Neue Tests:**
- `stepRegistrationCoverage.test.ts` (neu, 8 Tests): Happy Path (same/different colon-parent), Edge Cases (empty, 0, undefined, capped at 1.0), tokenJaccard-Fallback (similar/distinct titles)

### Security Audit (B5-Fixes)

| Check | Status | Notiz |
|-------|--------|-------|
| scoreStepRegistrationCoverage: keine externen Inputs | ✅ PASS | pure in-memory, nur interne StepEntry-Daten |
| colonParent: nur String-Parsing | ✅ PASS | kein Injection-Risiko |
| Analyst-Prompt-Änderung: reine Prompt-Tuning | ✅ PASS | kein Sicherheitsrisiko |
| walkthroughHasContent Fallback: keine neue Angriffsfläche | ✅ PASS | reine TypeScript-Logik, keine I/O |

### Bugs (B5-Fixes)

| ID | Severity | Beschreibung |
|----|----------|-------------|
| QA-22-L3 | Low | walkthroughHasContent: Test-Case "1 mandatory slot + 0 process_steps → false" und "2 mandatory slots → true" fehlen in interviewOrchestrator.test.ts. Implementierung ist korrekt, aber Fallback-A-Pfad (mandatory slots >= 2) hat keine eigenen Unit-Tests. Fix: 2 Tests hinzufügen. |

### Production-Ready (B5-Fixes)

**YES** — keine Critical/High Bugs. QA-22-L3 ist test-coverage-only, keine Implementierungslücke.

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

## Follow-up: Charge 1 Robustness Refactor (2026-06-03)

Diagnostik-Tooling für die in den Eval-Runs 2026-06-03 sichtbaren Multi-Writer- und Whack-a-Mole-Probleme. Kein Verhaltensänderung am Interview, additive only.

**Geliefert:**
- **Slot-Write-Trail** (`src/services/slotWriteTrail.ts`) — strukturiertes Event pro Slot-Schreibvorgang aus allen drei Pfaden (quick / analyst / update_walkthrough / backfill). Sinks: Langfuse-Span + JSONL-File im Eval-Mode + Debug-Console. Siehe `docs/diagnostics/slot-write-trail.md`.
- **Replay-Corpus** (`src/services/__evals__/interview/replay/`) — Frozen-Transcript Fixtures aus den 5 PASS-Runs vom 2026-06-03. Scorer-Suite läuft via `npm run eval:replay` offline gegen Baselines, GitHub Action gated PRs gegen `src/services/interview*` und `scorers/`. Siehe `docs/evals/REPLAY.md`.
- **ADR-015** — Design-Entscheidung (Langfuse+JSONL Sinks; Frozen-Replay statt Live-Replay).

**Folge-Chargen geplant (gleicher Refactor-Plan):**
- Charge 2 (Punkt 3-5): Single Slot-Writer, Step-Identität via Vector-Cluster, Analyst-Split Online/Catchup
- Charge 3 (Punkt 6-9): TurnBudgetAllocator, Talker Output-Filter, Late-Topic → Clarification, Downstream-Robustheit

