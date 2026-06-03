import type { TurnRecord } from './types'

/**
 * Fraction of record_slot calls whose evidence_quote appears verbatim in the
 * corresponding user input.
 *
 * When source_turn is set in tool args: look up evidence against
 * turns[source_turn - 1].userInput (the historical turn the analyst referenced).
 *
 * When source_turn is missing: fall back to current turn userInput.
 *
 * Target: ≥ 0.95. Returns 1.0 if no record_slot calls were made.
 */
export function scoreToolCallPlausibility(turns: TurnRecord[]): number {
  type Candidate = {
    evidenceQuote: string
    userInput: string
    hasSourceTurn: boolean
  }

  const candidates: Candidate[] = []

  for (const turn of turns) {
    for (const call of turn.toolCalls) {
      if (call.toolName !== 'record_slot') continue
      if (!call.args) continue

      const evidenceQuote = call.args['evidence_quote']
      if (typeof evidenceQuote !== 'string' || evidenceQuote.trim().length < 3) continue

      const rawSourceTurn = call.args['source_turn']
      const sourceTurn = typeof rawSourceTurn === 'number' && Number.isInteger(rawSourceTurn) && rawSourceTurn > 0
        ? rawSourceTurn
        : null

      let userInput: string
      let hasSourceTurn: boolean

      if (sourceTurn !== null) {
        // 1-indexed turn → 0-indexed array lookup
        const referencedTurn = turns[sourceTurn - 1]
        userInput = referencedTurn?.userInput ?? ''
        hasSourceTurn = true
      } else {
        // No source_turn: use current turn's userInput with penalty applied later
        userInput = turn.userInput
        hasSourceTurn = false
      }

      candidates.push({ evidenceQuote: evidenceQuote.trim(), userInput, hasSourceTurn })
    }
  }

  if (candidates.length === 0) return 1.0

  let totalScore = 0
  for (const { evidenceQuote, userInput, hasSourceTurn } of candidates) {
    const normalizedQuote = evidenceQuote.toLowerCase().replace(/\s+/g, ' ')
    const normalizedInput = userInput.toLowerCase().replace(/\s+/g, ' ')
    const matches = normalizedInput.includes(normalizedQuote)

    totalScore += matches ? 1.0 : 0.0
  }

  return totalScore / candidates.length
}
