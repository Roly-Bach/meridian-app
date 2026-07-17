import { describe, it, expect, vi } from 'vitest'

// interviewOrchestrator imports computeMissingMandatorySlots from interviewAgent,
// which transitively imports supabase-admin (server-only). Mock it here.
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: vi.fn() }),
}))

import {
  decideNextPhase,
  checkLifecycle,
  closingProbeAlreadyAsked,
  shouldInjectClosingProbe,
  closingProbeAnswerReceived,
  computeFocusLock,
  updateODrought,
  hasNewStepThisTurn,
  CLOSING_PROBE_TEXT,
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

function makeStep(title: string, status: 'exploring' | 'walkthrough' | 'done', slots: StepEntry['slots'] = emptySlots, extra: Partial<StepEntry> = {}): StepEntry {
  return { title, reihenfolge: 1, governance: null, abhaengigkeiten: null, status, potenzial: emptyPotenzial, slots, process_steps: [], friction_points: [], friction_tools: [], pain_point_primary: null, ...extra }
}

const emptyODrought: ODroughtState = { stepId: null, streak: 0, exhaustedStepIds: [] }

function baseCtx(overrides: Partial<OrchestratorContext> = {}): OrchestratorContext {
  return {
    phase: 'intro',
    stepTracker: [],
    topicsOpen: [],
    topicsCovered: [],
    timerMinutes: 5,
    maxDurationMinutes: 30,
    historyLength: 2,
    history: [{ role: 'user', content: 'Hallo' }, { role: 'assistant', content: 'Hallo!' }],
    newStepThisTurn: false,
    oDrought: emptyODrought,
    ...overrides,
  }
}

// ─── intro transitions ────────────────────────────────────────────────────────

describe('decideNextPhase — intro', () => {
  it('stays in intro before first agent response (historyLength=1)', () => {
    expect(decideNextPhase(baseCtx({ historyLength: 1 }), null)).toBe('intro')
  })

  it('advances to explore after first agent response (historyLength=2)', () => {
    expect(decideNextPhase(baseCtx({ historyLength: 2 }), null)).toBe('explore')
  })
})

// ─── explore transitions ──────────────────────────────────────────────────────

describe('decideNextPhase — explore (content-driven, PROJ-42)', () => {
  it('stays in explore with no advance signal and no active step', () => {
    expect(decideNextPhase(baseCtx({ phase: 'explore', stepTracker: [] }), null)).toBe('explore')
  })

  it('stays in explore while an active step exists and no advance signal set', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough')]
    expect(decideNextPhase(baseCtx({ phase: 'explore', stepTracker: tracker }), null)).toBe('explore')
  })

  // PROJ-44 Remediation (M-1): the old topicsOpen-based hasUnexploredFocusTopic
  // breadth check is replaced by a tracker-derived O-Drought exhaustion check —
  // depth and breadth collapse into one criterion (see computeFocusLock/
  // updateODrought/hasUnexhaustedStep tests further below for the primitive itself).
  it('stays in explore when step_advance_ready is true but the locked step is not yet drought-exhausted', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', emptySlots, { id: 'S001' })]
    const oDrought: ODroughtState = { stepId: 'S001', streak: 1, exhaustedStepIds: [] }
    const ctx = baseCtx({ phase: 'explore', stepTracker: tracker, oDrought })
    expect(decideNextPhase(ctx, { step_advance_ready: true })).toBe('explore')
  })

  it('advances to closing when step_advance_ready is true and the only registered step has drought-fired (hit the default limit K=3)', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', emptySlots, { id: 'S001' })]
    const oDrought: ODroughtState = { stepId: 'S001', streak: 3, exhaustedStepIds: [] }
    const ctx = baseCtx({ phase: 'explore', stepTracker: tracker, oDrought })
    expect(decideNextPhase(ctx, { step_advance_ready: true })).toBe('closing')
  })

  it('advances to closing when the only registered step is already done (no unexhausted step remains)', () => {
    const tracker = [makeStep('Mahnwesen: Bearbeitung', 'done', fullSlots, { potenzial: fullPotenzial, id: 'S001' })]
    const ctx = baseCtx({ phase: 'explore', stepTracker: tracker })
    expect(decideNextPhase(ctx, { step_advance_ready: true })).toBe('closing')
  })

  describe('no-new-extraction safety net', () => {
    it('stays in explore below the default streak limit (K=3)', () => {
      const ctx = baseCtx({ phase: 'explore' })
      expect(decideNextPhase(ctx, { noNewExtractionStreak: 2 })).toBe('explore')
    })

    it('advances to closing once the streak reaches the default limit (K=3)', () => {
      const ctx = baseCtx({ phase: 'explore' })
      expect(decideNextPhase(ctx, { noNewExtractionStreak: 3 })).toBe('closing')
    })

    it('respects NO_NEW_EXTRACTION_LIMIT env override', () => {
      const prev = process.env.NO_NEW_EXTRACTION_LIMIT
      process.env.NO_NEW_EXTRACTION_LIMIT = '5'
      try {
        const ctx = baseCtx({ phase: 'explore' })
        expect(decideNextPhase(ctx, { noNewExtractionStreak: 3 })).toBe('explore')
        expect(decideNextPhase(ctx, { noNewExtractionStreak: 5 })).toBe('closing')
      } finally {
        if (prev === undefined) delete process.env.NO_NEW_EXTRACTION_LIMIT
        else process.env.NO_NEW_EXTRACTION_LIMIT = prev
      }
    })
  })

  describe('wall-clock soft anchor (~80% of budget)', () => {
    it('stays in explore below the soft anchor', () => {
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 23, maxDurationMinutes: 30 })
      expect(decideNextPhase(ctx, null)).toBe('explore')
    })

    it('advances to closing at the soft anchor when no step is actively being explored', () => {
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 24, maxDurationMinutes: 30, stepTracker: [] })
      expect(decideNextPhase(ctx, null)).toBe('closing')
    })

    it('grants a capped grace period to an actively-explored step at the soft anchor instead of an abrupt pivot', () => {
      const tracker = [makeStep('Rechnungsprüfung', 'walkthrough')]
      // 30-min budget: soft anchor=24min, grace=min(3, 6)=3min → grace window 24-27min
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 25, maxDurationMinutes: 30, stepTracker: tracker })
      expect(decideNextPhase(ctx, null)).toBe('explore')
    })

    it('forces closing once the grace period expires, even with an active step', () => {
      const tracker = [makeStep('Rechnungsprüfung', 'walkthrough')]
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 27, maxDurationMinutes: 30, stepTracker: tracker })
      expect(decideNextPhase(ctx, null)).toBe('closing')
    })

    it('grace window is naturally capped by the hard stop for short interviews (10-min config, Tim regression)', () => {
      // 10-min budget: soft anchor=8min, grace=min(3, 2)=2min → window ends exactly at hard stop (10min)
      const tracker = [makeStep('IT-Support-Ticket', 'walkthrough')]
      const ctx = baseCtx({ phase: 'explore', timerMinutes: 9, maxDurationMinutes: 10, stepTracker: tracker })
      expect(decideNextPhase(ctx, null)).toBe('explore')
    })
  })
})

