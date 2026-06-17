import { describe, it, expect } from 'vitest'
import { scoreSlotCoverage, scoreDedupCoverage, scoreGovernanceCoverage } from './slotCoverage'
import type { StepEntry, TaziteSlot, TaziteSlotArray, GovernanceSlot } from '@/services/interviewSemantic'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const tazite = (value: string): TaziteSlot => ({
  value,
  quote: value,
  confidence: 'confirmed',
  nicht_befund_typ: null,
})

const taziteArray = (values: string[]): TaziteSlotArray => ({
  value: values,
  quote: values[0] ?? null,
  confidence: 'confirmed',
  nicht_befund_typ: null,
})

const taziteNichtZutreffend = (): TaziteSlot => ({
  value: null,
  quote: null,
  nicht_befund_typ: 'nicht_zutreffend',
})

const makeStep = (
  overrides: Partial<StepEntry> = {},
  slotOverrides: Partial<StepEntry['slots']> = {},
): StepEntry => ({
  title: 'Rechnungsprüfung',
  reihenfolge: 1,
  governance: null,
  abhaengigkeiten: null,
  potenzial: {
    frequency_per_month: null,
    duration_minutes: null,
    error_rate_percent: null,
    media_breaks: null,
  },
  status: 'done',
  slots: {
    entscheidungslogik: null,
    tazite_cues: null,
    ausnahmen: null,
    inputs: null,
    outputs: null,
    hilfsmittel: null,
    ...slotOverrides,
  },
  ...overrides,
})

const fullyFilledStep = (reihenfolge = 1): StepEntry =>
  makeStep(
    {
      title: 'Vollständiger Schritt',
      reihenfolge,
      abhaengigkeiten: { depends_on: ['Vorstufe'], influences: [], nicht_befund_typ: null },
    },
    {
      entscheidungslogik: tazite('Freigabe ab 5000 EUR'),
      tazite_cues: taziteArray(['Erfahrung nötig']),
      ausnahmen: taziteArray(['Eilbuchung']),
      inputs: taziteArray(['Eingangsrechnung']),
      outputs: taziteArray(['Buchungssatz']),
      hilfsmittel: taziteArray(['SAP FI']),
    },
  )

// ─── scoreSlotCoverage ────────────────────────────────────────────────────────

describe('scoreSlotCoverage', () => {
  it('returns 0 for empty tracker', () => {
    expect(scoreSlotCoverage([])).toBe(0)
  })

  it('bare step: title + reihenfolge = 2/9', () => {
    expect(scoreSlotCoverage([makeStep()])).toBeCloseTo(2 / 9)
  })

  it('returns 1.0 when all 9 O1–O6 fields filled', () => {
    expect(scoreSlotCoverage([fullyFilledStep()])).toBe(1.0)
  })

  it('nicht_befund_typ counts as filled even with null value', () => {
    const step = makeStep({}, { entscheidungslogik: taziteNichtZutreffend() })
    // bezeichnung + reihenfolge + entscheidungslogik = 3/9
    expect(scoreSlotCoverage([step])).toBeCloseTo(3 / 9)
  })

  it('potenzial fields do NOT count toward O1–O6 coverage', () => {
    const step = makeStep({
      potenzial: {
        frequency_per_month: { value: 90, quote: '90', confidence: 'confirmed' },
        duration_minutes: { value: 30, quote: '30', confidence: 'confirmed' },
        error_rate_percent: null,
        media_breaks: null,
      },
    })
    // Only title + reihenfolge = 2/9 (potenzial not counted)
    expect(scoreSlotCoverage([step])).toBeCloseTo(2 / 9)
  })

  it('abhaengigkeiten with at least one edge = filled', () => {
    const step = makeStep({ abhaengigkeiten: { depends_on: ['Step A'], influences: [], nicht_befund_typ: null } })
    // bezeichnung + reihenfolge + abhaengigkeiten = 3/9
    expect(scoreSlotCoverage([step])).toBeCloseTo(3 / 9)
  })

  it('abhaengigkeiten empty arrays + keine nicht_befund_typ = not filled', () => {
    const step = makeStep({ abhaengigkeiten: { depends_on: [], influences: [], nicht_befund_typ: null } })
    expect(scoreSlotCoverage([step])).toBeCloseTo(2 / 9)
  })

  it('abhaengigkeiten with nicht_befund_typ = filled', () => {
    const step = makeStep({ abhaengigkeiten: { depends_on: [], influences: [], nicht_befund_typ: 'nicht_zutreffend' } })
    expect(scoreSlotCoverage([step])).toBeCloseTo(3 / 9)
  })

  it('calculates correctly across two steps', () => {
    const step1 = fullyFilledStep(1)  // 9/9
    const step2 = makeStep({ reihenfolge: 2, title: 'Freigabe' })  // 2/9
    // (9 + 2) / (2 × 9) = 11/18
    expect(scoreSlotCoverage([step1, step2])).toBeCloseTo(11 / 18)
  })
})

