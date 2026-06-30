import { describe, it, expect } from 'vitest'
import { scoreConversationalEfficiency } from './conversationalEfficiency'
import type { StepEntry, SlotValue, TaziteSlot } from '@/services/interviewSemantic'
import type { TurnRecord } from './types'

const sv = (value: string | number): SlotValue => ({ value, quote: String(value), confidence: 'confirmed' })
const tazite = (value: string): TaziteSlot => ({ value, quote: value, confidence: 'confirmed', nicht_befund_typ: null })

const makeStep = (potenzial: Partial<StepEntry['potenzial']> = {}, slots: Partial<StepEntry['slots']> = {}): StepEntry => ({
  title: 'Rechnungsprüfung',
  reihenfolge: 1,
  governance: null,
  abhaengigkeiten: null,
  potenzial: { frequency_per_month: null, duration_minutes: null, error_rate_percent: null, media_breaks: null, ...potenzial },
  status: 'done',
  slots: { entscheidungslogik: null, tazite_cues: null, ausnahmen: null, inputs: null, outputs: null, hilfsmittel: null, ...slots },
})

const turn = (n: number): TurnRecord => ({ turnNumber: n, userInput: 'x', agentText: 'y', phase: 'walkthrough_step', toolCalls: [] })

describe('scoreConversationalEfficiency', () => {
  it('counts filled potenzial + tazite slots and divides by turns', () => {
    const step = makeStep({ frequency_per_month: sv(90), duration_minutes: sv(15) }, { entscheidungslogik: tazite('regelbasiert') })
    const turns = [turn(1), turn(2), turn(3), turn(4)]
    const r = scoreConversationalEfficiency(turns, [step])
    expect(r.turnsToCompletion).toBe(4)
    expect(r.filledSlots).toBe(3)
    expect(r.slotsPerTurn).toBe(0.75)
  })

  it('zero turns → slotsPerTurn 0 (no division by zero)', () => {
    const r = scoreConversationalEfficiency([], [makeStep({ frequency_per_month: sv(90) })])
    expect(r.turnsToCompletion).toBe(0)
    expect(r.slotsPerTurn).toBe(0)
  })

  it('more turns for the same yield → lower efficiency', () => {
    const step = makeStep({ frequency_per_month: sv(90), duration_minutes: sv(15) })
    const fast = scoreConversationalEfficiency([turn(1), turn(2)], [step])
    const slow = scoreConversationalEfficiency([turn(1), turn(2), turn(3), turn(4)], [step])
    expect(fast.slotsPerTurn).toBeGreaterThan(slow.slotsPerTurn)
  })
})
