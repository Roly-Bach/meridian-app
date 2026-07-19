import { describe, it, expect } from 'vitest'

import {
  resolveTurnLifecycle,
  computeFocusLock,
  updateODrought,
  computeTargetOFieldFallback,
  computeTransitionReason,
  type OrchestratorContext,
} from './interviewOrchestrator'
import type { StepEntry } from './interviewSemantic'
import type { ODroughtState } from './interviewTypes'

// ─── Fixtures ────────────────────────────────────────────────────────────────

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

const fullPotenzial: StepEntry['potenzial'] = {
  frequency_per_month: { value: 8, quote: 'zweimal pro Woche', confidence: 'estimate' as const },
  duration_minutes: { value: 30, quote: '30 Minuten', confidence: 'confirmed' as const },
  error_rate_percent: { value: 0, quote: 'keine Fehler', confidence: 'confirmed' as const },
  media_breaks: { value: 0, quote: 'keine Brüche', confidence: 'confirmed' as const },
}

const fullSlots: StepEntry['slots'] = {
  entscheidungslogik: { value: 'regelbasiert', quote: 'immer gleich', nicht_befund_typ: null },
  tazite_cues: { value: ['SAP-Wissen'], quote: 'SAP', nicht_befund_typ: null },
  ausnahmen: { value: ['Storno'], quote: 'Storno', nicht_befund_typ: null },
  inputs: { value: ['Rechnung'], quote: 'Rechnung', nicht_befund_typ: null },
  outputs: { value: ['Buchung'], quote: 'Buchung', nicht_befund_typ: null },
  hilfsmittel: { value: ['SAP'], quote: 'in SAP', nicht_befund_typ: null },
}

// Full O2–O6 coverage (7 fields: 6 tazite + abhaengigkeiten) but streak still low —
// the D3 "exhaustion fires on full coverage" scenario. Potenzial is irrelevant to
// O-coverage (O2–O6 only), left empty on purpose.
const fullAbhaengigkeiten: StepEntry['abhaengigkeiten'] = {
  depends_on: [{ schritt_id: 'S000', typ: 'voraussetzung', beschreibung: null }],
  influences: [],
  nicht_befund_typ: null,
}

function makeStep(title: string, status: 'exploring' | 'walkthrough' | 'done', slots: StepEntry['slots'] = emptySlots, extra: Partial<StepEntry> = {}): StepEntry {
  return { title, reihenfolge: 1, governance: null, abhaengigkeiten: null, status, potenzial: emptyPotenzial, slots, process_steps: [], friction_points: [], friction_tools: [], pain_point_primary: null, ...extra }
}

const emptyODrought: ODroughtState = { stepId: null, streak: 0, exhaustedStepIds: [] }

function baseCtx(overrides: Partial<OrchestratorContext> = {}): OrchestratorContext {
  return {
    phase: 'intro',
    stepTracker: [],
    timerMinutes: 5,
    maxDurationMinutes: 30,
    historyLength: 2,
    hadExtractionThisTurn: false,
    oDrought: emptyODrought,
    ...overrides,
  }
}

// ─── intro transitions ────────────────────────────────────────────────────────

describe('resolveTurnLifecycle — intro', () => {
  it('stays in intro before first agent response (historyLength=1)', () => {
    expect(resolveTurnLifecycle(baseCtx({ historyLength: 1 }), null).phase).toBe('intro')
  })

  it('advances to explore after first agent response (historyLength=2)', () => {
    expect(resolveTurnLifecycle(baseCtx({ historyLength: 2 }), null).phase).toBe('explore')
  })
})

// ─── explore transitions ──────────────────────────────────────────────────────

