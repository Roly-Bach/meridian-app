import type { TurnRecord } from './types'

/**
 * Counts turns where the agent proposed a number instead of asking for one.
 * Lower is better; target is 0.
 */
const ANCHORING_PATTERNS = [
  /rechne ich mit/i,
  /notiere ich\s+(?:mal\s+)?(?:ca\.?\s*)?\d+/i,
  /im schnitt\s+(?:ca\.?\s*)?\d+/i,
  /also\s+(?:ca\.?\s*)?\d+\s*(?:minuten|stunden|mal|rechnungen|fälle|tage)/i,
  /nehmen wir\s+(?:ca\.?\s*)?\d+/i,
  /(?:sage|sagen wir)\s+(?:ca\.?\s*)?\d+/i,
  /schätze ich\s+(?:auf\s+)?(?:ca\.?\s*)?\d+/i,
  /das entspricht\s+(?:ca\.?\s*)?\d+/i,
  /(?:also|dann)\s+(?:sind es|wären es|haben wir)\s+(?:ca\.?\s*)?\d+/i,
]

export function scoreAnchoringViolations(turns: TurnRecord[]): number {
  let violations = 0
  for (const turn of turns) {
    const hasViolation = ANCHORING_PATTERNS.some(re => re.test(turn.agentText))
    if (hasViolation) violations++
  }
  return violations
}
