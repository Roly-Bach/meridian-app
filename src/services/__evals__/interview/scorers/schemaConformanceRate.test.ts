/**
 * PROJ-27 / BL-E1.3: schemaConformanceRate scorer tests.
 */
import { describe, it, expect } from 'vitest'
import { scoreSchemaConformanceRate } from './schemaConformanceRate'
import type { StepEntry } from '@/services/interviewSemantic'

function makeStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return {
    id: 'S001',
    title: 'Rechnungsprüfung',
    reihenfolge: 1,
    governance: null,
    abhaengigkeiten: null,
    status: 'exploring',
    potenzial: {
      frequency_per_month: null,
      duration_minutes: null,
      error_rate_percent: null,
      media_breaks: null,
    },
    slots: {
      entscheidungslogik: null,
      tazite_cues: null,
      ausnahmen: null,
      inputs: null,
      outputs: null,
      hilfsmittel: null,
    },
    ...overrides,
  }
}

describe('scoreSchemaConformanceRate', () => {
  it('returns 1.0 for empty tracker', () => {
    expect(scoreSchemaConformanceRate([])).toBe(1.0)
  })

  it('returns 1.0 for a single valid step with id', () => {
    const score = scoreSchemaConformanceRate([makeStep({ id: 'S001' })])
    expect(score).toBe(1.0)
  })

  it('returns 1.0 for multiple valid steps', () => {
    const steps = [
      makeStep({ id: 'S001', title: 'Rechnungsprüfung', reihenfolge: 1 }),
      makeStep({ id: 'S002', title: 'Monatsabschluss', reihenfolge: 2 }),
      makeStep({ id: 'S003', title: 'Buchung', reihenfolge: 3 }),
    ]
    expect(scoreSchemaConformanceRate(steps)).toBe(1.0)
  })

  it('falls back gracefully for step without id (uses fallback S-id, still valid)', () => {
    const step = makeStep({ id: undefined })
    const score = scoreSchemaConformanceRate([step])
    expect(score).toBe(1.0)
  })

  it('step with potenzial data passes validation', () => {
    const step = makeStep({
      id: 'S001',
      potenzial: {
        frequency_per_month: { value: 20, quote: 'q', confidence: 'confirmed' },
        duration_minutes: { value: 60, quote: 'q', confidence: 'estimate' },
        error_rate_percent: null,
        media_breaks: null,
      },
    })
    expect(scoreSchemaConformanceRate([step])).toBe(1.0)
  })

  it('step with filled tazite slots passes validation', () => {
    const step = makeStep({
      id: 'S001',
      slots: {
        entscheidungslogik: { value: 'regel-basiert', quote: 'q', nicht_befund_typ: null },
        tazite_cues: { value: ['Erfahrung'], quote: 'q', nicht_befund_typ: null },
        ausnahmen: { value: ['Sonderfall'], quote: 'q', nicht_befund_typ: null },
        inputs: { value: ['Rechnung'], quote: 'q', nicht_befund_typ: null },
        outputs: { value: ['Buchung'], quote: 'q', nicht_befund_typ: null },
        hilfsmittel: { value: ['SAP'], quote: 'q', nicht_befund_typ: null },
      },
    })
    expect(scoreSchemaConformanceRate([step])).toBe(1.0)
  })

  it('step with governance data passes validation', () => {
    const step = makeStep({
      id: 'S001',
      governance: { rolle: 'Buchhalter', organisationseinheit: 'Finanzen', systeme: ['SAP'], nicht_befund_typ: null },
    })
    expect(scoreSchemaConformanceRate([step])).toBe(1.0)
  })

  it('score is between 0 and 1', () => {
    const steps = [makeStep({ id: 'S001' }), makeStep({ id: 'S002', reihenfolge: 2 })]
    const score = scoreSchemaConformanceRate(steps)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })
})
