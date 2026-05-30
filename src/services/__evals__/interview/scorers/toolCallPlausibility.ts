import type { TurnRecord } from './types'

/**
 * Fraction of record_slot calls whose evidence_quote appears verbatim in the preceding user input.
 * Target: ≥ 0.95. Returns 1.0 if no record_slot calls were made.
 */
export function scoreToolCallPlausibility(turns: TurnRecord[]): number {
  const candidates: Array<{ evidenceQuote: string; userInput: string }> = []

  for (const turn of turns) {
    for (const call of turn.toolCalls) {
      if (call.toolName !== 'record_slot') continue
      if (!call.args) continue
      const evidenceQuote = call.args['evidence_quote']
      if (typeof evidenceQuote === 'string' && evidenceQuote.trim().length >= 3) {
        candidates.push({ evidenceQuote: evidenceQuote.trim(), userInput: turn.userInput })
      }
    }
  }

  if (candidates.length === 0) return 1.0

  let plausible = 0
  for (const { evidenceQuote, userInput } of candidates) {
    const normalizedQuote = evidenceQuote.toLowerCase().replace(/\s+/g, ' ')
    const normalizedInput = userInput.toLowerCase().replace(/\s+/g, ' ')
    if (normalizedInput.includes(normalizedQuote)) plausible++
  }

  return plausible / candidates.length
}
