import { describe, it, expect } from 'vitest'
import { resolveTurnLifecycle, type OrchestratorContext } from './interviewOrchestrator'
import type { StepEntry } from './interviewSemantic'
import type { AnalystBriefing } from './interviewTypes'

/**
 * PROJ-42 regression test — reproduces the real Tim interview that surfaced KI-23
 * (Supabase interview 09c2052c-ad69-40fc-bb38-d934ece47fc6, 2026-07-14, IT/Developer,
 * `max_duration_minutes=10`, 17 turns). That interview is STILL `status='active'` in
 * production as of 2026-07-16 — the pre-PROJ-42 system never reached completion.
 *
 * Root cause (KI-23): completion required `semanticAllStepsDone` (never true here —
 * `ausnahmen`/`tazite_cues` stayed null for both steps, confirmed by the real final
 * `step_tracker` below) OR a brittle `FAREWELL_MARKERS` regex match (missed turn 14's
 * real "wünsche ich dir" — substring "wünsche dir" — a genuine near-miss, not a
 * contrived example). A secondary bug (KI-23, `computeTurnBudget`) escalated the
 * interview to the wrap-up question after just ~9 turns with only ONE process
 * registered, purely from turn count — elapsed wall-clock time never got anywhere
 * near the 10-minute budget (max ~5 minutes across all 17 turns, well under the new
 * 80% soft anchor at 8 minutes) confirmed via the real `created_at` timestamps below.
 *
 * PROJ-46 (ADR-023 D4) note: the scripted CLOSING_PROBE_TEXT injection this test
 * originally pinned is gone — Closing is a Talker-formulated discovery continuation
 * now, and completion binds to ctx.phase already being 'closing' plus the
 * no-new-extraction streak, not a scripted probe having been asked+answered. The
 * turn-by-turn narrative below is preserved for its historical context; assertions
 * are updated to the new completion mechanism.
 *
 * This test reconstructs a plausible per-turn state trace using the REAL user inputs,
 * REAL timestamps and the REAL final step_tracker pulled from Supabase — it is not a
 * byte-exact replay of the historical (buggy) system's internal state, since per-turn
 * Analyst snapshots were never persisted, only the inputs/outputs and final tracker.
 */

const emptyPotenzial: StepEntry['potenzial'] = {
  frequency_per_month: null,
  duration_minutes: null,
  error_rate_percent: null,
  media_breaks: null,
}
const emptySlots: StepEntry['slots'] = {
  entscheidungslogik: null,
  tazite_cues: null,
  ausnahmen: null,
  inputs: null,
  outputs: null,
  hilfsmittel: null,
}

function makeStep(title: string, status: StepEntry['status'], extra: Partial<StepEntry> = {}): StepEntry {
  return { title, reihenfolge: 1, governance: null, abhaengigkeiten: null, status, potenzial: emptyPotenzial, slots: emptySlots, process_steps: [], friction_points: [], friction_tools: [], pain_point_primary: null, ...extra }
}

// Real final tracker shape (Supabase, abbreviated — embeddings/exact quotes omitted,
// null-ness of tazite slots preserved verbatim): NEITHER step ever reaches 'done'
// because entscheidungslogik/tazite_cues/ausnahmen/inputs/outputs stay unfilled —
// this is exactly why the old semanticAllStepsDone gate could never fire.
const REAL_FINAL_TRACKER: StepEntry[] = [
  makeStep('Softwareentwicklung', 'walkthrough', {
    id: 'S001',
    potenzial: { ...emptyPotenzial, frequency_per_month: { value: 20, quote: '1 pro tag', confidence: 'estimate' } },
    slots: {
      ...emptySlots,
      inputs: { value: ['code'], quote: 'ne spaß ist schon der code', nicht_befund_typ: null },
      outputs: { value: ['ergebnis unbekannt'], quote: 'das ergebnis kenne ich selber immer ganricht so genau', nicht_befund_typ: null },
      hilfsmittel: { value: ['visual studio code'], quote: 'visual studio code', nicht_befund_typ: null },
      entscheidungslogik: { value: 'Vorgesetzter bewertet das Ergebnis', quote: 'mein Vorgesetzter anschaut und bewertet', nicht_befund_typ: null },
      // ausnahmen, tazite_cues: still null in the real data — never resolved.
    },
  }),
  makeStep('Meetings', 'walkthrough', {
    id: 'S002',
    potenzial: { ...emptyPotenzial, frequency_per_month: { value: 20, quote: '1 pro tag 20 min', confidence: 'confirmed' }, duration_minutes: { value: 20, quote: '1 pro tag 20 min', confidence: 'confirmed' } },
    slots: {
      ...emptySlots,
      hilfsmittel: { value: ['visual studio code'], quote: '[auto-backfill aus erwähnten Tools/Systemen]', nicht_befund_typ: null },
      // inputs, outputs, entscheidungslogik, tazite_cues, ausnahmen: still null.
    },
  }),
]

const MAX_DURATION_MINUTES = 10 // real interview config

