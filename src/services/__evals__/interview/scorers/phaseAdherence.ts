import type { TurnRecord } from './types'
import type { Phase } from '@/services/interviewAgent'

/**
 * In walkthrough_step phase the agent should NOT re-ask known slot values.
 *
 * Diagnostic signal — measures explicit slot-fishing in walkthrough.
 * A turn is flagged only when BOTH conditions hold:
 * 1. Agent text matches a direct slot pattern (direct quantity/duration question)
 * 2. The SAME pattern fires in a prior walkthrough_step turn (re-asking, not first-time exploration)
 *
 * First-time slot questions during walkthrough are normal exploratory behavior and are NOT penalized.
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
  const walkthroughTurns = turns.filter(t => t.phase === 'walkthrough_step')
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

const PHASE_ORDER: Phase[] = ['intro', 'process_loop', 'walkthrough_step', 'slot_completion', 'coverage_check', 'wrap_up']

/**
 * Measures how far the interview progressed through its phase lifecycle.
 * Replaces phaseAdherence as primary quality signal — phase_adherence=1.0 is trivially
 * achieved when stuck in slot_completion; phaseProgression catches this.
 *
 * 0.0  stayed in intro/process_loop only
 * 0.33 reached walkthrough_step
 * 0.5  reached slot_completion
 * 0.67 reached coverage_check
 * 0.83 reached wrap_up
 * 1.0  reached wrap_up AND interview completed
 */
export function scorePhaseProgression(turns: TurnRecord[], interviewCompleted: boolean): number {
  const phases = new Set(turns.map(t => t.phase))
  const steps = [
    phases.has('walkthrough_step'),
    phases.has('slot_completion'),
    phases.has('coverage_check'),
    phases.has('wrap_up'),
    phases.has('wrap_up') && interviewCompleted,
  ]
  const reached = steps.filter(Boolean).length
  return reached === 0 ? 0 : reached / steps.length
}