describe('resolveTurnLifecycle — explore (content-driven, PROJ-42)', () => {
  it('stays in explore with no advance signal and no active step', () => {
    expect(resolveTurnLifecycle(baseCtx({ phase: 'explore', stepTracker: [] }), null).phase).toBe('explore')
  })

  it('stays in explore while an active step exists and no advance signal set', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough')]
    expect(resolveTurnLifecycle(baseCtx({ phase: 'explore', stepTracker: tracker }), null).phase).toBe('explore')
  })

  // PROJ-44 Remediation (M-1): the old topicsOpen-based hasUnexploredFocusTopic
  // breadth check is replaced by a tracker-derived O-Drought exhaustion check —
  // depth and breadth collapse into one criterion (see computeFocusLock/
  // updateODrought/hasUnexhaustedStep tests further below for the primitive itself).
  it('stays in explore when step_advance_ready is true but the locked step is not yet drought-exhausted', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', emptySlots, { id: 'S001' })]
    const oDrought: ODroughtState = { stepId: 'S001', streak: 1, exhaustedStepIds: [] }
    const ctx = baseCtx({ phase: 'explore', stepTracker: tracker, oDrought })
    expect(resolveTurnLifecycle(ctx, { step_advance_ready: true }).phase).toBe('explore')
  })

  it('advances to closing when step_advance_ready is true and the only registered step has drought-fired (hit the default limit K=3)', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', emptySlots, { id: 'S001' })]
    const oDrought: ODroughtState = { stepId: 'S001', streak: 3, exhaustedStepIds: [] }
    const ctx = baseCtx({ phase: 'explore', stepTracker: tracker, oDrought })
    expect(resolveTurnLifecycle(ctx, { step_advance_ready: true }).phase).toBe('closing')
  })

  it('advances to closing when the only registered step is already done (no unexhausted step remains)', () => {
    const tracker = [makeStep('Mahnwesen: Bearbeitung', 'done', fullSlots, { potenzial: fullPotenzial, id: 'S001' })]
    const ctx = baseCtx({ phase: 'explore', stepTracker: tracker })
    expect(resolveTurnLifecycle(ctx, { step_advance_ready: true }).phase).toBe('closing')
  })

  // PROJ-46 (ADR-023 D3): full O2–O6 coverage exhausts a step immediately,
  // independent of its drought streak — otherwise a step whose 7th field fills
  // the same turn its streak resets to 0 would stay locked with no empty
  // target for up to K more turns.
  it('advances to closing when the only registered step has full O2–O6 coverage despite a fresh (low) streak', () => {
    const fullyCovered = makeStep('Mahnwesen: Bearbeitung', 'walkthrough', fullSlots, { id: 'S001', abhaengigkeiten: fullAbhaengigkeiten })
    const oDrought: ODroughtState = { stepId: 'S001', streak: 0, exhaustedStepIds: [] }
    const ctx = baseCtx({ phase: 'explore', stepTracker: [fullyCovered], oDrought })
    expect(resolveTurnLifecycle(ctx, { step_advance_ready: true }).phase).toBe('closing')
  })

  describe('no-new-extraction safety net', () => {
    it('stays in explore below the default streak limit (K=3)', () => {
      const ctx = baseCtx({ phase: 'explore' })
      expect(resolveTurnLifecycle(ctx, { noNewExtractionStreak: 2 }).phase).toBe('explore')
    })

    it('advances to closing once the streak reaches the default limit (K=3)', () => {
      const ctx = baseCtx({ phase: 'explore' })
      expect(resolveTurnLifecycle(ctx, { noNewExtractionStreak: 3 }).phase).toBe('closing')
    })

    it('respects NO_NEW_EXTRACTION_LIMIT env override', () => {
      const prev = process.env.NO_NEW_EXTRACTION_LIMIT
      process.env.NO_NEW_EXTRACTION_LIMIT = '5'
      try {
        const ctx = baseCtx({ phase: 'explore' })
        expect(resolveTurnLifecycle(ctx, { noNewExtractionStreak: 3 }).phase).toBe('explore')
        expect(resolveTurnLifecycle(ctx, { noNewExtractionStreak: 5 }).phase).toBe('closing')
      } finally {
        if (prev === undefined) delete process.env.NO_NEW_EXTRACTION_LIMIT
        else process.env.NO_NEW_EXTRACTION_LIMIT = prev
      }
    })
  })

  describe('wall-clock soft anchor (~80% of budget)', () => {
    it('stays in explore below the soft anchor', () => {
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 23, maxDurationMinutes: 30 })
      expect(resolveTurnLifecycle(ctx, null).phase).toBe('explore')
    })

    it('advances to closing at the soft anchor when no step is actively being explored', () => {
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 24, maxDurationMinutes: 30, stepTracker: [] })
      expect(resolveTurnLifecycle(ctx, null).phase).toBe('closing')
    })

    it('grants a capped grace period to an actively-explored step at the soft anchor instead of an abrupt pivot', () => {
      const tracker = [makeStep('Rechnungsprüfung', 'walkthrough')]
      // 30-min budget: soft anchor=24min, grace=min(3, 6)=3min → grace window 24-27min
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 25, maxDurationMinutes: 30, stepTracker: tracker })
      expect(resolveTurnLifecycle(ctx, null).phase).toBe('explore')
    })

    it('forces closing once the grace period expires, even with an active step', () => {
      const tracker = [makeStep('Rechnungsprüfung', 'walkthrough')]
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 27, maxDurationMinutes: 30, stepTracker: tracker })
      expect(resolveTurnLifecycle(ctx, null).phase).toBe('closing')
    })

    it('grace window is naturally capped by the hard stop for short interviews (10-min config, Tim regression)', () => {
      // 10-min budget: soft anchor=8min, grace=min(3, 2)=2min → window ends exactly at hard stop (10min)
      const tracker = [makeStep('IT-Support-Ticket', 'walkthrough')]
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 9, maxDurationMinutes: 10, stepTracker: tracker })
      expect(resolveTurnLifecycle(ctx, null).phase).toBe('explore')
    })

    // PROJ-46 QA H-1 Fix A: hasActiveStep used to read raw status
    // (hasStepInStatus(...'exploring'|'walkthrough')), which practically never
    // leaves those statuses (applyIntent.ts's auto-'done' transition requires
    // every potenzial slot filled too — the KI-23 "praktisch nie true"
    // condition). That bought a status='walkthrough' step up to
    // MAX_GRACE_MINUTES of extra explore time at the soft anchor even once it
    // was already O-exhausted. Now coupled to the same exhaustion check the
    // Fokus-Lock uses (hasUnexhaustedStep) — an exhausted step releases the
    // phase immediately instead of waiting out the grace window.
    it('does not grant a grace period to a step whose drought already fired, even though it is still status=walkthrough', () => {
      const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', emptySlots, { id: 'S001' })]
      const oDrought: ODroughtState = { stepId: 'S001', streak: 3, exhaustedStepIds: [] }
      // 30-min budget: soft anchor=24min, grace window would be 24-27min for an ACTIVE step
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 25, maxDurationMinutes: 30, stepTracker: tracker, oDrought })
      expect(resolveTurnLifecycle(ctx, null).phase).toBe('closing')
    })

    it('does not grant a grace period to a step whose O2–O6 coverage is already full, even with a fresh (low) streak', () => {
      const fullyCovered = makeStep('Mahnwesen: Bearbeitung', 'walkthrough', fullSlots, { id: 'S001', abhaengigkeiten: fullAbhaengigkeiten })
      const oDrought: ODroughtState = { stepId: 'S001', streak: 0, exhaustedStepIds: [] }
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 25, maxDurationMinutes: 30, stepTracker: [fullyCovered], oDrought })
      expect(resolveTurnLifecycle(ctx, null).phase).toBe('closing')
    })
  })
})

