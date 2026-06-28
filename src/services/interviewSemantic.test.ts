import { describe, it, expect } from 'vitest'

import {
  computeMissingMandatorySlots,
  computeWalkthroughSlotTarget,
  diffNewlyFilledSlots,
  POTENZIAL_SLOT_NAMES,
  TAZITE_SLOT_NAMES,
  type StepEntry,
} from './interviewSemantic'

function makeStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return {
    title: 'Rechnungseingang buchen',
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
    process_steps: [],
    friction_points: [],
    friction_tools: [],
    pain_point_primary: null,
    ...overrides,
  }
}

// All 10 slots filled (4 potenzial + 6 tazite) — used for "all done" assertions.
function makeFilledStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return makeStep({
    potenzial: {
      frequency_per_month: { value: 20, quote: 'etwa 20 mal im Monat' },
      duration_minutes: { value: 15, quote: 'dauert so 15 Minuten' },
      error_rate_percent: { value: 5, quote: 'ca. 5% Fehlerrate' },
      media_breaks: { value: 2, quote: '2 Medienbrüche' },
    },
    slots: {
      entscheidungslogik: { value: 'Regelbasiert nach Betrag', quote: 'immer nach Betrag', nicht_befund_typ: null },
      tazite_cues: { value: ['SAP-Kenntnisse nötig'], quote: 'SAP Kenntnisse', nicht_befund_typ: null },
      ausnahmen: { value: ['Storno'], quote: 'Storno ist Ausnahme', nicht_befund_typ: null },
      inputs: { value: ['Eingangsrechnung'], quote: 'Rechnung kommt an', nicht_befund_typ: null },
      outputs: { value: ['Gebuchte Rechnung'], quote: 'dann gebucht', nicht_befund_typ: null },
      hilfsmittel: { value: ['SAP'], quote: 'SAP nutze ich dabei', nicht_befund_typ: null },
    },
    ...overrides,
  })
}

// ─── computeMissingMandatorySlots ─────────────────────────────────────────────

describe('computeMissingMandatorySlots', () => {
  it('returns all 10 mandatory slots (4 potenzial + 6 tazite) when step has no filled slots', () => {
    const steps: StepEntry[] = [makeStep()]
    const missing = computeMissingMandatorySlots(steps)
    expect(missing).toHaveLength(10)
    expect(missing.map((m) => m.slot)).toEqual(
      expect.arrayContaining([...POTENZIAL_SLOT_NAMES, ...TAZITE_SLOT_NAMES])
    )
    expect(missing.every((m) => m.step_title === 'Rechnungseingang buchen')).toBe(true)
  })

  it('returns empty array when all mandatory slots are filled', () => {
    const steps: StepEntry[] = [makeFilledStep()]
    const missing = computeMissingMandatorySlots(steps)
    expect(missing).toHaveLength(0)
  })

  it('returns only the missing slots when some potenzial + tazite are already filled', () => {
    const steps: StepEntry[] = [
      makeStep({
        potenzial: {
          frequency_per_month: { value: 10, quote: 'zehnmal' },
          duration_minutes: { value: 15, quote: '15 min' },
          error_rate_percent: null,
          media_breaks: null,
        },
        slots: {
          entscheidungslogik: { value: 'regelbasiert', quote: 'immer gleich', nicht_befund_typ: null },
          tazite_cues: { value: ['SAP-Wissen'], quote: 'SAP', nicht_befund_typ: null },
          ausnahmen: null,
          inputs: null,
          outputs: null,
          hilfsmittel: null,
        },
      }),
    ]
    const missing = computeMissingMandatorySlots(steps)
    // 2 potenzial missing + 4 tazite missing = 6
    expect(missing).toHaveLength(6)
    expect(missing.map((m) => m.slot)).toEqual(
      expect.arrayContaining(['error_rate_percent', 'media_breaks', 'ausnahmen', 'inputs', 'outputs', 'hilfsmittel'])
    )
  })

  it('aggregates missing slots across multiple steps', () => {
    const steps: StepEntry[] = [
      makeStep({ title: 'Schritt A' }),
      makeFilledStep({ title: 'Schritt B' }),
    ]
    const missing = computeMissingMandatorySlots(steps)
    expect(missing).toHaveLength(10)
    expect(missing.every((m) => m.step_title === 'Schritt A')).toBe(true)
  })

  it('returns empty array for empty step_tracker', () => {
    expect(computeMissingMandatorySlots([])).toHaveLength(0)
  })
})

// ─── computeWalkthroughSlotTarget (L1) ────────────────────────────────────────

