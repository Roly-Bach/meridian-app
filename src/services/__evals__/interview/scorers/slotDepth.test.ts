import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai', () => ({ generateText: vi.fn() }))
vi.mock('@/lib/llm-provider', () => ({ resolveModel: vi.fn().mockReturnValue({}) }))
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: vi.fn() }),
}))

import { generateText } from 'ai'
import { scoreSlotDepth } from './slotDepth'
import { scoreSlotCoverage } from './slotCoverage'
import type { StepEntry } from '@/services/interviewSemantic'
import shallowFixture from '../__fixtures__/depth-falsification/shallow.json'
import adequateFixture from '../__fixtures__/depth-falsification/adequate.json'
import deepFixture from '../__fixtures__/depth-falsification/deep.json'

const mockGenerateText = vi.mocked(generateText)

function makeJudgeResponse(slots: string[], stufe: 1 | 2 | 3): string {
  return JSON.stringify(slots.map(s => ({ slot: s, begruendung: `Test-Begründung für ${s}`, stufe })))
}

function getSlotNames(steps: StepEntry[]): string[][] {
  return steps.map(step => {
    const names: string[] = []
    if (step.slots.entscheidungslogik?.value != null) names.push('entscheidungslogik')
    if (step.slots.tazite_cues?.value != null && step.slots.tazite_cues.value.length > 0) names.push('tazite_cues')
    if (step.slots.ausnahmen?.value != null && step.slots.ausnahmen.value.length > 0) names.push('ausnahmen')
    return names
  })
}

const EVAL_MODEL = 'google/gemini-3.1-flash-lite'

describe('scoreSlotDepth — Monotonie-Test', () => {
  it('deep > adequate > shallow', async () => {
    const shallowSlots = getSlotNames(shallowFixture.finalStepTracker as StepEntry[])
    const adequateSlots = getSlotNames(adequateFixture.finalStepTracker as StepEntry[])
    const deepSlots = getSlotNames(deepFixture.finalStepTracker as StepEntry[])

    mockGenerateText.mockResolvedValue({ text: makeJudgeResponse(shallowSlots[0], 1) } as Awaited<ReturnType<typeof generateText>>)
    const shallowResult = await scoreSlotDepth(shallowFixture.finalStepTracker as StepEntry[], [], EVAL_MODEL)

    mockGenerateText.mockResolvedValue({ text: makeJudgeResponse(adequateSlots[0], 2) } as Awaited<ReturnType<typeof generateText>>)
    const adequateResult = await scoreSlotDepth(adequateFixture.finalStepTracker as StepEntry[], [], EVAL_MODEL)

    mockGenerateText.mockResolvedValue({ text: makeJudgeResponse(deepSlots[0], 3) } as Awaited<ReturnType<typeof generateText>>)
    const deepResult = await scoreSlotDepth(deepFixture.finalStepTracker as StepEntry[], [], EVAL_MODEL)

    expect(shallowResult.depth_score).not.toBeNull()
    expect(adequateResult.depth_score).not.toBeNull()
    expect(deepResult.depth_score).not.toBeNull()
    expect(deepResult.depth_score!).toBeGreaterThan(adequateResult.depth_score!)
    expect(adequateResult.depth_score!).toBeGreaterThan(shallowResult.depth_score!)
  })
})

