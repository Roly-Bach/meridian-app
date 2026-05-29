import { describe, it, expect, vi } from 'vitest'

// interviewOrchestrator imports computeMissingMandatorySlots from interviewAgent,
// which transitively imports supabase-admin (server-only). Mock it here.
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: vi.fn() }),
}))

import { decideNextPhase, checkLifecycle, type OrchestratorContext } from './interviewOrchestrator'
import type { StepEntry } from './interviewAgent'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const emptySlots = {
  frequency_per_month: null,
  duration_minutes: null,
  rule_based: null,
  data_sources: null,
  error_rate_percent: null,
  media_breaks: null,
}

const fullSlots = {
  frequency_per_month: { value: 8, quote: 'zweimal pro Woche', confidence: 'estimate' as const },
  duration_minutes: { value: 30, quote: '30 Minuten', confidence: 'confirmed' as const },
  rule_based: { value: true, quote: 'immer gleich', confidence: 'confirmed' as const },
  data_sources: { value: ['SAP'], quote: 'in SAP', confidence: 'confirmed' as const },
  error_rate_percent: null,
  media_breaks: null,
}

function makeStep(title: string, status: 'exploring' | 'walkthrough' | 'done', slots: StepEntry['slots'] = emptySlots, extra: Partial<StepEntry> = {}): StepEntry {
  return { title, role: null, status, slots, process_steps: [], friction_points: [], friction_tools: [], pain_point_primary: null, ...extra }
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
  it('stays in intro before 4 messages', () => {
    expect(decideNextPhase(baseCtx({ historyLength: 3 }), null)).toBe('intro')
  })

  it('advances to process_loop at 4 messages', () => {
    expect(decideNextPhase(baseCtx({ historyLength: 4 }), null)).toBe('process_loop')
  })
})

// ─── process_loop transitions ─────────────────────────────────────────────────

describe('decideNextPhase — process_loop', () => {
  it('stays in process_loop when no steps registered', () => {
    expect(decideNextPhase(baseCtx({ phase: 'process_loop', stepTracker: [] }), null)).toBe('process_loop')
  })

  it('advances to walkthrough_step when a step is in exploring status', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'exploring')]
    expect(decideNextPhase(baseCtx({ phase: 'process_loop', stepTracker: tracker }), null)).toBe('walkthrough_step')
  })
})

// ─── walkthrough_step transitions ────────────────────────────────────────────

describe('decideNextPhase — walkthrough_step', () => {
  it('stays in walkthrough_step without enough content', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', emptySlots, { process_steps: ['Schritt A', 'Schritt B'] })]
    expect(decideNextPhase(baseCtx({ phase: 'walkthrough_step', stepTracker: tracker }), null)).toBe('walkthrough_step')
  })

  it('advances to slot_completion when content threshold reached (3 items)', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', emptySlots, {
      process_steps: ['Eingang prüfen', 'SAP öffnen'],
      friction_points: ['Bestellreferenz fehlt'],
    })]
    expect(decideNextPhase(baseCtx({ phase: 'walkthrough_step', stepTracker: tracker }), null)).toBe('slot_completion')
  })

  it('advances to slot_completion with process_steps + pain_point_primary', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough', emptySlots, {
      process_steps: ['Schritt A', 'Schritt B'],
      pain_point_primary: 'Suche dauert ewig',
    })]
    expect(decideNextPhase(baseCtx({ phase: 'walkthrough_step', stepTracker: tracker }), null)).toBe('slot_completion')
  })

  it('advances to slot_completion when no active steps remain', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'done', fullSlots )]
    expect(decideNextPhase(baseCtx({ phase: 'walkthrough_step', stepTracker: tracker }), null)).toBe('slot_completion')
  })
})

// ─── slot_completion transitions ─────────────────────────────────────────────

describe('decideNextPhase — slot_completion', () => {
  it('stays in slot_completion when a step is still walkthrough', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'walkthrough')]
    expect(decideNextPhase(baseCtx({ phase: 'slot_completion', stepTracker: tracker }), null)).toBe('slot_completion')
  })

  it('advances to coverage_check when all steps done and no unexplored topics', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'done', fullSlots )]
    expect(decideNextPhase(baseCtx({ phase: 'slot_completion', stepTracker: tracker, topicsOpen: [] }), null)).toBe('coverage_check')
  })

  it('returns to process_loop when all steps done but unexplored focus topics remain', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'done', fullSlots )]
    const ctx = baseCtx({ phase: 'slot_completion', stepTracker: tracker, topicsOpen: ['Mahnwesen'] })
    expect(decideNextPhase(ctx, null)).toBe('process_loop')
  })
})

// ─── coverage_check transitions ───────────────────────────────────────────────

