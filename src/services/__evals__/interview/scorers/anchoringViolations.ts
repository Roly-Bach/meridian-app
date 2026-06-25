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

/**
 * Same count, normalized by turn count. The raw count alone is inconsistent
 * with every other scorer in this system (all 0–1 rates) — a 35-turn
 * interview with 3 violations isn't as "dirty" as a 15-turn one with 3
 * (2026-06-24 eval-system audit). Kept alongside the raw count rather than
 * replacing it — anchoringViolations isn't gate-relevant, so this is additive.
 */
export function scoreAnchoringViolationRate(turns: TurnRecord[]): number {
  if (turns.length === 0) return 0
  return scoreAnchoringViolations(turns) / turns.length
}