// ─── closing transitions (PROJ-46 / ADR-023 D4: phase-bound streak, no scripted probe) ──

describe('resolveTurnLifecycle — closing (PROJ-46 discovery continuation)', () => {
  // The explore→closing ENTRY turn: ctx.phase is still 'explore' (loaded state),
  // even though resolvePhaseTransition resolves to 'closing' this turn — must
  // never soft-confirm-complete on this same turn (≥1 discovery question guarantee).
  it('never completes on the explore→closing entry turn, even with the streak already at the limit', () => {
    const ctx = baseCtx({ phase: 'explore', timerMinutes: 24, maxDurationMinutes: 30, stepTracker: [] })
    const result = resolveTurnLifecycle(ctx, { noNewExtractionStreak: 99 })
    expect(result.phase).toBe('closing')
    expect(result.complete).toBe(false)
    expect(result.reason).toBe(null)
  })

  it('stays in closing, not yet complete, when already in closing but the streak is below the limit', () => {
    const ctx = baseCtx({ phase: 'closing', stepTracker: [] })
    const result = resolveTurnLifecycle(ctx, { noNewExtractionStreak: 1 })
    expect(result.phase).toBe('closing')
    expect(result.complete).toBe(false)
  })

  it('completes once already in closing AND the no-new-extraction streak reaches the limit, no cards', () => {
    const ctx = baseCtx({ phase: 'closing', stepTracker: [] })
    const result = resolveTurnLifecycle(ctx, { noNewExtractionStreak: 3 })
    expect(result.phase).toBe('closing')
    expect(result.complete).toBe(true)
    expect(result.reason).toBe('soft_confirm')
  })

  it('advances to clarification instead of completing when the Analyst provided clarification_cards', () => {
    const analystSuggestion = {
      noNewExtractionStreak: 3,
      clarification_cards: [{ process_step_id: 'uuid-1', step_title: 'Rechnungsprüfung', question: 'Wie oft?', options: ['Täglich', 'Wöchentlich', 'Andere'], slot_key: 'frequency' }],
    }
    const result = resolveTurnLifecycle(baseCtx({ phase: 'closing', stepTracker: [] }), analystSuggestion)
    expect(result.phase).toBe('clarification')
    expect(result.complete).toBe(false)
  })

  it('routes a newly-discovered process during closing back to explore, first-class (no clarification-only cap)', () => {
    const lateStep = makeStep('Reisekostenabrechnung', 'exploring')
    const result = resolveTurnLifecycle(baseCtx({ phase: 'closing', stepTracker: [lateStep] }), null)
    expect(result.phase).toBe('explore')
    expect(result.complete).toBe(false)
  })

  // PROJ-46 (ADR-023 D4, M7-b): generalizes the former H-1 newStepThisTurn veto —
  // ANY applied knowledge write this turn (not just a brand-new step) routes
  // back to explore instead of letting Closing complete out from under fresh content.
  describe('M7-b: hadExtractionThisTurn veto', () => {
    it('routes back to explore when a knowledge write was applied this turn, even with no exploring step', () => {
      const doneStep = makeStep('Mahnwesen: Bearbeitung', 'done', fullSlots, { potenzial: fullPotenzial, id: 'S001' })
      const ctx = baseCtx({ phase: 'closing', stepTracker: [doneStep], hadExtractionThisTurn: true })
      const result = resolveTurnLifecycle(ctx, { noNewExtractionStreak: 5 })
      expect(result.phase).toBe('explore')
      expect(result.complete).toBe(false)
    })

    it('stays in closing (and can complete) when no knowledge write was applied this turn', () => {
      const doneStep = makeStep('Mahnwesen: Bearbeitung', 'done', fullSlots, { potenzial: fullPotenzial, id: 'S001' })
      const ctx = baseCtx({ phase: 'closing', stepTracker: [doneStep], hadExtractionThisTurn: false })
      const result = resolveTurnLifecycle(ctx, { noNewExtractionStreak: 3 })
      expect(result.phase).toBe('closing')
      expect(result.complete).toBe(true)
    })
  })

  it('does not rely on text-heuristic farewell-loop detection (removed, KI-23) — repeated goodbyes alone do not complete', () => {
    const ctx = baseCtx({ phase: 'closing', stepTracker: [] })
    const result = resolveTurnLifecycle(ctx, { noNewExtractionStreak: 2 })
    expect(result.complete).toBe(false)
  })
})

