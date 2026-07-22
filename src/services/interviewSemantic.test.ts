import { describe, it, expect } from 'vitest'

import { hasNewOField, type StepEntry } from './interviewSemantic'

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
  reibungspunkte: null,
  ausloeser: null,
  aufgabentyp: null,
  risiko_schwere: null,
  standardisierungsgrad: null,
  informationsdichte: null,
}

function makeStep(id: string, slots: StepEntry['slots'] = emptySlots, extra: Partial<StepEntry> = {}): StepEntry {
  return {
    id,
    title: 'Rechnungsprüfung',
    reihenfolge: 1,
    abhaengigkeiten: null,
    status: 'walkthrough',
    potenzial: emptyPotenzial,
    slots,
    ...extra,
  }
}

// PROJ-46 QA H-1 Fix D: hasNewOField is the shared "real new process depth"
// primitive that replaced the too-broad hasAppliedExtraction ("any applied
// knowledge-tool write") behind both the No-New-Extraction streak
// (interviewAnalyst.ts's computeNextBriefing) and the M7-b closing-reentry veto
// (runInterviewTurn.ts's hadExtractionThisTurn).

describe('hasNewOField (PROJ-46 QA H-1 Fix D)', () => {
  it('is true when a step gains a new O2–O6 field', () => {
    const before = [makeStep('S001')]
    const after = [makeStep('S001', { ...emptySlots, ausnahmen: { value: ['Storno'], quote: 'Storno', nicht_befund_typ: null } })]
    expect(hasNewOField(before, after)).toBe(true)
  })

  it('is false when nothing changed', () => {
    const tracker = [makeStep('S001')]
    expect(hasNewOField(tracker, tracker)).toBe(false)
  })

  // The exact leak Fix D closes: a re-record/potenzial-only/floskel write applies
  // successfully (hasAppliedExtraction would have returned true) but touches no
  // O2–O6 field at all — must NOT count as "new content".
  it('is false when only a potenzial slot (frequency/duration/error_rate/media_breaks) was filled', () => {
    const before = [makeStep('S001')]
    const after = [makeStep('S001', emptySlots, {
      potenzial: { ...emptyPotenzial, frequency_per_month: { value: 8, quote: 'zweimal pro Woche', confidence: 'estimate', nicht_befund_typ: null } },
    })]
    expect(hasNewOField(before, after)).toBe(false)
  })

  it('is false when an already-filled O-field is merely re-recorded with the same content', () => {
    const filled: StepEntry['slots'] = { ...emptySlots, ausnahmen: { value: ['Storno'], quote: 'Storno', nicht_befund_typ: null } }
    const before = [makeStep('S001', filled)]
    const after = [makeStep('S001', filled)]
    expect(hasNewOField(before, after)).toBe(false)
  })

  it('is true when a DIFFERENT step (not just the focus-locked one) gains an O-field — global, not per-lock', () => {
    const before = [makeStep('S001'), makeStep('S002')]
    const after = [makeStep('S001'), makeStep('S002', { ...emptySlots, inputs: { value: ['Rechnung'], quote: 'Rechnung', nicht_befund_typ: null } })]
    expect(hasNewOField(before, after)).toBe(true)
  })

  it('is false when a brand-new step is registered but none of its O-fields are filled yet', () => {
    const before = [makeStep('S001')]
    const after = [makeStep('S001'), makeStep('S002')]
    expect(hasNewOField(before, after)).toBe(false)
  })
})
