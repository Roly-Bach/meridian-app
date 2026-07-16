import { describe, it, expect } from 'vitest'
import { scoreHallucinationRate } from './hallucinationRate'
import type { StepEntry, SlotValue, TaziteSlotArray } from '@/services/interviewSemantic'
import type { TurnRecord } from './types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const potenzialValue = (value: number, quote: string): SlotValue => ({
  value,
  quote,
  confidence: 'confirmed',
})

const taziteValue = (value: string[], quote: string): TaziteSlotArray => ({
  value,
  quote,
  nicht_befund_typ: null,
})

const makeStep = (overrides: Partial<StepEntry> = {}): StepEntry => ({
  title: 'Rechnungsprüfung',
  reihenfolge: 1,
  governance: null,
  abhaengigkeiten: null,
  status: 'done',
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
})

const makeTurn = (userInput: string, turnNumber = 1): TurnRecord => ({
  turnNumber,
  userInput,
  agentText: '',
  phase: 'explore',
  toolCalls: [],
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('scoreHallucinationRate', () => {
  it('returns 0 when all quotes match the transcript verbatim', () => {
    const turns = [makeTurn('Ich bearbeite im Monat 80 bis 100 Rechnungen.')]
    const tracker = [
      makeStep({
        potenzial: {
          frequency_per_month: potenzialValue(90, 'Ich bearbeite im Monat 80 bis 100 Rechnungen.'),
          duration_minutes: null,
          error_rate_percent: null,
          media_breaks: null,
        },
      }),
    ]
    expect(scoreHallucinationRate(turns, tracker)).toBe(0)
  })

  it('returns 0 when the matching quote exists but the stored evidence is wrapped in literal quote characters (KI-15)', () => {
    // Reproduces eval 2026-06-26 run3: evidence_quote stored with leading/trailing `"` chars,
    // copied from the analyst prompt's quote-styled examples ("100", "5 Minuten"). Content is
    // verbatim-correct; only the literal quote chars broke the old prefix match.
    const turns = [makeTurn('In diesem Bereich bearbeite ich im Monatsverlauf eine Größenordnung von insgesamt 80 bis 100 eingegangenen Rechnungen.')]
    const tracker = [
      makeStep({
        potenzial: {
          frequency_per_month: potenzialValue(90, '"In diesem Bereich bearbeite ich im Monatsverlauf eine Größenordnung von insgesamt 80 bis 100 eingegangenen Rechnungen."'),
          duration_minutes: null,
          error_rate_percent: null,
          media_breaks: null,
        },
      }),
    ]
    expect(scoreHallucinationRate(turns, tracker)).toBe(0)
  })

  it('still flags a genuinely fabricated quote even with surrounding quote characters', () => {
    const turns = [makeTurn('Das dauert einen nennenswerten Teil meiner Arbeitszeit.')]
    const tracker = [
      makeStep({
        potenzial: {
          frequency_per_month: null,
          duration_minutes: potenzialValue(240, '"Das hat ungefähr 240 Minuten gedauert."'),
          error_rate_percent: null,
          media_breaks: null,
        },
      }),
    ]
    expect(scoreHallucinationRate(turns, tracker)).toBe(1)
  })

  it('handles tazite slots with quote-wrapped evidence the same way', () => {
    const turns = [makeTurn('Ich wechsle manuell zwischen E-Mail, SAP FI und DocuWare.')]
    const tracker = [
      makeStep({
        slots: {
          entscheidungslogik: null,
          tazite_cues: null,
          ausnahmen: null,
          inputs: taziteValue(['E-Mail-Programm', 'SAP FI'], '"wechsle manuell zwischen E-Mail, SAP FI und DocuWare"'),
          outputs: null,
          hilfsmittel: null,
        },
      }),
    ]
    expect(scoreHallucinationRate(turns, tracker)).toBe(0)
  })

  it('still treats backfill markers and short quotes as safe after quote-stripping', () => {
    const turns = [makeTurn('irrelevant')]
    const tracker = [
      makeStep({
        potenzial: {
          frequency_per_month: potenzialValue(5, '"[auto-backfill]"'),
          duration_minutes: potenzialValue(5, '"5"'),
          error_rate_percent: null,
          media_breaks: null,
        },
      }),
    ]
    expect(scoreHallucinationRate(turns, tracker)).toBe(0)
  })
})
