import { describe, it, expect, vi } from 'vitest'

// interviewAgent transitively imports supabase-admin (server-only). Mock it here.
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: vi.fn() }),
}))

import { scoreStepRegistrationCoverage } from './stepRegistrationCoverage'
import type { StepEntry } from '@/services/interviewAgent'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const emptySlots: StepEntry['slots'] = {
  frequency_per_month: null,
  duration_minutes: null,
  rule_based: null,
  data_sources: null,
  error_rate_percent: null,
  media_breaks: null,
}

function makeStep(title: string): StepEntry {
  return {
    title,
    role: null,
    status: 'done',
    slots: emptySlots,
    process_steps: [],
    friction_points: [],
    friction_tools: [],
    pain_point_primary: null,
  }
}

// ─── Happy Path ───────────────────────────────────────────────────────────────

describe('scoreStepRegistrationCoverage — happy path', () => {
  it('2 steps same colon-parent → 1 group → score 0.5 when expectedProcessCount=2', () => {
    const tracker = [
      makeStep('Rechnung: Eingang prüfen'),
      makeStep('Rechnung: Verbuchung'),
    ]
    expect(scoreStepRegistrationCoverage(tracker, 2)).toBe(0.5)
  })

  it('2 steps different colon-parents → 2 groups → score 1.0 when expectedProcessCount=2', () => {
    const tracker = [
      makeStep('Rechnung: Eingang prüfen'),
      makeStep('Monatsabschluss: Abstimmung'),
    ]
    expect(scoreStepRegistrationCoverage(tracker, 2)).toBe(1.0)
  })
})

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe('scoreStepRegistrationCoverage — edge cases', () => {
  it('empty stepTracker with expectedProcessCount=2 → score 0', () => {
    expect(scoreStepRegistrationCoverage([], 2)).toBe(0)
  })

  it('expectedProcessCount=0 → score 1.0 (avoid division by zero)', () => {
    const tracker = [makeStep('Rechnungsprüfung')]
    expect(scoreStepRegistrationCoverage(tracker, 0)).toBe(1.0)
  })

  it('expectedProcessCount=undefined → score 1.0', () => {
    const tracker = [makeStep('Rechnungsprüfung')]
    expect(scoreStepRegistrationCoverage(tracker, undefined)).toBe(1.0)
  })

  it('3 groups when expectedProcessCount=2 → score capped at 1.0, not above', () => {
    const tracker = [
      makeStep('Rechnung: Eingang'),
      makeStep('Monatsabschluss: Abstimmung'),
      makeStep('Mahnprozess: Versand'),
    ]
    const score = scoreStepRegistrationCoverage(tracker, 2)
    expect(score).toBe(1.0)
    expect(score).not.toBeGreaterThan(1.0)
  })
})

// ─── tokenJaccard Fallback ────────────────────────────────────────────────────

describe('scoreStepRegistrationCoverage — tokenJaccard fallback (no colon)', () => {
  it('2 steps without colon but similar titles (Jaccard >= 0.4) → 1 group → score 0.5 at expectedProcessCount=2', () => {
    // "Rechnungsprüfung und Verbuchung" vs "Rechnungsprüfung und -verbuchung"
    // tokenize strips punctuation; "rechnungsprüfung" appears in both → high Jaccard
    const tracker = [
      makeStep('Rechnungsprüfung und Verbuchung'),
      makeStep('Rechnungsprüfung und -verbuchung'),
    ]
    const score = scoreStepRegistrationCoverage(tracker, 2)
    // Both resolve to the same group → 1 group / 2 expected = 0.5
    expect(score).toBe(0.5)
  })

  it('2 steps with distinct token sets (Jaccard < 0.4) → 2 groups → score 1.0 at expectedProcessCount=2', () => {
    const tracker = [
      makeStep('Rechnungsprüfung'),
      makeStep('Monatsabschluss'),
    ]
    // "rechnungsprüfung" and "monatsabschluss" share no tokens → Jaccard 0 → 2 groups
    expect(scoreStepRegistrationCoverage(tracker, 2)).toBe(1.0)
  })
})