// ─── clarification ────────────────────────────────────────────────────────────

describe('resolveTurnLifecycle — clarification', () => {
  it('stays in clarification (route handler owns the exit via DB)', () => {
    const result = resolveTurnLifecycle(baseCtx({ phase: 'clarification' }), null)
    expect(result.phase).toBe('clarification')
    expect(result.complete).toBe(false)
  })
})

// ─── Hard-Stop ────────────────────────────────────────────────────────────────

describe('resolveTurnLifecycle — hard stop', () => {
  it('forces closing + completes when timer exceeded from any phase, no pending cards', () => {
    const a = resolveTurnLifecycle(baseCtx({ phase: 'explore', timerMinutes: 30, maxDurationMinutes: 30 }), null)
    expect(a.phase).toBe('closing')
    expect(a.complete).toBe(true)
    expect(a.reason).toBe('hard_stop')

    const b = resolveTurnLifecycle(baseCtx({ phase: 'intro', timerMinutes: 31, maxDurationMinutes: 30 }), null)
    expect(b.phase).toBe('closing')
    expect(b.complete).toBe(true)
    expect(b.reason).toBe('hard_stop')
  })

  it('does not regress a hard-stopped, actively-exploring step back to explore', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'exploring')]
    const result = resolveTurnLifecycle(baseCtx({ phase: 'closing', timerMinutes: 30, maxDurationMinutes: 30, stepTracker: tracker }), null)
    expect(result.phase).toBe('closing')
    expect(result.complete).toBe(true)
  })

  // ADR-022 (Nutzer-Korrektur 2026-07-17): Trigger A must not discard already-
  // generated clarification cards — they carry the quantitative ROI slots.
  it('routes to clarification instead of completing when clarification_cards are already pending', () => {
    const analystSuggestion = {
      clarification_cards: [{ process_step_id: 'x', step_title: 'Test', question: 'Wie oft?', options: ['A', 'B'], slot_key: 'frequency' }],
    }
    const result = resolveTurnLifecycle(baseCtx({ phase: 'explore', timerMinutes: 30, maxDurationMinutes: 30 }), analystSuggestion)
    expect(result.phase).toBe('clarification')
    expect(result.complete).toBe(false)
  })
})

