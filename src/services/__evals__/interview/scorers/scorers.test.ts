import { describe, it, expect, vi } from 'vitest'

// interviewAgent transitively imports supabase-admin (server-only). Mock it here.
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: vi.fn() }),
}))
import { scoreSlotCoverage } from './slotCoverage'
import { scorePhaseAdherence } from './phaseAdherence'
import { scoreAnchoringViolations } from './anchoringViolations'
import { scoreToolCallPlausibility } from './toolCallPlausibility'
import { scoreCompletionCorrectness } from './completionCorrectness'
import type { TurnRecord } from './types'
import type { StepEntry } from '@/services/interviewAgent'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const slotFilled = (value: string) => ({ value, quote: value, confidence: 'confirmed' as const })

const makeStep = (slotOverrides: Partial<StepEntry['slots']> = {}, stepOverrides: Partial<Omit<StepEntry, 'slots'>> = {}): StepEntry => ({
  title: 'Rechnungsprüfung',
  status: 'done',
  slots: {
    frequency_per_month: null,
    duration_minutes: null,
    rule_based: null,
    data_sources: null,
    error_rate_percent: null,
    media_breaks: null,
    ...slotOverrides,
  },
  ...stepOverrides,
})

const makeTurn = (
  overrides: Partial<TurnRecord> = {},
): TurnRecord => ({
  turnNumber: 1,
  userInput: 'Ich bearbeite etwa 80 bis 100 Rechnungen pro Monat.',
  agentText: 'Kannst du den Ablauf beschreiben?',
  phase: 'walkthrough_step',
  toolCalls: [],
  ...overrides,
})

// ─── slotCoverage ─────────────────────────────────────────────────────────────

describe('scoreSlotCoverage', () => {
  it('returns 0 for empty tracker', () => {
    expect(scoreSlotCoverage([])).toBe(0)
  })

  it('returns 0 when no mandatory slots filled', () => {
    expect(scoreSlotCoverage([makeStep()])).toBe(0)
  })

  it('returns 1.0 when all mandatory slots filled', () => {
    const step = makeStep({
      frequency_per_month: slotFilled('90'),
      duration_minutes: slotFilled('30'),
      rule_based: slotFilled('Freigabe ab 5000 EUR'),
      data_sources: slotFilled('SAP FI'),
    })
    expect(scoreSlotCoverage([step])).toBe(1.0)
  })

  it('returns 0.5 when half of mandatory slots filled across two steps', () => {
    const step1 = makeStep({
      frequency_per_month: slotFilled('90'),
      duration_minutes: slotFilled('30'),
    })
    const step2 = makeStep({}, { title: 'Monatsabschluss' })
    // 2 filled out of 8 total = 0.25 — wait: 2 steps × 4 mandatory = 8 total, 2 filled
    expect(scoreSlotCoverage([step1, step2])).toBe(0.25)
  })

  it('returns correct fraction for partial fill', () => {
    const step = makeStep({
      frequency_per_month: slotFilled('90'),
      duration_minutes: slotFilled('30'),
    })
    // 2 of 4 mandatory = 0.5
    expect(scoreSlotCoverage([step])).toBe(0.5)
  })
})

// ─── phaseAdherence ───────────────────────────────────────────────────────────

describe('scorePhaseAdherence', () => {
  it('returns 1.0 when no walkthrough turns', () => {
    const turns = [makeTurn({ phase: 'intro' }), makeTurn({ phase: 'slot_completion' })]
    expect(scorePhaseAdherence(turns)).toBe(1.0)
  })

  it('marks turn conforming when agent asks open process question', () => {
    const turns = [makeTurn({ phase: 'walkthrough_step', agentText: 'Kannst du den Ablauf beschreiben?' })]
    expect(scorePhaseAdherence(turns)).toBe(1.0)
  })

  it('first-time slot question in walkthrough is conforming (not re-asking)', () => {
    // New semantics: first occurrence of a slot question is exploratory → not a violation.
    const turns = [
      makeTurn({ phase: 'walkthrough_step', agentText: 'Wie lange dauert dieser Schritt typischerweise?' }),
    ]
    expect(scorePhaseAdherence(turns)).toBe(1.0)
  })

  it('re-asking same slot type twice in walkthrough is a violation', () => {
    // Second occurrence of the same pattern = re-asking a known slot → violation.
    const turns = [
      makeTurn({ phase: 'walkthrough_step', agentText: 'Wie lange dauert dieser Schritt typischerweise?' }),
      makeTurn({ phase: 'walkthrough_step', agentText: 'Wie lange dauert das normalerweise?' }),
    ]
    // Turn 1: first occurrence → conforming. Turn 2: repeat → violating. 1/2 = 0.5
    expect(scorePhaseAdherence(turns)).toBe(0.5)
  })

  it('calculates mixed conformity correctly — only counts re-asks as violations', () => {
    const turns = [
      makeTurn({ phase: 'walkthrough_step', agentText: 'Erzähl mir wie das abläuft.' }),
      makeTurn({ phase: 'walkthrough_step', agentText: 'Wie lange dauert das typischerweise?' }),
      makeTurn({ phase: 'walkthrough_step', agentText: 'Was passiert danach?' }),
    ]
    // All 3 turns conforming: no repeated slot patterns → 3/3 = 1.0
    expect(scorePhaseAdherence(turns)).toBe(1.0)
  })
})

// ─── anchoringViolations ──────────────────────────────────────────────────────