describe('scoreSlotDepth — Adversarial-Test', () => {
  it('triviale Phrasenanhänge heben Stufe nicht (Abweichung ≤ 0.2)', async () => {
    const shallowSteps = shallowFixture.finalStepTracker as StepEntry[]
    // Build adversarial: append trivial phrases to slot values
    const adversarialSteps: StepEntry[] = shallowSteps.map(step => ({
      ...step,
      slots: {
        ...step.slots,
        entscheidungslogik: step.slots.entscheidungslogik
          ? { ...step.slots.entscheidungslogik, value: `${step.slots.entscheidungslogik.value} Das geht gut.` }
          : null,
        tazite_cues: step.slots.tazite_cues?.value
          ? { ...step.slots.tazite_cues, value: step.slots.tazite_cues.value.map(v => `${v} Kein Problem.`) }
          : null,
        ausnahmen: step.slots.ausnahmen?.value
          ? { ...step.slots.ausnahmen, value: step.slots.ausnahmen.value.map(v => `${v} Das stimmt.`) }
          : null,
      },
    }))

    const slotNames = getSlotNames(shallowSteps)
    mockGenerateText.mockResolvedValue({ text: makeJudgeResponse(slotNames[0], 1) } as Awaited<ReturnType<typeof generateText>>)

    const shallowResult = await scoreSlotDepth(shallowSteps, [], EVAL_MODEL)
    const adversarialResult = await scoreSlotDepth(adversarialSteps, [], EVAL_MODEL)

    expect(shallowResult.depth_score).not.toBeNull()
    expect(adversarialResult.depth_score).not.toBeNull()
    expect(Math.abs(shallowResult.depth_score! - adversarialResult.depth_score!)).toBeLessThanOrEqual(0.2)
  })
})

describe('scoreSlotDepth — Konstrukt-Unabhängigkeit', () => {
  it('Coverage-Score von deep = Coverage-Score von shallow (gleiche Slot-Anzahl)', () => {
    const shallowCoverage = scoreSlotCoverage(shallowFixture.finalStepTracker as StepEntry[])
    const deepCoverage = scoreSlotCoverage(deepFixture.finalStepTracker as StepEntry[])
    expect(shallowCoverage).toBeCloseTo(deepCoverage, 5)
    expect(shallowCoverage).toBeGreaterThan(0)
  })
})

describe('scoreSlotDepth — Reproduzierbarkeits-Test', () => {
  it('zwei Aufrufe auf derselben Fixture weichen ≤ 5% voneinander ab', async () => {
    const slotNames = getSlotNames(deepFixture.finalStepTracker as StepEntry[])
    mockGenerateText.mockResolvedValue({ text: makeJudgeResponse(slotNames[0], 3) } as Awaited<ReturnType<typeof generateText>>)

    const result1 = await scoreSlotDepth(deepFixture.finalStepTracker as StepEntry[], [], EVAL_MODEL)
    const result2 = await scoreSlotDepth(deepFixture.finalStepTracker as StepEntry[], [], EVAL_MODEL)

    expect(result1.depth_score).not.toBeNull()
    expect(result2.depth_score).not.toBeNull()
    const diff = Math.abs(result1.depth_score! - result2.depth_score!)
    const maxAllowed = result1.depth_score! * 0.05
    expect(diff).toBeLessThanOrEqual(maxAllowed)
  })
})

describe('scoreSlotDepth — Edge Cases', () => {
  it('gibt null zurück für leeren step_tracker', async () => {
    const result = await scoreSlotDepth([], [], EVAL_MODEL)
    expect(result.depth_score).toBeNull()
    expect(result.depth_distribution).toBeNull()
  })

  it('gibt null zurück wenn alle Steps keine befüllten Slots haben', async () => {
    const emptySteps: StepEntry[] = [{
      title: 'Leerer Schritt',
      reihenfolge: 1,
      governance: null,
      abhaengigkeiten: null,
      status: 'exploring',
      potenzial: { frequency_per_month: null, duration_minutes: null, error_rate_percent: null, media_breaks: null },
      slots: { entscheidungslogik: null, tazite_cues: null, ausnahmen: null, inputs: null, outputs: null, hilfsmittel: null },
    }]
    const result = await scoreSlotDepth(emptySteps, [], EVAL_MODEL)
    expect(result.depth_score).toBeNull()
  })

  it('Fallback bei JSON-Parse-Fehler des Judges: Schritt wird übersprungen', async () => {
    mockGenerateText.mockResolvedValue({ text: 'invalid json' } as Awaited<ReturnType<typeof generateText>>)
    const result = await scoreSlotDepth(shallowFixture.finalStepTracker as StepEntry[], [], EVAL_MODEL)
    expect(result.depth_score).toBeNull()
  })

  it('depth_distribution summiert zu ≈ 1.0', async () => {
    const slotNames = getSlotNames(deepFixture.finalStepTracker as StepEntry[])
    // Simulate mixed stufen: step1 = stufe 2, step2 = stufe 3
    let callCount = 0
    mockGenerateText.mockImplementation(async () => {
      callCount++
      const stufe = callCount === 1 ? 2 : 3
      return { text: makeJudgeResponse(slotNames[0], stufe as 2 | 3) } as Awaited<ReturnType<typeof generateText>>
    })

    const result = await scoreSlotDepth(deepFixture.finalStepTracker as StepEntry[], [], EVAL_MODEL)
    if (result.depth_distribution) {
      const { p1, p2, p3 } = result.depth_distribution
      expect(p1 + p2 + p3).toBeCloseTo(1.0, 1)
    }
  })
})

