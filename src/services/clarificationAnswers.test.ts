import { describe, it, expect } from 'vitest'
import { applyClarificationSlotAnswers } from './clarificationAnswers'
import type { StepEntry } from './interviewSemantic'

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

describe('applyClarificationSlotAnswers (AC3/AC4)', () => {
  it('resolves a bucket-label answer to its canonical value', () => {
    const [updated] = applyClarificationSlotAnswers([makeStep()], [
      { process_step_id: 'S001', slot_key: 'frequency', answer: 'Wöchentlich' },
    ])
    expect(updated.potenzial.frequency).toMatchObject({ value: 4, nicht_befund_typ: null })
  })

  it('AC3(a): resolves a free numeric answer equally to a bucket label', () => {
    const [updated] = applyClarificationSlotAnswers([makeStep()], [
      { process_step_id: 'S001', slot_key: 'duration', answer: '17' },
    ])
    expect(updated.potenzial.duration).toMatchObject({ value: 17 })
  })

  it('AC3(a): resolves a free range answer to its mean', () => {
    const [updated] = applyClarificationSlotAnswers([makeStep()], [
      { process_step_id: 'S001', slot_key: 'error_rate_percent', answer: '10-20' },
    ])
    expect(updated.potenzial.error_rate_percent).toMatchObject({ value: 15 })
  })

  it('AC2: a bucket label resolves against the richtung captured live, not the default variant', () => {
    const step = makeStep({
      potenzial: { frequency: { value: null, quote: 'q', nicht_befund_typ: null, richtung: 'hoch' }, duration: null, error_rate_percent: null, media_breaks: null },
    })
    const [updated] = applyClarificationSlotAnswers([step], [
      { process_step_id: 'S001', slot_key: 'frequency', answer: 'Mehrmals täglich' },
    ])
    expect(updated.potenzial.frequency?.value).toBe(44)
  })

  it('AC4: "Weiß ich nicht" resolves the gate via nicht_befund_typ, not a silent no-op', () => {
    const [updated] = applyClarificationSlotAnswers([makeStep()], [
      { process_step_id: 'S001', slot_key: 'frequency', answer: 'Weiß ich nicht' },
    ])
    expect(updated.potenzial.frequency).toMatchObject({ value: null, nicht_befund_typ: 'unbekannt' })
  })

  it('an unparseable free-text answer is left as an open gap, not guessed', () => {
    const [updated] = applyClarificationSlotAnswers([makeStep()], [
      { process_step_id: 'S001', slot_key: 'frequency', answer: 'irgendwas' },
    ])
    expect(updated.potenzial.frequency).toBeNull()
  })

  it('entscheidungslogik SlotCard answers are unchanged (AC3 does not extend this card type)', () => {
    const [updated] = applyClarificationSlotAnswers([makeStep()], [
      { process_step_id: 'S001', slot_key: 'entscheidungslogik', answer: 'Variiert stark' },
    ])
    expect(updated.slots.entscheidungslogik?.value).toContain('variiert')
  })

  it('bumps an exploring step to walkthrough once a card answer is applied', () => {
    const [updated] = applyClarificationSlotAnswers([makeStep({ status: 'exploring' })], [
      { process_step_id: 'S001', slot_key: 'frequency', answer: '4' },
    ])
    expect(updated.status).toBe('walkthrough')
  })

  it('looks up the step by stable id first, falling back to fuzzy title match', () => {
    const byId = applyClarificationSlotAnswers([makeStep()], [
      { process_step_id: 'S001', slot_key: 'frequency', answer: '4' },
    ])
    expect(byId[0].potenzial.frequency?.value).toBe(4)

    const byTitle = applyClarificationSlotAnswers([makeStep()], [
      { process_step_id: 'Rechnungsprüfung', slot_key: 'frequency', answer: '4' },
    ])
    expect(byTitle[0].potenzial.frequency?.value).toBe(4)
  })

  it('ignores answers for unknown steps or unrelated slot types (open_item/qualitative)', () => {
    const tracker = [makeStep()]
    const updated = applyClarificationSlotAnswers(tracker, [
      { process_step_id: 'does-not-exist', slot_key: 'frequency', answer: '4' },
      { process_step_id: 'S001', slot_key: 'open_item', answer: 'Ja' },
    ])
    expect(updated).toEqual(tracker)
  })

  it('is immutable — returns a new tracker, does not mutate the input', () => {
    const tracker = [makeStep()]
    const updated = applyClarificationSlotAnswers(tracker, [
      { process_step_id: 'S001', slot_key: 'frequency', answer: '4' },
    ])
    expect(tracker[0].potenzial.frequency).toBeNull()
    expect(updated[0].potenzial.frequency?.value).toBe(4)
  })
})