describe('decideNextPhase — coverage_check', () => {
  it('stays in coverage_check when mandatory slots missing', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'done', emptySlots)]
    expect(decideNextPhase(baseCtx({ phase: 'coverage_check', stepTracker: tracker }), null)).toBe('coverage_check')
  })

  it('advances to wrap_up when all mandatory slots filled', () => {
    const tracker = [makeStep('Rechnungsprüfung', 'done', fullSlots )]
    expect(decideNextPhase(baseCtx({ phase: 'coverage_check', stepTracker: tracker }), null)).toBe('wrap_up')
  })
})

// ─── wrap_up transitions ──────────────────────────────────────────────────────

describe('decideNextPhase — wrap_up', () => {
  it('stays in wrap_up before closing question is asked', () => {
    const history = [{ role: 'user' as const, content: 'Ja' }, { role: 'assistant' as const, content: 'Gut zu wissen.' }]
    expect(decideNextPhase(baseCtx({ phase: 'wrap_up', history, historyLength: 2 }), null)).toBe('wrap_up')
  })

  it('advances to completed via text heuristic after closing question + user response', () => {
    const history = [
      { role: 'assistant' as const, content: 'Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute nicht erwähnt haben?' },
      { role: 'user' as const, content: 'Nein, das war es eigentlich.' },
    ]
    expect(decideNextPhase(baseCtx({ phase: 'wrap_up', history, historyLength: 2 }), null)).toBe('completed')
  })

  it('advances to clarification when Analyst provided clarification_cards', () => {
    const history = [
      { role: 'assistant' as const, content: 'Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Nicht-Erwähntes?' },
      { role: 'user' as const, content: 'Nein.' },
    ]
    const analystSuggestion = {
      wrap_up_question_asked: true,
      clarification_cards: [{ process_step_id: 'uuid-1', step_title: 'Rechnungsprüfung', question: 'Wie oft?', options: ['Täglich', 'Wöchentlich', 'Andere'], slot_key: 'frequency' }],
    }
    expect(decideNextPhase(baseCtx({ phase: 'wrap_up', history, historyLength: 2 }), analystSuggestion)).toBe('clarification')
  })

  it('uses analystSuggestion.wrap_up_question_asked over text heuristic', () => {
    const history = [
      { role: 'assistant' as const, content: 'Irgendwas anderes noch?' },
      { role: 'user' as const, content: 'Nein.' },
    ]
    const analystSuggestion = { wrap_up_question_asked: true }
    expect(decideNextPhase(baseCtx({ phase: 'wrap_up', history, historyLength: 2 }), analystSuggestion)).toBe('completed')
  })
})

// ─── Hard-Stop ────────────────────────────────────────────────────────────────

describe('decideNextPhase — hard stop', () => {
  it('forces wrap_up when timer exceeded from any phase', () => {
    expect(decideNextPhase(baseCtx({ phase: 'process_loop', timerMinutes: 30, maxDurationMinutes: 30 }), null)).toBe('wrap_up')
    expect(decideNextPhase(baseCtx({ phase: 'slot_completion', timerMinutes: 31, maxDurationMinutes: 30 }), null)).toBe('wrap_up')
  })
})

// ─── checkLifecycle ───────────────────────────────────────────────────────────

describe('checkLifecycle', () => {
  it('returns hard_stop when timer exceeded', () => {
    const result = checkLifecycle(baseCtx({ timerMinutes: 30, maxDurationMinutes: 30 }), null)
    expect(result.shouldComplete).toBe(true)
    expect(result.reason).toBe('hard_stop')
  })

  it('returns soft_confirm in wrap_up after closing question answered', () => {
    const history = [
      { role: 'assistant' as const, content: 'Wenn du an deine letzte Arbeitswoche denkst — etwas Wiederkehrendes?' },
      { role: 'user' as const, content: 'Nein, war alles.' },
    ]
    const result = checkLifecycle(baseCtx({ phase: 'wrap_up', history, historyLength: 2 }), null)
    expect(result.shouldComplete).toBe(true)
    expect(result.reason).toBe('soft_confirm')
  })

  it('does NOT complete when clarification_cards are pending', () => {
    const history = [
      { role: 'assistant' as const, content: 'Wenn du an deine letzte Arbeitswoche denkst — gibt es Wiederkehrendes?' },
      { role: 'user' as const, content: 'Nein.' },
    ]
    const analystSuggestion = {
      wrap_up_question_asked: true,
      clarification_cards: [{ process_step_id: 'x', step_title: 'Test', question: 'Wie oft?', options: ['A', 'B'], slot_key: 'frequency' }],
    }
    const result = checkLifecycle(baseCtx({ phase: 'wrap_up', history, historyLength: 2 }), analystSuggestion)
    expect(result.shouldComplete).toBe(false)
  })

  it('returns no completion outside wrap_up when timer is fine', () => {
    const result = checkLifecycle(baseCtx({ phase: 'process_loop', timerMinutes: 5, maxDurationMinutes: 30 }), null)
    expect(result.shouldComplete).toBe(false)
    expect(result.reason).toBe(null)
  })
})
