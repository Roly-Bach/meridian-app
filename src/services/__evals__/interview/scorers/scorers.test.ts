import { describe, it, expect, vi } from 'vitest'

// interviewAgent transitively imports supabase-admin (server-only). Mock it here.
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: vi.fn() }),
}))
import { scoreSlotCoverage } from './slotCoverage'
import { scorePhaseAdherence } from './phaseAdherence'
import { scoreAnchoringViolations, scoreAnchoringViolationRate } from './anchoringViolations'
import { scoreConfidenceTrigger } from './confidenceTrigger'
import { scoreToolCallPlausibility } from './toolCallPlausibility'
import { scoreCompletionCorrectness } from './completionCorrectness'
import type { TurnRecord } from './types'
import type { StepEntry } from '@/services/interviewSemantic'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const slotFilled = (value: string) => ({ value, quote: value, confidence: 'confirmed' as const })

const taziteFilled = (value: string): import('@/services/interviewSemantic').SchemaSlotString => ({
  value,
  quote: value,
  confidence: 'confirmed',
  nicht_befund_typ: null,
})

const makeStep = (slotOverrides: Partial<StepEntry['slots']> = {}, stepOverrides: Partial<Omit<StepEntry, 'slots'>> = {}): StepEntry => ({
  title: 'Rechnungsprüfung',
  reihenfolge: 1,
  abhaengigkeiten: null,
  potenzial: {
    frequency: null,
    duration: null,
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
    reibungspunkte: null,
    ausloeser: null,
    aufgabentyp: null,
    risiko_schwere: null,
    standardisierungsgrad: null,
    informationsdichte: null,
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
  phase: 'explore',
  toolCalls: [],
  ...overrides,
})

// ─── slotCoverage ─────────────────────────────────────────────────────────────
// New denominator: 9 O1–O6 fields (bezeichnung, reihenfolge, entscheidungslogik,
// tazite_cues, ausnahmen, inputs, outputs, hilfsmittel, abhaengigkeiten).
// potenzial-fields and governance do NOT count toward O1–O6 coverage.

describe('scoreSlotCoverage', () => {
  it('returns 0 for empty tracker', () => {
    expect(scoreSlotCoverage([])).toBe(0)
  })

  it('counts bezeichnung (title) and reihenfolge as filled for any valid step', () => {
    // A bare step has title + reihenfolge filled → 2/9
    expect(scoreSlotCoverage([makeStep()])).toBeCloseTo(2 / 9)
  })

  it('returns 1.0 when all 9 O1–O6 fields filled', () => {
    const step = makeStep({
      entscheidungslogik: taziteFilled('Freigabe ab 5000 EUR'),
      tazite_cues: { value: ['Erfahrung nötig'], quote: 'Erfahrung nötig', nicht_befund_typ: null },
      ausnahmen: { value: ['Eilbuchung'], quote: 'Eilbuchung', nicht_befund_typ: null },
      inputs: { value: ['Eingangsrechnung'], quote: 'Eingangsrechnung', nicht_befund_typ: null },
      outputs: { value: ['Buchungssatz'], quote: 'Buchungssatz', nicht_befund_typ: null },
      hilfsmittel: { value: ['SAP FI'], quote: 'SAP FI', nicht_befund_typ: null },
    }, {
      abhaengigkeiten: { depends_on: [{ schritt_id: 'S001', typ: 'voraussetzung' as const, beschreibung: null }], influences: [], nicht_befund_typ: null },
    })
    expect(scoreSlotCoverage([step])).toBe(1.0)
  })

  it('counts nicht_befund_typ as filled even without value', () => {
    const step = makeStep({
      entscheidungslogik: { value: null, quote: null, nicht_befund_typ: 'nicht_zutreffend' },
    })
    // bezeichnung + reihenfolge + entscheidungslogik = 3/9
    expect(scoreSlotCoverage([step])).toBeCloseTo(3 / 9)
  })

  it('returns correct fraction across two steps', () => {
    const step1 = makeStep({
      entscheidungslogik: taziteFilled('Freigabe'),
    }, { reihenfolge: 1 })
    const step2 = makeStep({}, { title: 'Monatsabschluss', reihenfolge: 2 })
    // step1: 3/9 filled (bezeichnung, reihenfolge, entscheidungslogik)
    // step2: 2/9 filled (bezeichnung, reihenfolge)
    // total: 5 / (2 × 9) = 5/18
    expect(scoreSlotCoverage([step1, step2])).toBeCloseTo(5 / 18)
  })
})

// ─── phaseAdherence ───────────────────────────────────────────────────────────

describe('scorePhaseAdherence', () => {
  it('returns 1.0 when no walkthrough turns', () => {
    const turns = [makeTurn({ phase: 'intro' }), makeTurn({ phase: 'closing' })]
    expect(scorePhaseAdherence(turns)).toBe(1.0)
  })

  it('marks turn conforming when agent asks open process question', () => {
    const turns = [makeTurn({ phase: 'explore', agentText: 'Kannst du den Ablauf beschreiben?' })]
    expect(scorePhaseAdherence(turns)).toBe(1.0)
  })

  it('first-time slot question in walkthrough is conforming (not re-asking)', () => {
    // New semantics: first occurrence of a slot question is exploratory → not a violation.
    const turns = [
      makeTurn({ phase: 'explore', agentText: 'Wie lange dauert dieser Schritt typischerweise?' }),
    ]
    expect(scorePhaseAdherence(turns)).toBe(1.0)
  })

  it('re-asking same slot type twice in walkthrough is a violation', () => {
    // Second occurrence of the same pattern = re-asking a known slot → violation.
    const turns = [
      makeTurn({ phase: 'explore', agentText: 'Wie lange dauert dieser Schritt typischerweise?' }),
      makeTurn({ phase: 'explore', agentText: 'Wie lange dauert das normalerweise?' }),
    ]
    // Turn 1: first occurrence → conforming. Turn 2: repeat → violating. 1/2 = 0.5
    expect(scorePhaseAdherence(turns)).toBe(0.5)
  })

  it('calculates mixed conformity correctly — only counts re-asks as violations', () => {
    const turns = [
      makeTurn({ phase: 'explore', agentText: 'Erzähl mir wie das abläuft.' }),
      makeTurn({ phase: 'explore', agentText: 'Wie lange dauert das typischerweise?' }),
      makeTurn({ phase: 'explore', agentText: 'Was passiert danach?' }),
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

// ─── anchoringViolationRate (2026-06-24 audit) ─────────────────────────────────
// Raw count alone isn't comparable across interviews of different length — this
// normalizes it. Had zero test coverage before the audit, same as confidenceTrigger.

describe('scoreAnchoringViolationRate', () => {
  it('returns 0 for empty turns (no division by zero)', () => {
    expect(scoreAnchoringViolationRate([])).toBe(0)
  })

  it('returns 0 for clean agent text', () => {
    const turns = [makeTurn({ agentText: 'Wie sieht der typische Ablauf aus?' })]
    expect(scoreAnchoringViolationRate(turns)).toBe(0)
  })

  it('normalizes by turn count: 1 violation in 4 turns → 0.25', () => {
    const turns = [
      makeTurn({ agentText: 'Dann rechne ich mit 30 Minuten pro Rechnung.' }),
      makeTurn({ agentText: 'Wie sieht der typische Ablauf aus?' }),
      makeTurn({ agentText: 'Welche Herausforderungen begegnen dir dabei?' }),
      makeTurn({ agentText: 'Gibt es Ausnahmen?' }),
    ]
    expect(scoreAnchoringViolationRate(turns)).toBe(0.25)
  })

  it('same violation count, longer interview → lower rate (the bug this fixes)', () => {
    const violation = makeTurn({ agentText: 'Dann rechne ich mit 30 Minuten pro Rechnung.' })
    const clean = makeTurn({ agentText: 'Wie sieht der typische Ablauf aus?' })
    const shortInterview = [violation, violation, violation, clean]
    const longInterview = [violation, violation, violation, ...Array(20).fill(clean)]
    expect(scoreAnchoringViolations(shortInterview)).toBe(scoreAnchoringViolations(longInterview))
    expect(scoreAnchoringViolationRate(longInterview)).toBeLessThan(scoreAnchoringViolationRate(shortInterview))
  })
})

// ─── confidenceTrigger (2026-06-24 audit) ──────────────────────────────────────
// Had zero test coverage before the audit. The null-vs-1.0 distinction is the
// actual fix: zero unknown-confidence slots is "no signal", not a perfect score.

describe('scoreConfidenceTrigger', () => {
  it('returns null (not 1.0) when there are zero unknown-confidence record_slot calls', () => {
    const turns = [makeTurn({ toolCalls: [{ toolName: 'record_slot', args: { step_title: 'Rechnungsprüfung', slot: 'entscheidungslogik', confidence: 'confirmed' } }] })]
    expect(scoreConfidenceTrigger(turns)).toBeNull()
  })

  it('returns null for turns with no record_slot calls at all', () => {
    expect(scoreConfidenceTrigger([makeTurn()])).toBeNull()
  })

  it('1.0 when an unknown-confidence slot gets a follow-up re-ask within 3 turns', () => {
    const turns = [
      makeTurn({ turnNumber: 1, toolCalls: [{ toolName: 'record_slot', args: { step_title: 'Rechnungsprüfung', slot: 'entscheidungslogik', confidence: 'unknown' } }] }),
      makeTurn({ turnNumber: 2, toolCalls: [] }),
      makeTurn({ turnNumber: 3, toolCalls: [{ toolName: 'record_slot', args: { step_title: 'Rechnungsprüfung', slot: 'entscheidungslogik', confidence: 'confirmed' } }] }),
    ]
    expect(scoreConfidenceTrigger(turns)).toBe(1)
  })

  it('0 when an unknown-confidence slot never gets a follow-up within 3 turns', () => {
    const turns = [
      makeTurn({ turnNumber: 1, toolCalls: [{ toolName: 'record_slot', args: { step_title: 'Rechnungsprüfung', slot: 'entscheidungslogik', confidence: 'unknown' } }] }),
      makeTurn({ turnNumber: 2, toolCalls: [] }),
      makeTurn({ turnNumber: 3, toolCalls: [] }),
      makeTurn({ turnNumber: 4, toolCalls: [] }),
      makeTurn({ turnNumber: 5, toolCalls: [] }),
    ]
    expect(scoreConfidenceTrigger(turns)).toBe(0)
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
              slot: 'frequency',
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
              slot: 'frequency',
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
              slot: 'frequency',
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
              slot: 'frequency',
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
