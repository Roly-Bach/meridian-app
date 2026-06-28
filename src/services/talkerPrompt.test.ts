import { describe, it, expect } from 'vitest'

import { buildDynamicContext } from './talkerPrompt'
import type { StepEntry } from './interviewSemantic'
import type { InterviewContext } from './interviewTypes'

function makeStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return {
    title: 'Ticket-Bearbeitung',
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
    ...overrides,
  }
}

function makeContext(overrides: Partial<InterviewContext> = {}): InterviewContext {
  return {
    interviewId: 'i1',
    workspaceId: 'w1',
    employeeName: 'Max',
    employeeRole: 'IT-Support',
    department: 'IT',
    focusTopics: null,
    phase: 'process_loop',
    timerMinutes: 3,
    topicsCovered: [],
    topicsOpen: [],
    extractionsLog: [],
    maxDurationMinutes: 20,
    stepTracker: [],
    ...overrides,
  }
}

// ─── KI-18: justFilledSlots rendering ────────────────────────────────────────
// Talker fabricated "Du hast vorhin 350 Tickets pro Monat erwähnt" for a value
// quick-extract had just written from the SAME turn's input (runInterviewTurn.ts
// "Pre-Talker Quick-Extract" runs before createTalkerStream). These tests assert
// the prompt now distinguishes same-turn fills from genuinely earlier-turn ones.

describe('buildDynamicContext — justFilledSlots (KI-18)', () => {
  it('marks a just-filled potenzial slot distinctly in the step tracker (non-walkthrough phase)', () => {
    const ctx = makeContext({
      phase: 'process_loop',
      stepTracker: [
        makeStep({
          potenzial: {
            frequency_per_month: { value: 350, quote: '75 bis 100 pro Woche' },
            duration_minutes: null,
            error_rate_percent: null,
            media_breaks: null,
          },
        }),
      ],
      justFilledSlots: [{ step_title: 'Ticket-Bearbeitung', slot: 'frequency_per_month' }],
    })
    const prompt = buildDynamicContext(ctx)
    expect(prompt).toContain('frequency_per_month: ✓ gerade erfasst (diese Nachricht)')
    expect(prompt).not.toMatch(/frequency_per_month\s*: ✓ erfasst/)
  })

  it('includes an explicit "not vorhin" reminder section listing the just-filled slot', () => {
    const ctx = makeContext({
      stepTracker: [
        makeStep({
          potenzial: {
            frequency_per_month: { value: 350, quote: '75 bis 100 pro Woche' },
            duration_minutes: null,
            error_rate_percent: null,
            media_breaks: null,
          },
        }),
      ],
      justFilledSlots: [{ step_title: 'Ticket-Bearbeitung', slot: 'frequency_per_month' }],
    })
    const prompt = buildDynamicContext(ctx)
    expect(prompt).toContain('Gerade erst erfasst (diese Nachricht — NICHT "vorhin")')
    expect(prompt).toContain('"Ticket-Bearbeitung" → frequency_per_month')
    expect(prompt).toMatch(/Rückverweis-Formulierung/)
  })

  it('omits a just-filled slot from "Bereits erfasste Werte" snapshot', () => {
    const ctx = makeContext({
      phase: 'slot_completion',
      stepTracker: [
        makeStep({
          potenzial: {
            frequency_per_month: { value: 350, quote: '75 bis 100 pro Woche' },
            duration_minutes: { value: 10, quote: '10 Minuten' },
            error_rate_percent: null,
            media_breaks: null,
          },
        }),
      ],
      justFilledSlots: [{ step_title: 'Ticket-Bearbeitung', slot: 'frequency_per_month' }],
    })
    const prompt = buildDynamicContext(ctx)
    const afterHeading = prompt.split('## Bereits erfasste Werte')[1] ?? ''
    const snapshotSection = afterHeading.split(/\n## /)[0] ?? ''
    expect(snapshotSection).not.toContain('frequency_per_month')
    expect(snapshotSection).toContain('duration_minutes')
  })

  it('marks a just-filled slot distinctly in walkthrough_step READ_ONLY_STATE', () => {
    const ctx = makeContext({
      phase: 'walkthrough_step',
      stepTracker: [
        makeStep({
          status: 'walkthrough',
          potenzial: {
            frequency_per_month: { value: 350, quote: '75 bis 100 pro Woche' },
            duration_minutes: null,
            error_rate_percent: null,
            media_breaks: null,
          },
        }),
      ],
      justFilledSlots: [{ step_title: 'Ticket-Bearbeitung', slot: 'frequency_per_month' }],
    })
    const prompt = buildDynamicContext(ctx)
    expect(prompt).toContain('frequency_per_month: ✓ gerade erfasst (diese Nachricht)')
  })

  it('renders plain ✓ erfasst (no reminder section) when nothing was filled this turn', () => {
    const ctx = makeContext({
      stepTracker: [
        makeStep({
          potenzial: {
            frequency_per_month: { value: 350, quote: '75 bis 100 pro Woche' },
            duration_minutes: null,
            error_rate_percent: null,
            media_breaks: null,
          },
        }),
      ],
    })
    const prompt = buildDynamicContext(ctx)
    expect(prompt).toMatch(/frequency_per_month\s*: ✓ erfasst/)
    expect(prompt).not.toContain('Gerade erst erfasst')
  })
})