// ─── scoreDedupCoverage ───────────────────────────────────────────────────────

describe('scoreDedupCoverage', () => {
  it('returns 0 for empty tracker', () => {
    expect(scoreDedupCoverage([])).toBe(0)
  })

  it('deduped single step = same as scoreSlotCoverage', () => {
    const step = fullyFilledStep()
    expect(scoreDedupCoverage([step])).toBe(1.0)
  })

  it('two semantically identical steps merge: union of fields', () => {
    const step1 = makeStep({ title: 'Rechnungsprüfung: Erstprüfung', reihenfolge: 1 }, {
      entscheidungslogik: tazite('Freigabe'),
    })
    const step2 = makeStep({ title: 'Rechnungsprüfung: Zweitprüfung', reihenfolge: 2 }, {
      tazite_cues: taziteArray(['Erfahrung nötig']),
    })
    // Both share colon-parent "Rechnungsprüfung" → merged into one group
    // group has: bezeichnung + reihenfolge + entscheidungslogik + tazite_cues = 4 fields
    // 4/9 as one group
    const score = scoreDedupCoverage([step1, step2])
    // scoreDedupCoverage merges → 4/9 ≈ 0.444
    expect(score).toBeGreaterThan(2 / 9)   // better than bare step
    expect(score).toBeLessThan(1.0)
  })
})

// ─── scoreGovernanceCoverage ──────────────────────────────────────────────────

describe('scoreGovernanceCoverage', () => {
  it('returns 0 for empty tracker', () => {
    expect(scoreGovernanceCoverage([])).toBe(0)
  })

  it('returns 0 when all governance null', () => {
    expect(scoreGovernanceCoverage([makeStep(), makeStep({ title: 'Freigabe', reihenfolge: 2 })])).toBe(0)
  })

  it('returns 1.0 when all steps have governance role', () => {
    const gov: GovernanceSlot = { rolle: 'Buchhalter', organisationseinheit: null, systeme: null, nicht_befund_typ: null }
    const steps = [
      makeStep({ governance: gov, reihenfolge: 1 }),
      makeStep({ governance: gov, title: 'Freigabe', reihenfolge: 2 }),
    ]
    expect(scoreGovernanceCoverage(steps)).toBe(1.0)
  })

  it('counts nicht_befund_typ as filled', () => {
    const gov: GovernanceSlot = { rolle: null, organisationseinheit: null, systeme: null, nicht_befund_typ: 'unbekannt' }
    expect(scoreGovernanceCoverage([makeStep({ governance: gov })])).toBe(1.0)
  })

  it('partial fill: 1 of 2 steps has governance', () => {
    const gov: GovernanceSlot = { rolle: 'Controller', organisationseinheit: 'Finance', systeme: null, nicht_befund_typ: null }
    const steps = [
      makeStep({ governance: gov, reihenfolge: 1 }),
      makeStep({ reihenfolge: 2, title: 'Monatsabschluss' }),
    ]
    expect(scoreGovernanceCoverage(steps)).toBe(0.5)
  })

  it('systeme array filled = counts as filled', () => {
    const gov: GovernanceSlot = { rolle: null, organisationseinheit: null, systeme: ['SAP'], nicht_befund_typ: null }
    expect(scoreGovernanceCoverage([makeStep({ governance: gov })])).toBe(1.0)
  })

  it('empty systeme array alone does NOT count as filled', () => {
    const gov: GovernanceSlot = { rolle: null, organisationseinheit: null, systeme: [], nicht_befund_typ: null }
    expect(scoreGovernanceCoverage([makeStep({ governance: gov })])).toBe(0)
  })
})