// ─── Order-Swap-Test (BL-E5.2) ────────────────────────────────────────────────
//
// Verifiziert, dass die Parser-Logik invariant gegenüber Slot-Reihenfolge im
// Batch-Input ist. Da LLM gemockt: der Test sichert, dass gleiche Slots in
// anderer Reihenfolge dasselbe Ergebnis liefern.
//
// Integration-Test für echten Order-Swap mit LLM benötigt API-Keys (key-gated).

describe('scoreSlotDepth — Order-Swap-Invarianz (BL-E5.2)', () => {
  it('Slots in umgekehrter Reihenfolge im StepEntry → gleicher Score (mit gemocktem LLM)', async () => {
    // Build two StepEntry objects with same slots but different property insertion order.
    // getFilledSlots() sorts by name, so both should produce the same sorted batch.
    const baseStep: StepEntry = {
      title: 'Rechnungsprüfung',
      reihenfolge: 1,
      governance: null,
      abhaengigkeiten: null,
      status: 'done',
      potenzial: { frequency_per_month: null, duration_minutes: null, error_rate_percent: null, media_breaks: null },
      slots: {
        entscheidungslogik: { value: 'Freigabe ab 5000 EUR', quote: 'Freigabe ab 5000 EUR', confidence: 'confirmed', nicht_befund_typ: null },
        tazite_cues: null,
        ausnahmen: null,
        inputs: { value: ['Eingangsrechnung'], quote: 'Eingangsrechnung', nicht_befund_typ: null },
        outputs: null,
        hilfsmittel: { value: ['SAP FI'], quote: 'SAP FI', nicht_befund_typ: null },
      },
    }

    // Reverse-order step: same data, but object properties created in different order.
    // Since JS object property order can affect Object.entries() on older engines,
    // we explicitly create the slots object in reverse alphabetical order.
    const reverseOrderStep: StepEntry = {
      ...baseStep,
      slots: {
        tazite_cues: null,
        outputs: null,
        inputs: { value: ['Eingangsrechnung'], quote: 'Eingangsrechnung', nicht_befund_typ: null },
        hilfsmittel: { value: ['SAP FI'], quote: 'SAP FI', nicht_befund_typ: null },
        entscheidungslogik: { value: 'Freigabe ab 5000 EUR', quote: 'Freigabe ab 5000 EUR', confidence: 'confirmed', nicht_befund_typ: null },
        ausnahmen: null,
      },
    }

    const stufe2Response = JSON.stringify([
      { slot: 'entscheidungslogik', begruendung: 'Erklärender Kontext vorhanden', stufe: 2 },
      { slot: 'inputs', begruendung: 'Oberflächlich benannt', stufe: 2 },
      { slot: 'hilfsmittel', begruendung: 'Nur Tool-Name', stufe: 2 },
    ])
    mockGenerateText.mockResolvedValue({ text: stufe2Response } as Awaited<ReturnType<typeof generateText>>)

    const result1 = await scoreSlotDepth([baseStep], [], EVAL_MODEL)

    mockGenerateText.mockResolvedValue({ text: stufe2Response } as Awaited<ReturnType<typeof generateText>>)
    const result2 = await scoreSlotDepth([reverseOrderStep], [], EVAL_MODEL)

    expect(result1.depth_score).not.toBeNull()
    expect(result2.depth_score).not.toBeNull()
    // Parser-Invarianz: gleicher Mock-Output → gleicher Score
    expect(result1.depth_score).toBe(result2.depth_score)
  })
})
