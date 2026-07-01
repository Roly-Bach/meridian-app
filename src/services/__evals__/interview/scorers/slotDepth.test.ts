import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai', () => ({ generateObject: vi.fn() }))
vi.mock('@/lib/llm-provider', () => ({ resolveModel: vi.fn().mockReturnValue({}) }))
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: vi.fn() }),
}))

import { generateObject } from 'ai'
import { scoreSlotDepth } from './slotDepth'
import { scoreSlotCoverage } from './slotCoverage'
import type { StepEntry } from '@/services/interviewSemantic'
import type { TurnRecord } from './types'
import shallowFixture from '../__fixtures__/depth-falsification/shallow.json'
import adequateFixture from '../__fixtures__/depth-falsification/adequate.json'
import deepFixture from '../__fixtures__/depth-falsification/deep.json'

const mockGenerateObject = vi.mocked(generateObject)

// generateObject liefert { object, usage } (structured output, PROJ-40 D) — kein Text-Parsing mehr.
type Bewertung = { slot: string; begruendung: string; stufe: number }
const asDepthObj = (bewertungen: Bewertung[]) =>
  ({ object: { bewertungen }, usage: { inputTokens: 0, outputTokens: 0 } } as unknown as Awaited<ReturnType<typeof generateObject>>)
function makeJudgeObj(slots: string[], stufe: number) {
  return asDepthObj(slots.map(s => ({ slot: s, begruendung: `Test-Begründung für ${s}`, stufe })))
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

    mockGenerateObject.mockResolvedValue(makeJudgeObj(shallowSlots[0], 1))
    const shallowResult = await scoreSlotDepth(shallowFixture.finalStepTracker as StepEntry[], [], EVAL_MODEL)

    mockGenerateObject.mockResolvedValue(makeJudgeObj(adequateSlots[0], 2))
    const adequateResult = await scoreSlotDepth(adequateFixture.finalStepTracker as StepEntry[], [], EVAL_MODEL)

    mockGenerateObject.mockResolvedValue(makeJudgeObj(deepSlots[0], 3))
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
    mockGenerateObject.mockResolvedValue(makeJudgeObj(slotNames[0], 1))

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
    mockGenerateObject.mockResolvedValue(makeJudgeObj(slotNames[0], 3))

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

  it('Judge-Call schlägt fehl (Schema-Verletzung/Timeout): Schritt wird übersprungen → null', async () => {
    mockGenerateObject.mockRejectedValue(new Error('schema validation failed'))
    const result = await scoreSlotDepth(shallowFixture.finalStepTracker as StepEntry[], [], EVAL_MODEL)
    expect(result.depth_score).toBeNull()
  })

  it('depth_distribution summiert zu ≈ 1.0', async () => {
    const slotNames = getSlotNames(deepFixture.finalStepTracker as StepEntry[])
    // Simulate mixed stufen: step1 = stufe 2, step2 = stufe 3
    let callCount = 0
    mockGenerateObject.mockImplementation(async () => {
      callCount++
      const stufe = callCount === 1 ? 2 : 3
      return makeJudgeObj(slotNames[0], stufe)
    })

    const result = await scoreSlotDepth(deepFixture.finalStepTracker as StepEntry[], [], EVAL_MODEL)
    if (result.depth_distribution) {
      const { p1, p2, p3 } = result.depth_distribution
      expect(p1 + p2 + p3).toBeCloseTo(1.0, 1)
    }
  })
})

// ─── Structured-Output-Contract (ersetzt das frühere tolerante Text-Parsing) ─────
//
// Mit generateObject erzwingt das SDK das Schema: entweder ein valides Objekt oder ein
// throw. Die alten Prosa-/Fence-Toleranztests sind damit gegenstandslos — geprüft wird
// jetzt der neue Vertrag.

describe('scoreSlotDepth — Structured-Output-Contract', () => {
  beforeEach(() => {
    mockGenerateObject.mockReset()
  })

  it('valides bewertungen-Objekt → nicht null', async () => {
    const slotNames = getSlotNames(shallowFixture.finalStepTracker as StepEntry[])
    mockGenerateObject.mockResolvedValue(makeJudgeObj(slotNames[0], 2))
    const result = await scoreSlotDepth(shallowFixture.finalStepTracker as StepEntry[], [], EVAL_MODEL)
    expect(result.depth_score).not.toBeNull()
  })

  it('leeres bewertungen-Array → null (kein bewertbarer Slot)', async () => {
    mockGenerateObject.mockResolvedValue(asDepthObj([]))
    const result = await scoreSlotDepth(shallowFixture.finalStepTracker as StepEntry[], [], EVAL_MODEL)
    expect(result.depth_score).toBeNull()
  })

  it('generateObject wirft (Schema nicht erfüllbar) → null', async () => {
    mockGenerateObject.mockRejectedValue(new Error('no object generated'))
    const result = await scoreSlotDepth(shallowFixture.finalStepTracker as StepEntry[], [], EVAL_MODEL)
    expect(result.depth_score).toBeNull()
  })
})

