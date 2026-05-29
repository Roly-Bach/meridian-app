# PROJ-22: Dual-Loop Interview Engine (ADR-011)

## Status: In Progress
**Type:** Revision
**Domain:** Interview Engine
**Extends:** PROJ-2
**Appetite:** L (1-2w)
**Bugs:** —
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

### Overview

Three sequential iterations, each deployable independently with an Eval-Gate before proceeding. Every iteration is backward-compatible with live interviews.

---

### Iteration 1 — Prompt-Refactor (in-place)

**What changes:** `src/services/interviewAgent.ts` only — no new files, no DB changes.

- `buildStaticPrompt()`: All `NIEMALS`/`VERBOTEN`/`PFLICHT` blocks removed, replaced with positive phrasing. Anti-Anchoring and Silence-Constraint blocks deleted entirely.
- `buildPhaseMethodology()`: Each phase reduced from ~150-300 tokens to max 5 lines. Content: current goal + recommended next question only. No transition rules, no tool reminders.
- Few-shot examples: 6 walkthrough examples → 1 canonical format-anchoring example.

**Eval-Gate:** Run `npm run eval:interview buchhalter` before deploy. Interview quality must be ≥ baseline.

---

### Iteration 2 — Orchestrator

**New file:** `src/services/interviewOrchestrator.ts`

Responsibilities:
- `decideNextPhase(ctx, analystSuggestion)` — pure TypeScript, no LLM, covers all 7 phase transitions including the Amendment-A `clarification` phase
- Lifecycle: Hard-Stop (timer ≥ max) and Soft-Confirm (Trigger B: `wrap_up_question_asked=true` + user answered) — both write `status='completed'` and `extractions_pending=true`
- Stale-briefing detection: if `analyst_status='processing'` for >30s → flag Catch-up-Run for next turn

**Modified:** `src/services/interviewAgent.ts`
- `transition_phase`, `enter_coverage_check`, `complete_interview` tools **removed** from `buildTools()`
- Remaining tools: `register_step`, `record_slot`, `update_walkthrough_data`, `link_bottleneck`, `update_topics`

**Modified:** `src/app/api/interview/[token]/chat/route.ts`
- Orchestrator runs at turn start, before the Agent call
- Phase written to DB by Orchestrator (not by LLM tool call)

**New file:** `src/services/interviewOrchestrator.test.ts`
- Unit tests: `decideNextPhase` with Tracker snapshots, offline, no LLM
- Covers all 7 phase transitions + both lifecycle triggers + Catch-up detection

**Langfuse spans:** 3 spans per turn — `interview.talker`, `interview.analyst`, `interview.orchestrator` — all under `session_id = interview_id`, tagged `component=talker|analyst|orchestrator`.

**Eval-Gate:** Phase-logic regressions = 0, interview quality ≥ Iteration-1 baseline.

---

### Iteration 3 — Talker/Analyst Split

**New files:**
- `src/services/interviewTalker.ts` — text-only `streamText`, zero tools, starts immediately on user turn
- `src/services/interviewAnalyst.ts` — all 5 knowledge tools + `produce_briefing` structured output (AI SDK `generateObject`)

**Modified:** `src/app/api/interview/[token]/chat/route.ts`

Turn flow:
```
1. User turn N arrives
2. Orchestrator: read analyst_status + next_briefing, decideNextPhase, build briefing
3. Talker: streamText → client (First-Token target: <2s)
4. waitUntil(runAnalyst(turnPayload, state))   ← background, Vercel Fluid Compute
5. Analyst: runs knowledge tools, writes produce_briefing → next_briefing + analyst_status='done'
```

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

**Reasoning via API params:**
- Talker: `thinking_level: 'low'` (Gemini) — no textual CoT
- Analyst: `thinking_level: 'medium'` (Gemini) — deep reasoning for extraction and briefing

**Error handling:**
- Analyst throws → wrapper writes `analyst_status='failed'`
- Next turn: Orchestrator detects `failed` → Catch-up-Run (Analyst processes two turns at once)
- Talker receives Tool-Use in output → Hard Error, output discarded, Langfuse error span

**Eval-Gate:** Interview completeness (slots filled, phases traversed) ≥ Iteration-2 baseline.

---

### Component Map (after all 3 iterations)

```
src/services/
  interviewOrchestrator.ts     Phase logic + lifecycle (TypeScript only)
  interviewOrchestrator.test.ts  Unit tests, offline, Tracker snapshots
  interviewTalker.ts           Streaming text response (no tools)
  interviewAnalyst.ts          Knowledge tools + produce_briefing
  interviewAgent.ts            Prompt builders, types, shared context (no phase tools)

src/app/api/interview/[token]/chat/route.ts
  ↳ Orchestrator → Talker (sync stream) + waitUntil(Analyst)

supabase/migrations/
  YYYYMMDD_add_analyst_state_to_interviews.sql
  ↳ analyst_status, next_briefing, clarification_answers
```

---

### Tech Decision Summary

| Decision | Choice | Reason |
|----------|--------|--------|
| Phase logic | Pure TypeScript (`decideNextPhase`) | Testable offline, deterministic, no LLM cost |
| Async Analyst | `waitUntil()` Vercel Fluid Compute | No external queue needed for V1 |
| Briefing output | `generateObject` (AI SDK structured output) | Typed `AnalystBriefing`, no parsing |
| Eventual consistency | Accepted — stale briefing fallback | Simpler than streaming merge; fixable with Catch-up-Run |
| DB columns | Separate `analyst_status`, `next_briefing`, `clarification_answers` | `analyst_status` read every turn → separate column faster than JSONB nested read |
| Reasoning control | API params (`thinking_level`) not textual CoT | Google recommends for Gemini 3.x; textual CoT conflicts with native control |

### No New Dependencies

All capabilities covered by existing stack: `ai` (AI SDK v6 — `streamText` + `generateObject`), `@ai-sdk/google` (Gemini `thinking_level`), Langfuse (`_telemetry.ts`), Supabase admin client.

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