// ─── D2 terminination invariant ───────────────────────────────────────────────

describe('resolveTurnLifecycle — D2 terminination invariant', () => {
  it('never returns complete:true with reason soft_confirm outside a resolved closing phase', () => {
    // explore, well under any threshold — no way to reach complete:true via soft_confirm.
    const result = resolveTurnLifecycle(baseCtx({ phase: 'explore', timerMinutes: 5, maxDurationMinutes: 30 }), null)
    expect(result.complete).toBe(false)
    expect(result.reason).toBe(null)
  })

  it('does NOT complete when clarification_cards are pending, even with the streak at the limit', () => {
    const analystSuggestion = {
      noNewExtractionStreak: 3,
      clarification_cards: [{ process_step_id: 'x', step_title: 'Test', question: 'Wie oft?', options: ['A', 'B'], slot_key: 'frequency' }],
    }
    const result = resolveTurnLifecycle(baseCtx({ phase: 'closing', stepTracker: [] }), analystSuggestion)
    expect(result.complete).toBe(false)
  })

  it('does NOT complete when a newly-discovered process is still exploring during closing', () => {
    const tracker = [makeStep('Reisekostenabrechnung', 'exploring')]
    const result = resolveTurnLifecycle(baseCtx({ phase: 'closing', stepTracker: tracker }), null)
    expect(result.complete).toBe(false)
    expect(result.reason).toBe(null)
  })

  // PROJ-46 (ADR-023 D4, M7-b): same scenario, but via the generalized
  // hadExtractionThisTurn veto instead of a still-exploring step.
  it('does NOT complete when a knowledge write was applied this turn (M7-b), even with the streak at the limit', () => {
    const tracker = [makeStep('Reisekostenabrechnung', 'walkthrough', undefined, { id: 'S002' })]
    const result = resolveTurnLifecycle(
      baseCtx({ phase: 'closing', stepTracker: tracker, hadExtractionThisTurn: true }),
      { noNewExtractionStreak: 3 },
    )
    expect(result.complete).toBe(false)
    expect(result.reason).toBe(null)
  })
})

// ─── computeFocusLock / updateODrought (PROJ-44/46 Remediation) ──────────────