// ─── closing transitions ──────────────────────────────────────────────────────

describe('decideNextPhase — closing', () => {
  it('stays in closing before the probe is answered', () => {
    const history = [{ role: 'user' as const, content: 'Ja' }, { role: 'assistant' as const, content: 'Gut zu wissen.' }]
    expect(decideNextPhase(baseCtx({ phase: 'closing', history, historyLength: 2 }), null)).toBe('closing')
  })

  it('advances to completed after the probe is asked and answered, no cards', () => {
    const history = [
      { role: 'assistant' as const, content: CLOSING_PROBE_TEXT },
      { role: 'user' as const, content: 'Nein, das war es eigentlich.' },
    ]
    expect(decideNextPhase(baseCtx({ phase: 'closing', history, historyLength: 2 }), null)).toBe('completed')
  })

  it('advances to clarification when the Analyst provided clarification_cards', () => {
    const history = [
      { role: 'assistant' as const, content: CLOSING_PROBE_TEXT },
      { role: 'user' as const, content: 'Nein.' },
    ]
    const analystSuggestion = {
      clarification_cards: [{ process_step_id: 'uuid-1', step_title: 'Rechnungsprüfung', question: 'Wie oft?', options: ['Täglich', 'Wöchentlich', 'Andere'], slot_key: 'frequency' }],
    }
    expect(decideNextPhase(baseCtx({ phase: 'closing', history, historyLength: 2 }), analystSuggestion)).toBe('clarification')
  })

  it('routes a newly-discovered process during closing back to explore, first-class (no clarification-only cap)', () => {
    const lateStep = makeStep('Reisekostenabrechnung', 'exploring')
    expect(decideNextPhase(baseCtx({ phase: 'closing', historyLength: 10, stepTracker: [lateStep] }), null)).toBe('explore')
  })

  // PROJ-44 Remediation (H-1): the synchronous Analyst can register a new step
  // AND slot it in the same pass, bumping it straight to 'walkthrough' — the
  // status-only hasStepInStatus('exploring') check above misses that case.
  it('routes a new step back to explore even when the synchronous Analyst already advanced it past exploring this turn (H-1)', () => {
    const freshlySlottedStep = makeStep('Mahnwesen: Bearbeitung', 'walkthrough', undefined, { id: 'S002' })
    const ctx = baseCtx({ phase: 'closing', historyLength: 10, stepTracker: [freshlySlottedStep], newStepThisTurn: true })
    expect(decideNextPhase(ctx, null)).toBe('explore')
  })

  it('stays in closing when the last assistant turn is not the deterministic probe text', () => {
    const history = [
      { role: 'assistant' as const, content: 'Irgendwas anderes noch?' },
      { role: 'user' as const, content: 'Nein.' },
    ]
    expect(decideNextPhase(baseCtx({ phase: 'closing', history, historyLength: 2 }), null)).toBe('closing')
  })
})