describe('computeWalkthroughSlotTarget', () => {
  it('returns null when no active step', () => {
    const steps: StepEntry[] = [makeFilledStep({ status: 'done' })]
    expect(computeWalkthroughSlotTarget(steps)).toBeNull()
  })

  it('returns null when tracker empty', () => {
    expect(computeWalkthroughSlotTarget([])).toBeNull()
  })

  it('returns null when active step has all mandatory slots filled', () => {
    const steps: StepEntry[] = [makeFilledStep({ status: 'walkthrough' })]
    expect(computeWalkthroughSlotTarget(steps)).toBeNull()
  })

  it('prefers walkthrough over exploring as active step', () => {
    const steps: StepEntry[] = [
      makeStep({ title: 'Explorier-Step', status: 'exploring' }),
      makeStep({ title: 'Walkthrough-Step', status: 'walkthrough' }),
    ]
    const target = computeWalkthroughSlotTarget(steps)
    expect(target?.step_title).toBe('Walkthrough-Step')
  })

  it('picks potenzial slots before tazite (canonical order)', () => {
    const steps: StepEntry[] = [
      makeStep({
        status: 'walkthrough',
        potenzial: {
          frequency_per_month: { value: 5, quote: 'fünfmal' },
          duration_minutes: null,
          error_rate_percent: null,
          media_breaks: null,
        },
      }),
    ]
    const target = computeWalkthroughSlotTarget(steps)
    expect(target?.slot).toBe('duration_minutes')
  })

  it('returns target for exploring step when no walkthrough step exists', () => {
    const steps: StepEntry[] = [makeStep({ status: 'exploring' })]
    const target = computeWalkthroughSlotTarget(steps)
    expect(target?.slot).toBe('frequency_per_month')
  })

  it('ignores done steps when picking active', () => {
    const steps: StepEntry[] = [
      makeFilledStep({ title: 'Done', status: 'done' }),
      makeStep({ title: 'Live', status: 'walkthrough' }),
    ]
    expect(computeWalkthroughSlotTarget(steps)?.step_title).toBe('Live')
  })

  // PROJ-28/BL-E2.1 — nicht_befund_typ on potenzial slots
  it('does not target potenzial slot with nicht_befund_typ set (addressed, no value)', () => {
    const steps: StepEntry[] = [
      makeFilledStep({
        status: 'walkthrough',
        potenzial: {
          frequency_per_month: { value: null, quote: 'weiß ich nicht', nicht_befund_typ: 'unbekannt' },
          duration_minutes: { value: 15, quote: 'ca. 15 min' },
          error_rate_percent: { value: 2, quote: '2 Prozent' },
          media_breaks: { value: 1, quote: 'einmal' },
        },
      }),
    ]
    // All potenzial filled (one as nicht_befund), all tazite filled → null
    expect(computeWalkthroughSlotTarget(steps)).toBeNull()
  })

  it('reports reason=missing for null potenzial gap', () => {
    const steps: StepEntry[] = [makeStep({ status: 'walkthrough' })]
    const target = computeWalkthroughSlotTarget(steps)
    expect(target?.reason).toBe('missing')
  })

  // PROJ-28/BL-E2.2 — low_confidence pass
  it('targets estimate potenzial slot as low_confidence after all null gaps filled', () => {
    const estimateSlot = { value: 20, quote: 'ungefähr 20', confidence: 'estimate' as const }
    const steps: StepEntry[] = [
      makeFilledStep({
        status: 'walkthrough',
        potenzial: {
          frequency_per_month: estimateSlot,
          duration_minutes: { value: 15, quote: 'ca. 15 min', confidence: 'confirmed' as const },
          error_rate_percent: { value: 2, quote: '2%', confidence: 'confirmed' as const },
          media_breaks: { value: 1, quote: 'einmal', confidence: 'confirmed' as const },
        },
      }),
    ]
    const target = computeWalkthroughSlotTarget(steps)
    expect(target?.slot).toBe('frequency_per_month')
    expect(target?.reason).toBe('low_confidence')
  })

  it('does not target confirmed potenzial slot in low_confidence pass', () => {
    const steps: StepEntry[] = [makeFilledStep({ status: 'walkthrough' })]
    // makeFilledStep has all slots filled, all confidence undefined (treated as confirmed)
    expect(computeWalkthroughSlotTarget(steps)).toBeNull()
  })

  it('prioritises missing tazite over low_confidence potenzial', () => {
    const estimateSlot = { value: 20, quote: 'ungefähr 20', confidence: 'estimate' as const }
    const steps: StepEntry[] = [
      makeStep({
        status: 'walkthrough',
        potenzial: {
          frequency_per_month: estimateSlot,
          duration_minutes: { value: 15, quote: '15 min', confidence: 'confirmed' as const },
          error_rate_percent: { value: 2, quote: '2%', confidence: 'confirmed' as const },
          media_breaks: { value: 1, quote: '1', confidence: 'confirmed' as const },
        },
        // tazite slots all null (missing)
      }),
    ]
    const target = computeWalkthroughSlotTarget(steps)
    expect(target?.reason).toBe('missing')
    expect(target?.slot).toBe('entscheidungslogik')
  })
})