describe('scoreAnchoringViolations', () => {
  it('returns 0 for clean agent text', () => {
    const turns = [
      makeTurn({ agentText: 'Wie sieht der typische Ablauf aus?' }),
      makeTurn({ agentText: 'Welche Herausforderungen begegnen dir dabei?' }),
    ]
    expect(scoreAnchoringViolations(turns)).toBe(0)
  })

  it('detects "rechne ich mit" pattern', () => {
    const turns = [makeTurn({ agentText: 'Dann rechne ich mit 30 Minuten pro Rechnung.' })]
    expect(scoreAnchoringViolations(turns)).toBe(1)
  })

  it('detects "im Schnitt X" with number', () => {
    const turns = [makeTurn({ agentText: 'Im Schnitt 90 Rechnungen, nehme ich an.' })]
    expect(scoreAnchoringViolations(turns)).toBe(1)
  })

  it('counts one violation per turn at most', () => {
    const turns = [
      makeTurn({ agentText: 'Rechne ich mit 30 Minuten. Also nehmen wir mal 30 Minuten an.' }),
    ]
    expect(scoreAnchoringViolations(turns)).toBe(1)
  })

  it('counts violations across multiple turns', () => {
    const turns = [
      makeTurn({ agentText: 'Also sind es ca. 30 Minuten.' }),
      makeTurn({ agentText: 'Kannst du mehr erzählen?' }),
      makeTurn({ agentText: 'Also dann wären es ca. 90 Fälle.' }),
    ]
    expect(scoreAnchoringViolations(turns)).toBe(2)
  })
})

// ─── toolCallPlausibility ─────────────────────────────────────────────────────

describe('scoreToolCallPlausibility', () => {
  it('returns 1.0 when no record_slot calls', () => {
    const turns = [makeTurn()]
    expect(scoreToolCallPlausibility(turns)).toBe(1.0)
  })

  it('returns 1.0 when evidence_quote found verbatim in user input (with source_turn)', () => {
    const turns = [
      makeTurn({
        userInput: 'Ich bearbeite etwa 80 bis 100 Rechnungen pro Monat.',
        toolCalls: [
          {
            toolName: 'record_slot',
            args: {
              step_title: 'Rechnungsprüfung',
              slot: 'frequency_per_month',
              value: 90,
              evidence_quote: '80 bis 100 Rechnungen pro Monat',
              source_turn: 1,
            },
          },
        ],
      }),
    ]
    expect(scoreToolCallPlausibility(turns)).toBe(1.0)
  })

  it('applies 0.9 penalty when source_turn missing but verbatim match found', () => {
    const turns = [
      makeTurn({
        userInput: 'Ich bearbeite etwa 80 bis 100 Rechnungen pro Monat.',
        toolCalls: [
          {
            toolName: 'record_slot',
            args: {
              step_title: 'Rechnungsprüfung',
              slot: 'frequency_per_month',
              value: 90,
              evidence_quote: '80 bis 100 Rechnungen pro Monat',
            },
          },
        ],
      }),
    ]
    expect(scoreToolCallPlausibility(turns)).toBe(0.9)
  })

  it('gives partial credit for paraphrased quote via token overlap', () => {
    const turns = [
      makeTurn({
        userInput: 'Ich bearbeite etwa 80 bis 100 Rechnungen pro Monat aus unseren Eingangskanälen.',
        toolCalls: [
          {
            toolName: 'record_slot',
            args: {
              step_title: 'Rechnungsprüfung',
              slot: 'frequency_per_month',
              value: 90,
              evidence_quote: '100 Rechnungen Monat',
              source_turn: 1,
            },
          },
        ],
      }),
    ]
    const score = scoreToolCallPlausibility(turns)
    expect(score).toBeGreaterThan(0.3)
    expect(score).toBeLessThan(1.0)
  })

  it('returns 0.0 when evidence_quote not in user input', () => {
    const turns = [
      makeTurn({
        userInput: 'Das variiert sehr.',
        toolCalls: [
          {
            toolName: 'record_slot',
            args: {
              step_title: 'Rechnungsprüfung',
              slot: 'frequency_per_month',
              value: 90,
              evidence_quote: '90 Rechnungen pro Monat',
            },
          },
        ],
      }),
    ]
    expect(scoreToolCallPlausibility(turns)).toBe(0.0)
  })

  it('ignores non-record_slot tool calls', () => {
    const turns = [
      makeTurn({
        toolCalls: [{ toolName: 'register_step', args: { step_title: 'Rechnungsprüfung' } }],
      }),
    ]
    expect(scoreToolCallPlausibility(turns)).toBe(1.0)
  })

  it('calculates partial plausibility across multiple calls (with source_turn)', () => {
    const turns = [
      makeTurn({
        userInput: 'Ich arbeite mit SAP FI und DocuWare.',
        toolCalls: [
          {
            toolName: 'record_slot',
            args: { step_title: 'Step', slot: 'data_sources', value: 'SAP FI', evidence_quote: 'SAP FI', source_turn: 1 },
          },
          {
            toolName: 'record_slot',
            args: { step_title: 'Step', slot: 'rule_based', value: 'ja', evidence_quote: 'nie gesagt', source_turn: 1 },
          },
        ],
      }),
    ]
    expect(scoreToolCallPlausibility(turns)).toBe(0.5)
  })
})

// ─── completionCorrectness ────────────────────────────────────────────────────

describe('scoreCompletionCorrectness', () => {
  it('returns true for completed status', () => {
    expect(scoreCompletionCorrectness('completed')).toBe(true)
  })

  it('returns false for created status', () => {
    expect(scoreCompletionCorrectness('created')).toBe(false)
  })

  it('returns false for active status', () => {
    expect(scoreCompletionCorrectness('active')).toBe(false)
  })
})
