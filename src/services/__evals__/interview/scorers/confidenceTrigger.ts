import type { TurnRecord } from './types'

/**
 * PROJ-28/BL-E2.2 — Confidence Trigger Rate
 *
 * Fraction of record_slot calls that stored an estimate/unknown value that
 * were followed by a re-ask or update in the next 3 turns.
 *
 * A "triggered" follow-up is detected when the same (step, slot) pair appears
 * in a subsequent record_slot call within turns N+1..N+3 — indicating the
 * agent re-asked and received an answer (or attempted to confirm).
 *
 * Target > 0.8. Returns 1.0 when there are no estimate/unknown records
 * (trivially passing — no follow-ups needed).
 */
export function scoreConfidenceTrigger(turns: TurnRecord[]): number {
  interface EstimateRecord {
    turnNumber: number
    step_title: string
    slot: string
  }

  const estimateRecords: EstimateRecord[] = []

  for (const turn of turns) {
    for (const call of turn.toolCalls) {
      if (call.toolName !== 'record_slot') continue
      const conf = call.args.confidence as string | undefined
      if (conf === 'estimate' || conf === 'unknown') {
        estimateRecords.push({
          turnNumber: turn.turnNumber,
          step_title: call.args.step_title as string,
          slot: call.args.slot as string,
        })
      }
    }
  }

  if (estimateRecords.length === 0) return 1

  let triggered = 0
  for (const record of estimateRecords) {
    const hasFollowUp = turns.some(
      (t) =>
        t.turnNumber > record.turnNumber &&
        t.turnNumber <= record.turnNumber + 3 &&
        t.toolCalls.some(
          (c) =>
            c.toolName === 'record_slot' &&
            c.args.step_title === record.step_title &&
            c.args.slot === record.slot,
        ),
    )
    if (hasFollowUp) triggered++
  }

  return triggered / estimateRecords.length
}