function ctxAt(overrides: Partial<OrchestratorContext>): OrchestratorContext {
  return {
    phase: 'explore',
    stepTracker: [],
    timerMinutes: 0,
    maxDurationMinutes: MAX_DURATION_MINUTES,
    historyLength: 0,
    hadExtractionThisTurn: false,
    oDrought: { stepId: null, streak: 0, exhaustedStepIds: [] },
    ...overrides,
  }
}

describe('PROJ-42 Tim regression (Supabase 09c2052c-ad69-40fc-bb38-d934ece47fc6)', () => {
  it('turn 8 (real elapsed ~2min, 1 process registered): stays in explore — no premature escalation from turn count alone', () => {
    // Real turns 1-8. Only "Softwareentwicklung" registered so far, no advance
    // signal yet (Analyst hasn't judged it sufficiently covered). Under the OLD
    // computeTurnBudget ladder this was already deep into the escape-valve zone
    // for a single-step tracker — the new model has no such turn-count driver at all.
    const tracker = [makeStep('Softwareentwicklung', 'walkthrough', { id: 'S001' })]
    const ctx = ctxAt({ phase: 'explore', stepTracker: tracker, timerMinutes: 2, historyLength: 14 })

    // No advance signal, no streak exhaustion, well under the 80% soft anchor (8min) → stays explore.
    expect(resolveTurnLifecycle(ctx, { noNewExtractionStreak: 0 }).phase).toBe('explore')
  })

  it('turn 9 (real elapsed ~3min): advances to closing once the Analyst judges the process sufficiently covered — content-driven, and never completes on this entry turn', () => {
    const tracker = [makeStep('Softwareentwicklung', 'walkthrough', { id: 'S001' })]
    // PROJ-44 Remediation (M-1): by turn 9 the single active step has also
    // drought-fired (no new O-field across the last few of the largely
    // off-topic turns 5-8) — both signals (Analyst step_advance_ready AND the
    // tracker-derived O-Drought) agree it's time to close, not step_advance_ready alone.
    const oDrought = { stepId: 'S001', streak: 3, exhaustedStepIds: [] }
    const ctx = ctxAt({ phase: 'explore', stepTracker: tracker, timerMinutes: 3, historyLength: 16, oDrought })

    const next = resolveTurnLifecycle(ctx, { step_advance_ready: true })
    expect(next.phase).toBe('closing')
    // PROJ-46 (ADR-023 D4): the explore→closing entry turn (ctx.phase was still
    // 'explore') can never soft-confirm-complete on the same turn — it always
    // asks at least one more discovery question first, formulated by the Talker.
    expect(next.complete).toBe(false)
  })

  it('turn 10 real reveal ("Meetings"): a newly-discovered process during closing routes back to explore, first-class — not the old 2-turn clarification-only cap', () => {
    // Real turn 10 user input reveals a genuinely new recurring task while
    // already in Closing (the discovery-continuation question from turn 9).
    const tracker = [
      makeStep('Softwareentwicklung', 'walkthrough', { id: 'S001' }),
      makeStep('Meetings', 'exploring', { id: 'S002' }),
    ]
    const ctx = ctxAt({ phase: 'closing', stepTracker: tracker, timerMinutes: 3, historyLength: 2, hadExtractionThisTurn: true })

    // Strom 1 AC: first-class Explore reentry (not 'clarification'), and must
    // not complete out from under the freshly-discovered step.
    const result = resolveTurnLifecycle(ctx, null)
    expect(result.phase).toBe('explore')
    expect(result.complete).toBe(false)
  })

  it('reaches complete=true by the end of the reconstructed sequence — the actual KI-23 fix (prod interview remains status=active to this day)', () => {
    // Real turns 13/14, including the EXACT string that broke the old
    // FAREWELL_MARKERS regex ("wünsche ich dir" — substring "wünsche dir" required,
    // never matched). The new mechanism does not use text heuristics at all — it is
    // irrelevant here too, since resolveTurnLifecycle never inspects assistant text
    // for farewell language. By this point several consecutive turns produced no new
    // extraction (Meetings' slots got filled turn 10-11, then only farewell exchanges
    // 12-14) — the streak reaches the default limit K=3 while already in closing.
    const ctx = ctxAt({
      phase: 'closing',
      stepTracker: REAL_FINAL_TRACKER, // real final tracker — neither step is 'done'
      timerMinutes: 4,
      historyLength: 14,
    })
    const analystSuggestion: AnalystBriefing = { noNewExtractionStreak: 3 }

    const lifecycle = resolveTurnLifecycle(ctx, analystSuggestion)
    expect(lifecycle.phase).toBe('closing')
    expect(lifecycle.complete).toBe(true)
    expect(lifecycle.reason).toBe('soft_confirm')
  })

  // Turns 15-17 (KI-24: Tim's VW-Golf-price and flight-price questions, answered by
  // the agent instead of redirected) are Strom 2 scope — tested against these exact
  // real inputs in roleGuard.test.ts, not here.
})