// ─── Order-Swap-Test (BL-E5.2) ────────────────────────────────────────────────
//
// Verifiziert, dass die Aggregation invariant gegenüber Slot-Reihenfolge im Batch-Input
// ist. Da LLM gemockt: gleiche Slots in anderer Reihenfolge liefern denselben Score.

describe('scoreSlotDepth — Order-Swap-Invarianz (BL-E5.2)', () => {
  it('Slots in umgekehrter Reihenfolge im StepEntry → gleicher Score (mit gemocktem LLM)', async () => {
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

    // Reverse-order step: same data, different property insertion order.
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

    const stufe2 = asDepthObj([
      { slot: 'entscheidungslogik', begruendung: 'Erklärender Kontext vorhanden', stufe: 2 },
      { slot: 'inputs', begruendung: 'Oberflächlich benannt', stufe: 2 },
      { slot: 'hilfsmittel', begruendung: 'Nur Tool-Name', stufe: 2 },
    ])
    mockGenerateObject.mockResolvedValue(stufe2)
    const result1 = await scoreSlotDepth([baseStep], [], EVAL_MODEL)

    mockGenerateObject.mockResolvedValue(stufe2)
    const result2 = await scoreSlotDepth([reverseOrderStep], [], EVAL_MODEL)

    expect(result1.depth_score).not.toBeNull()
    expect(result2.depth_score).not.toBeNull()
    // Invarianz: gleicher Mock-Output → gleicher Score
    expect(result1.depth_score).toBe(result2.depth_score)
  })
})

// ─── Prompt-Content-Test: getStepTurns-Grenzen (2026-06-24 audit) ───────────────
//
// getStepTurns() filtert Turns anhand von toolCalls[].args.step_title. Prüft, dass der
// pro-Schritt-Prompt nur die zugehörigen Turns enthält, am tatsächlich gesendeten Prompt.

describe('scoreSlotDepth — Prompt-Inhalt: getStepTurns-Grenzen', () => {
  it('Gesprächsauszüge im Prompt enthalten nur Turns des jeweiligen Schritts, nicht andere Schritte', async () => {
    const stepA: StepEntry = {
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
        inputs: null,
        outputs: null,
        hilfsmittel: null,
      },
    }
    const stepB: StepEntry = {
      ...stepA,
      title: 'Monatsabschluss',
      slots: {
        ...stepA.slots,
        entscheidungslogik: { value: 'Stichtag 5. Werktag', quote: 'Stichtag 5. Werktag', confidence: 'confirmed', nicht_befund_typ: null },
      },
    }

    const turns: TurnRecord[] = [
      {
        turnNumber: 1,
        userInput: 'USERINPUT_SCHRITT_A',
        agentText: 'AGENTTEXT_SCHRITT_A',
        phase: 'walkthrough_step',
        toolCalls: [{ toolName: 'record_slot', args: { step_title: 'Rechnungsprüfung', slot: 'entscheidungslogik' } }],
      },
      {
        turnNumber: 2,
        userInput: 'USERINPUT_SCHRITT_B',
        agentText: 'AGENTTEXT_SCHRITT_B',
        phase: 'walkthrough_step',
        toolCalls: [{ toolName: 'record_slot', args: { step_title: 'Monatsabschluss', slot: 'entscheidungslogik' } }],
      },
    ]

    mockGenerateObject.mockReset()
    mockGenerateObject.mockResolvedValue(asDepthObj([{ slot: 'entscheidungslogik', begruendung: 'ok', stufe: 2 }]))

    await scoreSlotDepth([stepA, stepB], turns, EVAL_MODEL)

    // Erster Call (Step A): nur dessen eigener Turn-Inhalt, NICHT der von Step B.
    const promptA = (mockGenerateObject.mock.calls[0][0] as { prompt: string }).prompt
    expect(promptA).toContain('USERINPUT_SCHRITT_A')
    expect(promptA).not.toContain('USERINPUT_SCHRITT_B')

    // Zweiter Call (Step B): nur dessen eigener Turn-Inhalt, NICHT der von Step A.
    const promptB = (mockGenerateObject.mock.calls[1][0] as { prompt: string }).prompt
    expect(promptB).toContain('USERINPUT_SCHRITT_B')
    expect(promptB).not.toContain('USERINPUT_SCHRITT_A')
  })
})