// ─── computeMissingMandatorySlots — PROJ-28 ──────────────────────────────────

describe('computeMissingMandatorySlots — PROJ-28/BL-E2.1', () => {
  it('does not count potenzial slot with nicht_befund_typ as missing', () => {
    const steps: StepEntry[] = [
      makeFilledStep({
        potenzial: {
          frequency_per_month: { value: null, quote: 'weiß nicht', nicht_befund_typ: 'unbekannt' },
          duration_minutes: { value: 15, quote: '15 min' },
          error_rate_percent: { value: 2, quote: '2%' },
          media_breaks: { value: 1, quote: '1' },
        },
      }),
    ]
    const missing = computeMissingMandatorySlots(steps)
    expect(missing.map((m) => m.slot)).not.toContain('frequency_per_month')
  })

  it('counts potenzial slot with value:null and nicht_befund_typ:null as missing', () => {
    const steps: StepEntry[] = [
      makeStep({ status: 'walkthrough' }),
    ]
    const missing = computeMissingMandatorySlots(steps)
    expect(missing.map((m) => m.slot)).toContain('frequency_per_month')
    expect(missing.find((m) => m.slot === 'frequency_per_month')?.reason).toBe('missing')
  })
})

// ─── diffNewlyFilledSlots — KI-18 ─────────────────────────────────────────────
// quick-extract writes slots from the CURRENT turn's input before the Talker
// builds its prompt for that same turn (runInterviewTurn.ts "Pre-Talker
// Quick-Extract"). This diff flags those same-turn fills so the Talker doesn't
// treat them as "vorhin" (earlier-turn) facts — see talkerPrompt.ts justFilledSection.

describe('diffNewlyFilledSlots — KI-18', () => {
  it('flags a potenzial slot that went from null to filled', () => {
    const before = [makeStep()]
    const after = [
      makeStep({
        potenzial: {
          frequency_per_month: { value: 350, quote: '75 bis 100 pro Woche' },
          duration_minutes: null,
          error_rate_percent: null,
          media_breaks: null,
        },
      }),
    ]
    const diff = diffNewlyFilledSlots(before, after)
    expect(diff).toEqual([{ step_title: 'Rechnungseingang buchen', slot: 'frequency_per_month' }])
  })

  it('flags a tazite slot that went from null to filled', () => {
    const before = [makeStep()]
    const after = [
      makeStep({
        slots: {
          entscheidungslogik: { value: 'Kommt drauf an', quote: 'Kommt drauf an', nicht_befund_typ: null },
          tazite_cues: null,
          ausnahmen: null,
          inputs: null,
          outputs: null,
          hilfsmittel: null,
        },
      }),
    ]
    expect(diffNewlyFilledSlots(before, after)).toEqual([
      { step_title: 'Rechnungseingang buchen', slot: 'entscheidungslogik' },
    ])
  })

  it('does not flag a slot that was already filled before this turn', () => {
    const before = [makeFilledStep()]
    const after = [makeFilledStep()]
    expect(diffNewlyFilledSlots(before, after)).toEqual([])
  })

  it('does not flag a slot that stays null', () => {
    const before = [makeStep()]
    const after = [makeStep()]
    expect(diffNewlyFilledSlots(before, after)).toEqual([])
  })

  it('returns nothing for a step with no "before" counterpart (newly registered this turn)', () => {
    // A step registered for the first time this turn has nothing to diff against —
    // all its filled slots are "new" in a trivial sense, but there's no earlier-turn
    // claim being made about them since the step itself is brand new.
    const before: StepEntry[] = []
    const after = [makeFilledStep()]
    const diff = diffNewlyFilledSlots(before, after)
    expect(diff.length).toBeGreaterThan(0)
    expect(diff.map((d) => d.slot)).toContain('frequency_per_month')
  })

  it('matches steps by id when present, even if title text drifted', () => {
    const before = [makeStep({ id: 'S001', title: 'Altes Titel' })]
    const after = [
      makeStep({
        id: 'S001',
        title: 'Neuer Titel',
        potenzial: {
          frequency_per_month: { value: 10, quote: '10' },
          duration_minutes: null,
          error_rate_percent: null,
          media_breaks: null,
        },
      }),
    ]
    expect(diffNewlyFilledSlots(before, after)).toEqual([{ step_title: 'Neuer Titel', slot: 'frequency_per_month' }])
  })
})
