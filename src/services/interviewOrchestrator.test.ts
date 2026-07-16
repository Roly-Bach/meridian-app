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
  CLOSING_PROBE_TEXT,
  type OrchestratorContext,
} from './interviewOrchestrator'
import type { StepEntry } from './interviewSemantic'

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

  it('stays in explore when step_advance_ready is true but an open focus topic remains unregistered (breadth-first)', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough')]
    const ctx = baseCtx({ phase: 'explore', stepTracker: tracker, topicsOpen: ['Mahnwesen'] })
    expect(decideNextPhase(ctx, { step_advance_ready: true })).toBe('explore')
  })

  it('advances to closing when step_advance_ready is true and no open focus topic remains', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough')]
    const ctx = baseCtx({ phase: 'explore', stepTracker: tracker, topicsOpen: [] })
    expect(decideNextPhase(ctx, { step_advance_ready: true })).toBe('closing')
  })

  it('advances to closing when the open focus topic is already reflected as a registered step', () => {
    const tracker = [makeStep('Mahnwesen: Bearbeitung', 'done', fullSlots, { potenzial: fullPotenzial })]
    const ctx = baseCtx({ phase: 'explore', stepTracker: tracker, topicsOpen: ['Mahnwesen'] })
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
      wrap_up_question_asked: true,
      clarification_cards: [{ process_step_id: 'uuid-1', step_title: 'Rechnungsprüfung', question: 'Wie oft?', options: ['Täglich', 'Wöchentlich', 'Andere'], slot_key: 'frequency' }],
    }
    expect(decideNextPhase(baseCtx({ phase: 'closing', history, historyLength: 2 }), analystSuggestion)).toBe('clarification')
  })

  it('routes a newly-discovered process during closing back to explore, first-class (no clarification-only cap)', () => {
    const lateStep = makeStep('Reisekostenabrechnung', 'exploring')
    expect(decideNextPhase(baseCtx({ phase: 'closing', historyLength: 10, stepTracker: [lateStep] }), null)).toBe('explore')
  })

  it('stays in closing when only the Analyst flag is set but the deterministic probe is not in history', () => {
    const history = [
      { role: 'assistant' as const, content: 'Irgendwas anderes noch?' },
      { role: 'user' as const, content: 'Nein.' },
    ]
    const analystSuggestion = { wrap_up_question_asked: true }
    expect(decideNextPhase(baseCtx({ phase: 'closing', history, historyLength: 2 }), analystSuggestion)).toBe('closing')
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
      wrap_up_question_asked: true,
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
