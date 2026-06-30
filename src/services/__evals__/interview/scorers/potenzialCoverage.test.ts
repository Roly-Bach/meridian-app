import { describe, it, expect } from 'vitest'
import { scorePotenzialCoverage, scoreDedupPotenzialCoverage } from './potenzialCoverage'
import type { StepEntry, SlotValue } from '@/services/interviewSemantic'

const sv = (value: string | number): SlotValue => ({ value, quote: String(value), confidence: 'confirmed' })
const svNichtBefund = (): SlotValue => ({ value: null, quote: '', nicht_befund_typ: 'nicht_zutreffend' })

const makeStep = (
  potenzial: Partial<StepEntry['potenzial']> = {},
  overrides: Partial<StepEntry> = {},
): StepEntry => ({
  title: 'Rechnungsprüfung',
  reihenfolge: 1,
  governance: null,
  abhaengigkeiten: null,
  potenzial: { frequency_per_month: null, duration_minutes: null, error_rate_percent: null, media_breaks: null, ...potenzial },
  status: 'done',
  slots: { entscheidungslogik: null, tazite_cues: null, ausnahmen: null, inputs: null, outputs: null, hilfsmittel: null },
  ...overrides,
})

describe('scorePotenzialCoverage', () => {
  it('empty tracker → 0', () => {
    expect(scorePotenzialCoverage([])).toBe(0)
  })

  it('2 of 4 potenzial slots filled → 0.5', () => {
    const step = makeStep({ frequency_per_month: sv(90), duration_minutes: sv(15) })
    expect(scorePotenzialCoverage([step])).toBe(0.5)
  })

  it('nicht_befund_typ counts as filled', () => {
    const step = makeStep({ frequency_per_month: sv(90), error_rate_percent: svNichtBefund() })
    expect(scorePotenzialCoverage([step])).toBe(0.5)
  })

  it('all four filled → 1.0', () => {
    const step = makeStep({ frequency_per_month: sv(90), duration_minutes: sv(15), error_rate_percent: sv(5), media_breaks: sv(3) })
    expect(scorePotenzialCoverage([step])).toBe(1)
  })
})

describe('scoreDedupPotenzialCoverage', () => {
  it('unions potenzial across semantically equivalent fragmented steps', () => {
    // Two fragments of the same step, each with a different potenzial slot → union = 2/4 = 0.5
    const a = makeStep({ frequency_per_month: sv(90) }, { title: 'Rechnungsprüfung' })
    const b = makeStep({ duration_minutes: sv(15) }, { title: 'Rechnungsprüfung', reihenfolge: 2 })
    const dedup = scoreDedupPotenzialCoverage([a, b])
    expect(dedup).toBeGreaterThanOrEqual(0.5)
    // raw counts the empty denominator of 2 steps → 2/8 = 0.25, dedup should be higher
    expect(dedup).toBeGreaterThan(scorePotenzialCoverage([a, b]))
  })
})
