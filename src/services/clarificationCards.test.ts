import { describe, it, expect } from 'vitest'
import { computeMandatoryNumericGaps, buildDeterministicSlotCards, computeClarificationCards } from './clarificationCards'
import type { StepEntry } from './interviewSemantic'
import type { ClarificationCard } from './interviewTypes'

const emptySlots: StepEntry['slots'] = {
  entscheidungslogik: null,
  tazite_cues: null,
  ausnahmen: null,
  inputs: null,
  outputs: null,
  hilfsmittel: null,
  reibungspunkte: null,
  ausloeser: null,
  aufgabentyp: null,
  risiko_schwere: null,
  standardisierungsgrad: null,
  informationsdichte: null,
}

function makeStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return {
    id: 'S001',
    title: 'Rechnungsprüfung',
    reihenfolge: 1,
    abhaengigkeiten: null,
    status: 'walkthrough',
    potenzial: { frequency: null, duration: null, error_rate_percent: null, media_breaks: null },
    slots: emptySlots,
    ...overrides,
  }
}

describe('computeMandatoryNumericGaps (AC4 gate)', () => {
  it('reports one gap per empty mandatory slot, media_breaks excluded', () => {
    const gaps = computeMandatoryNumericGaps([makeStep()])
    expect(gaps.map((g) => g.slot).sort()).toEqual(['duration', 'error_rate_percent', 'frequency'])
  })

  it('a filled value resolves the gap', () => {
    const step = makeStep({ potenzial: { frequency: { value: 4, quote: 'q', nicht_befund_typ: null }, duration: null, error_rate_percent: null, media_breaks: null } })
    const gaps = computeMandatoryNumericGaps([step])
    expect(gaps.map((g) => g.slot)).not.toContain('frequency')
  })

  it('an explicit nicht_befund_typ resolves the gap', () => {
    const step = makeStep({ potenzial: { frequency: { value: null, quote: 'q', nicht_befund_typ: 'unbekannt' }, duration: null, error_rate_percent: null, media_breaks: null } })
    const gaps = computeMandatoryNumericGaps([step])
    expect(gaps.map((g) => g.slot)).not.toContain('frequency')
  })

  it('a richtung-only slot is still a gap (AC2: the card must still fire)', () => {
    const step = makeStep({ potenzial: { frequency: { value: null, quote: 'q', nicht_befund_typ: null, richtung: 'niedrig' }, duration: null, error_rate_percent: null, media_breaks: null } })
    const gaps = computeMandatoryNumericGaps([step])
    expect(gaps.map((g) => g.slot)).toContain('frequency')
  })

  it('scans every registered step regardless of status (late-discovery edge case)', () => {
    const gaps = computeMandatoryNumericGaps([makeStep({ status: 'exploring' }), makeStep({ id: 'S002', status: 'done' })])
    expect(gaps.length).toBe(6)
  })
})

describe('buildDeterministicSlotCards', () => {
  it('builds one card per gap with a fixed question text and no LLM involvement', () => {
    const step = makeStep({ potenzial: { frequency: null, duration: null, error_rate_percent: { value: 2, quote: 'q', nicht_befund_typ: null }, media_breaks: null } })
    const cards = buildDeterministicSlotCards([step])
    expect(cards).toHaveLength(2)
    expect(cards.every((c) => c.process_step_id === 'S001' && c.step_title === 'Rechnungsprüfung')).toBe(true)
    expect(cards.map((c) => c.slot_key).sort()).toEqual(['duration', 'frequency'])
    expect(cards.every((c) => typeof c.question === 'string' && c.question.length > 0)).toBe(true)
  })

  it('AC4 priority: richtung=hoch sorts before richtung=niedrig, both before no signal', () => {
    const lowStep = makeStep({
      id: 'S001',
      title: 'Niedrig',
      potenzial: { frequency: { value: null, quote: 'q', nicht_befund_typ: null, richtung: 'niedrig' }, duration: null, error_rate_percent: null, media_breaks: null },
    })
    const highStep = makeStep({
      id: 'S002',
      title: 'Hoch',
      potenzial: { frequency: { value: null, quote: 'q', nicht_befund_typ: null, richtung: 'hoch' }, duration: null, error_rate_percent: null, media_breaks: null },
    })
    const noneStep = makeStep({ id: 'S003', title: 'Kein Signal' })

    const cards = buildDeterministicSlotCards([lowStep, highStep, noneStep])
    const frequencyCardOrder = cards.filter((c) => c.slot_key === 'frequency').map((c) => c.step_title)
    expect(frequencyCardOrder).toEqual(['Hoch', 'Niedrig', 'Kein Signal'])
  })

  it('carries the captured direction onto the card for UI bucket selection (AC2)', () => {
    const step = makeStep({ potenzial: { frequency: { value: null, quote: 'q', nicht_befund_typ: null, richtung: 'hoch' }, duration: null, error_rate_percent: null, media_breaks: null } })
    const cards = buildDeterministicSlotCards([step])
    expect(cards.find((c) => c.slot_key === 'frequency')?.direction).toBe('hoch')
  })

  it('returns nothing when every mandatory numeric slot is resolved', () => {
    const step = makeStep({
      potenzial: {
        frequency: { value: 4, quote: 'q', nicht_befund_typ: null },
        duration: { value: 10, quote: 'q', nicht_befund_typ: null },
        error_rate_percent: { value: 2, quote: 'q', nicht_befund_typ: null },
        media_breaks: null,
      },
    })
    expect(buildDeterministicSlotCards([step])).toEqual([])
  })
})

describe('computeClarificationCards (D.6 merge + cap)', () => {
  it('numeric cards always precede LLM-suggested cards', () => {
    const step = makeStep({ potenzial: { frequency: null, duration: null, error_rate_percent: { value: 2, quote: 'q', nicht_befund_typ: null }, media_breaks: null } })
    const llmCards: ClarificationCard[] = [{ process_step_id: 'S001', step_title: 'Rechnungsprüfung', question: 'Passt das?', options: ['Ja', 'Nein'], slot_key: 'qualitative', answer_type: 'multi' }]
    const merged = computeClarificationCards([step], llmCards)
    expect(merged[0].slot_key).not.toBe('qualitative')
    expect(merged.at(-1)?.slot_key).toBe('qualitative')
  })

  it('drops any stray LLM card for a numeric slot — those three fields are exclusively code-owned (D.3/D.5)', () => {
    const step = makeStep() // 3 gaps
    const llmCards: ClarificationCard[] = [{ process_step_id: 'S001', step_title: 'Rechnungsprüfung', question: 'LLM-Frequenzfrage', options: [], slot_key: 'frequency' }]
    const merged = computeClarificationCards([step], llmCards)
    // Exactly one frequency card (the deterministic one), not two.
    expect(merged.filter((c) => c.slot_key === 'frequency')).toHaveLength(1)
    expect(merged.find((c) => c.slot_key === 'frequency')?.question).not.toBe('LLM-Frequenzfrage')
  })

  it('caps the merged list at 8', () => {
    const steps = Array.from({ length: 5 }, (_, i) => makeStep({ id: `S00${i + 1}`, title: `Step ${i + 1}` })) // 15 numeric gaps
    const merged = computeClarificationCards(steps, undefined)
    expect(merged).toHaveLength(8)
  })

  it('returns an empty list when nothing is missing and the LLM suggested nothing', () => {
    expect(computeClarificationCards([], undefined)).toEqual([])
  })
})