// ─── clarification ────────────────────────────────────────────────────────────

describe('decideNextPhase — clarification', () => {
  it('stays in clarification (route handler owns the exit via DB)', () => {
    expect(decideNextPhase(baseCtx({ phase: 'clarification' }), null)).toBe('clarification')
  })
})

// ─── Hard-Stop ────────────────────────────────────────────────────────────────

describe('decideNextPhase — hard stop', () => {
  it('forces closing when timer exceeded from any phase', () => {
    expect(decideNextPhase(baseCtx({ phase: 'explore', timerMinutes: 30, maxDurationMinutes: 30 }), null)).toBe('closing')
    expect(decideNextPhase(baseCtx({ phase: 'intro', timerMinutes: 31, maxDurationMinutes: 30 }), null)).toBe('closing')
  })

  it('does not regress a hard-stopped, actively-exploring step back to explore', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'exploring')]
    expect(decideNextPhase(baseCtx({ phase: 'closing', timerMinutes: 30, maxDurationMinutes: 30, stepTracker: tracker }), null)).toBe('closing')
  })
})

// ─── checkLifecycle ───────────────────────────────────────────────────────────

describe('checkLifecycle', () => {
  it('returns hard_stop when timer exceeded', () => {
    const result = checkLifecycle(baseCtx({ timerMinutes: 30, maxDurationMinutes: 30 }), null)
    expect(result.shouldComplete).toBe(true)
    expect(result.reason).toBe('hard_stop')
  })

  it('returns soft_confirm in closing after the deterministic probe is answered', () => {
    const history = [
      { role: 'assistant' as const, content: CLOSING_PROBE_TEXT },
      { role: 'user' as const, content: 'Nein, war alles.' },
    ]
    const result = checkLifecycle(baseCtx({ phase: 'closing', history, historyLength: 2 }), null)
    expect(result.shouldComplete).toBe(true)
    expect(result.reason).toBe('soft_confirm')
  })

  it('does NOT complete when clarification_cards are pending', () => {
    const history = [
      { role: 'assistant' as const, content: CLOSING_PROBE_TEXT },
      { role: 'user' as const, content: 'Nein.' },
    ]
    const analystSuggestion = {
      clarification_cards: [{ process_step_id: 'x', step_title: 'Test', question: 'Wie oft?', options: ['A', 'B'], slot_key: 'frequency' }],
    }
    const result = checkLifecycle(baseCtx({ phase: 'closing', history, historyLength: 2 }), analystSuggestion)
    expect(result.shouldComplete).toBe(false)
  })

  it('does NOT complete when a newly-discovered process is still exploring during closing', () => {
    const tracker = [makeStep('Reisekostenabrechnung', 'exploring')]
    const history = [
      { role: 'assistant' as const, content: CLOSING_PROBE_TEXT },
      { role: 'user' as const, content: 'Ach, da gibt es noch was.' },
    ]
    const result = checkLifecycle(baseCtx({ phase: 'closing', stepTracker: tracker, history, historyLength: 2 }), null)
    expect(result.shouldComplete).toBe(false)
    expect(result.reason).toBe(null)
  })

  // PROJ-44 Remediation (H-1): same scenario, but the synchronous Analyst already
  // slotted the new step past 'exploring' this turn — newStepThisTurn must still veto.
  it('does NOT complete when a new step was registered+slotted this turn (H-1), even though its status already advanced past exploring', () => {
    const freshlySlottedStep = makeStep('Reisekostenabrechnung', 'walkthrough', undefined, { id: 'S002' })
    const history = [
      { role: 'assistant' as const, content: CLOSING_PROBE_TEXT },
      { role: 'user' as const, content: 'Ach, da gibt es noch was, das mache ich auch.' },
    ]
    const result = checkLifecycle(baseCtx({ phase: 'closing', stepTracker: [freshlySlottedStep], history, historyLength: 2, newStepThisTurn: true }), null)
    expect(result.shouldComplete).toBe(false)
    expect(result.reason).toBe(null)
  })

  it('returns no completion outside closing when timer is fine', () => {
    const result = checkLifecycle(baseCtx({ phase: 'explore', timerMinutes: 5, maxDurationMinutes: 30 }), null)
    expect(result.shouldComplete).toBe(false)
    expect(result.reason).toBe(null)
  })

  it('does not rely on text-heuristic farewell-loop detection (removed, KI-23) — repeated goodbyes alone do not complete', () => {
    const history = [
      { role: 'user' as const, content: 'Ja, das war alles.' },
      { role: 'assistant' as const, content: 'Vielen Dank für das Gespräch! Ich verabschiede mich herzlich.' },
      { role: 'user' as const, content: 'Danke auch.' },
      { role: 'assistant' as const, content: 'Vielen Dank und auf Wiedersehen!' },
      { role: 'user' as const, content: 'Tschüss.' },
    ]
    const result = checkLifecycle(baseCtx({ phase: 'closing', history, historyLength: 5 }), null)
    expect(result.shouldComplete).toBe(false)
  })
})

