import { POTENZIAL_SLOT_NAMES, TAZITE_SLOT_NAMES } from '@/services/interviewSemantic'
import type { StepEntry } from '@/services/interviewSemantic'
import type { TurnRecord } from './types'

/**
 * PROJ-28/BL-E2.1 — Hallucination Rate
 *
 * Fraction of filled slot values whose evidence quote cannot be found in any
 * user turn transcript. Lower is better; target < 0.01 (1%).
 *
 * A slot is "suspicious" when its stored quote has no 10-char prefix match in
 * the concatenated user turns. This is a conservative proxy — the grounding
 * guard (ADR-015) already rejects span-mismatches at write time, so a
 * non-zero rate indicates either guard bypass or legacy entries.
 */
export function scoreHallucinationRate(turns: TurnRecord[], finalStepTracker: StepEntry[]): number {
  const allUserText = turns.map((t) => t.userInput).join(' ')

  let total = 0
  let suspicious = 0

  for (const step of finalStepTracker) {
    // Potenzial slots
    for (const slot of POTENZIAL_SLOT_NAMES) {
      const sv = step.potenzial[slot]
      if (sv == null || sv.value == null) continue
      total++
      if (!quoteFoundInTranscript(sv.quote, allUserText)) suspicious++
    }
    // Tazite slots
    for (const slot of TAZITE_SLOT_NAMES) {
      const sv = step.slots[slot]
      if (sv == null || sv.value == null) continue
      total++
      if (!quoteFoundInTranscript(sv.quote, allUserText)) suspicious++
    }
  }

  return total === 0 ? 0 : suspicious / total
}

function quoteFoundInTranscript(quote: string | null | undefined, transcript: string): boolean {
  if (!quote || quote.trim().length < 5) return true // too short to verify — assume ok
  const prefix = quote.trim().substring(0, 10)
  return transcript.includes(prefix)
}