describe('computeFocusLock (M-3 Fokus-Lock)', () => {
  it('locks onto the first candidate step when no previous lock exists', () => {
    const tracker = [
      makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' }),
      makeStep('Monatsabschluss', 'exploring', undefined, { id: 'S002' }),
    ]
    const lock = computeFocusLock(tracker, null)
    expect(lock.stepId).toBe('S001')
    expect(lock.streak).toBe(0)
    expect(lock.exhaustedStepIds).toEqual([])
  })

  it('keeps the lock on the same step across turns while it is not yet drought-exhausted', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' })]
    const previous: ODroughtState = { stepId: 'S001', streak: 1, exhaustedStepIds: [] }
    const lock = computeFocusLock(tracker, previous)
    expect(lock.stepId).toBe('S001')
    expect(lock.streak).toBe(1)
  })

  it('switches to the next candidate step once the drought limit fires (default K=3), marking the old step exhausted', () => {
    const tracker = [
      makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' }),
      makeStep('Monatsabschluss', 'exploring', undefined, { id: 'S002' }),
    ]
    const previous: ODroughtState = { stepId: 'S001', streak: 3, exhaustedStepIds: [] }
    const lock = computeFocusLock(tracker, previous)
    expect(lock.stepId).toBe('S002')
    expect(lock.streak).toBe(0)
    expect(lock.exhaustedStepIds).toContain('S001')
  })

  it('never re-locks a previously-exhausted step even if it is the only remaining candidate structurally reachable', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' })]
    const previous: ODroughtState = { stepId: 'S001', streak: 5, exhaustedStepIds: [] }
    const lock = computeFocusLock(tracker, previous)
    expect(lock.stepId).toBeNull()
    expect(lock.exhaustedStepIds).toContain('S001')
  })

  it('ignores done steps as lock candidates', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'done', fullSlots, { id: 'S001', potenzial: fullPotenzial })]
    const lock = computeFocusLock(tracker, null)
    expect(lock.stepId).toBeNull()
  })

  it('respects O_DROUGHT_LIMIT env override', () => {
    const prev = process.env.O_DROUGHT_LIMIT
    process.env.O_DROUGHT_LIMIT = '1'
    try {
      const tracker = [
        makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' }),
        makeStep('Monatsabschluss', 'exploring', undefined, { id: 'S002' }),
      ]
      const previous: ODroughtState = { stepId: 'S001', streak: 1, exhaustedStepIds: [] }
      const lock = computeFocusLock(tracker, previous)
      expect(lock.stepId).toBe('S002')
    } finally {
      if (prev === undefined) delete process.env.O_DROUGHT_LIMIT
      else process.env.O_DROUGHT_LIMIT = prev
    }
  })

  // PROJ-46 (ADR-023 D3): full O2–O6 coverage exhausts a step immediately,
  // independent of streak — never re-locked, even with streak=0.
  describe('D3: exhaustion on full O2–O6 coverage', () => {
    it('never locks a non-done step whose O2–O6 coverage is already complete', () => {
      const fullyCovered = makeStep('Mahnwesen: Bearbeitung', 'walkthrough', fullSlots, { id: 'S001', abhaengigkeiten: fullAbhaengigkeiten })
      const lock = computeFocusLock([fullyCovered], null)
      expect(lock.stepId).toBeNull()
      expect(lock.exhaustedStepIds).toContain('S001')
    })

    it('advances past a fully-covered step to the next candidate, without waiting for the streak', () => {
      const fullyCovered = makeStep('Mahnwesen: Bearbeitung', 'walkthrough', fullSlots, { id: 'S001', abhaengigkeiten: fullAbhaengigkeiten })
      const other = makeStep('Monatsabschluss', 'exploring', undefined, { id: 'S002' })
      const previous: ODroughtState = { stepId: 'S001', streak: 0, exhaustedStepIds: [] }
      const lock = computeFocusLock([fullyCovered, other], previous)
      expect(lock.stepId).toBe('S002')
    })
  })
})