// ─── Closing probe helpers (successor to WRAP_UP_QUESTION_TEXT) ──────────────

describe('closingProbeAlreadyAsked / shouldInjectClosingProbe / closingProbeAnswerReceived', () => {
  it('closingProbeAlreadyAsked is false with no prior probe', () => {
    expect(closingProbeAlreadyAsked([{ role: 'assistant', content: 'Wie oft passiert das?' }])).toBe(false)
  })

  it('closingProbeAlreadyAsked is true once the verbatim probe is in history', () => {
    expect(closingProbeAlreadyAsked([{ role: 'assistant', content: CLOSING_PROBE_TEXT }])).toBe(true)
  })

  it('shouldInjectClosingProbe is true only when nextPhase=closing, probe not yet asked, and last message is from the user', () => {
    const history = [{ role: 'user' as const, content: 'Ja, das war so ziemlich alles.' }]
    expect(shouldInjectClosingProbe('closing', history)).toBe(true)
    expect(shouldInjectClosingProbe('explore', history)).toBe(false)
  })

  it('shouldInjectClosingProbe is false once the probe was already asked', () => {
    const history = [
      { role: 'assistant' as const, content: CLOSING_PROBE_TEXT },
      { role: 'user' as const, content: 'Nein.' },
    ]
    expect(shouldInjectClosingProbe('closing', history)).toBe(false)
  })

  it('closingProbeAnswerReceived requires both the probe asked AND a trailing user reply', () => {
    const asked = [{ role: 'assistant' as const, content: CLOSING_PROBE_TEXT }]
    expect(closingProbeAnswerReceived(asked)).toBe(false) // no reply yet
    expect(closingProbeAnswerReceived([...asked, { role: 'user' as const, content: 'Nein.' }])).toBe(true)
  })
})

// ─── computeFocusLock / updateODrought / hasNewStepThisTurn (PROJ-44 Remediation) ──

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

describe('hasNewStepThisTurn (H-1 tracker-diff)', () => {
  it('is false when the tracker is unchanged', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' })]
    expect(hasNewStepThisTurn(tracker, tracker)).toBe(false)
  })

  it('is true when a step with a new id appears in the after-tracker', () => {
    const before = [makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' })]
    const after = [...before, makeStep('Mahnwesen: Bearbeitung', 'exploring', undefined, { id: 'S002' })]
    expect(hasNewStepThisTurn(before, after)).toBe(true)
  })

  it('is false for a merge that only combines pre-existing ids (canonical id preserved, no new id introduced)', () => {
    const before = [
      makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' }),
      makeStep('Rechnungsprüfung: Detail', 'exploring', undefined, { id: 'S002' }),
    ]
    // Simulates computeMergedSteps collapsing S002 into canonical S001 — no new id.
    const after = [makeStep('Rechnungsprüfung', 'walkthrough', undefined, { id: 'S001' })]
    expect(hasNewStepThisTurn(before, after)).toBe(false)
  })
})
