import type { TurnRecord } from './types'
import type { Phase } from '@/services/interviewSemantic'

/**
 * PROJ-42: walkthrough_step collapsed into 'explore' — the agent should NOT
 * re-ask known slot values during explore.
 *
 * Diagnostic signal — measures explicit slot-fishing during explore.
 * A turn is flagged only when BOTH conditions hold:
 * 1. Agent text matches a direct slot pattern (direct quantity/duration question)
 * 2. The SAME pattern fires in a prior explore turn (re-asking, not first-time exploration)
 *
 * First-time slot questions during explore are normal exploratory behavior and are NOT penalized.
 * This prevents false positives like "Wie viele Rechnungen kommen rein?" (Turn 3, first exploration)
 * from being counted as violations when the value was not yet known.
 *
 * NOTE: "diagnostic" metric — phase_progression=1.0 is the primary quality signal.
 * phase_adherence is useful to detect excessive slot-fishing loops but not strict conformity.
 */
const DIRECT_SLOT_PATTERNS = [
  /wie viele[^?]*pro monat\?/i,            // frequency-specific
  /wie lange dauert/i,
  /wie lang (?:dauert|ist)/i,
  /wie hoch ist die fehlerquote/i,
  /wie oft (?:machst|führst|bearbeitest|erledigst)/i,
  /wie häufig (?:machst|führst|passiert|kommt)/i,
  /durchschnittlich[^?]+(?:minuten|stunden|tage|mal|monat)\?/i,
]

export function scorePhaseAdherence(turns: TurnRecord[]): number {
  const walkthroughTurns = turns.filter(t => t.phase === 'explore')
  if (walkthroughTurns.length === 0) return 1.0

  // Track which patterns have already fired at least once — only penalize repeats.
  const firedPatterns = new Set<number>()
  let conforming = 0

  for (const turn of walkthroughTurns) {
    let isViolation = false
    for (let i = 0; i < DIRECT_SLOT_PATTERNS.length; i++) {
      if (DIRECT_SLOT_PATTERNS[i].test(turn.agentText)) {
        if (firedPatterns.has(i)) {
          // Same pattern fired before → re-asking a known slot → violation
          isViolation = true
          break
        } else {
          firedPatterns.add(i)
        }
      }
    }
    if (!isViolation) conforming++
  }

  return conforming / walkthroughTurns.length
}

const PHASE_ORDER: Phase[] = ['intro', 'explore', 'closing']

/**
 * Measures how far the interview progressed through its phase lifecycle.
 * Replaces phaseAdherence as primary quality signal.
 *
 * PROJ-42: the six-phase ladder collapsed into three (intro/explore/closing) —
 * granularity intentionally coarser than before (that granularity was the bug,
 * see interviewOrchestrator.ts header comment / KI-23).
 *
 * 0.0  stayed in intro/explore only, no closing reached
 * 0.5  reached closing
 * 1.0  reached closing AND interview completed
 */
export function scorePhaseProgression(turns: TurnRecord[], interviewCompleted: boolean): number {
  const phases = new Set(turns.map(t => t.phase))
  const steps = [
    phases.has('closing'),
    phases.has('closing') && interviewCompleted,
  ]
  const reached = steps.filter(Boolean).length
  return reached === 0 ? 0 : reached / steps.length
}