describe('updateODrought (M-1/M-3 shared primitive)', () => {
  it('resets the streak to 0 when the locked step gained a new O-field this turn', () => {
    const before = makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' })
    const after = makeStep('Rechnungsprüfung', 'walkthrough', {
      ...emptySlots,
      tazite_cues: { value: ['SAP-Wissen'], quote: 'SAP', nicht_befund_typ: null },
    }, { id: 'S001' })
    const lock: ODroughtState = { stepId: 'S001', streak: 2, exhaustedStepIds: [] }
    const updated = updateODrought(lock, [before], [after])
    expect(updated.streak).toBe(0)
  })

  it('increments the streak when no new O-field appeared for the locked step', () => {
    const step = makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' })
    const lock: ODroughtState = { stepId: 'S001', streak: 1, exhaustedStepIds: [] }
    const updated = updateODrought(lock, [step], [step])
    expect(updated.streak).toBe(2)
  })

  it('is a no-op when nothing is locked (stepId=null)', () => {
    const lock: ODroughtState = { stepId: null, streak: 0, exhaustedStepIds: ['S001'] }
    const updated = updateODrought(lock, [], [])
    expect(updated).toEqual(lock)
  })
})

// ─── computeTargetOFieldFallback (PROJ-46 / ADR-023 D1) ──────────────────────

describe('computeTargetOFieldFallback', () => {
  it('returns null when there is no locked step', () => {
    expect(computeTargetOFieldFallback(undefined)).toBeNull()
  })

  it('returns the first empty O2–O6 field in COVERAGE_FIELDS order', () => {
    const step = makeStep('Rechnungsprüfung', 'walkthrough', emptySlots, { id: 'S001' })
    expect(computeTargetOFieldFallback(step)).toBe('entscheidungslogik')
  })

  it('skips already-filled fields (value or nicht_befund_typ) and returns the next open one', () => {
    const step = makeStep('Rechnungsprüfung', 'walkthrough', {
      entscheidungslogik: { value: 'regelbasiert', quote: 'immer gleich', nicht_befund_typ: null },
      tazite_cues: { value: null, quote: null, nicht_befund_typ: 'unbekannt' },
      ausnahmen: null,
      inputs: null,
      outputs: null,
      hilfsmittel: null,
    }, { id: 'S001' })
    expect(computeTargetOFieldFallback(step)).toBe('ausnahmen')
  })

  it('returns abhaengigkeiten (O6) last, once all other O2–O5 fields are filled', () => {
    const step = makeStep('Rechnungsprüfung', 'walkthrough', fullSlots, { id: 'S001' })
    expect(computeTargetOFieldFallback(step)).toBe('abhaengigkeiten')
  })

  it('returns null when every O2–O6 field is already filled', () => {
    const step = makeStep('Rechnungsprüfung', 'walkthrough', fullSlots, { id: 'S001', abhaengigkeiten: fullAbhaengigkeiten })
    expect(computeTargetOFieldFallback(step)).toBeNull()
  })
})

// ─── computeTransitionReason (PROJ-46 / ADR-023 D1) ──────────────────────────

describe('computeTransitionReason', () => {
  it('returns closing_entry when the resolved phase enters closing from a non-closing phase', () => {
    expect(computeTransitionReason('S001', null, 'explore', 'closing')).toBe('closing_entry')
  })

  it('prioritizes closing_entry even when the locked step also changed', () => {
    expect(computeTransitionReason('S001', 'S002', 'explore', 'closing')).toBe('closing_entry')
  })

  it('returns step_switch when the locked step id changed but the phase did not newly enter closing', () => {
    expect(computeTransitionReason('S001', 'S002', 'explore', 'explore')).toBe('step_switch')
  })

  it('returns null when the same step remains locked', () => {
    expect(computeTransitionReason('S001', 'S001', 'explore', 'explore')).toBeNull()
  })

  it('returns null when nothing was locked before or after', () => {
    expect(computeTransitionReason(null, null, 'explore', 'explore')).toBeNull()
  })

  it('returns null once already in closing on both sides (no repeated closing_entry)', () => {
    expect(computeTransitionReason(null, null, 'closing', 'closing')).toBeNull()
  })
})
