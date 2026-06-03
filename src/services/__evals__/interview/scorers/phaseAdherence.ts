import type { TurnRecord } from './types'
import type { Phase } from '@/services/interviewAgent'

/**
 * In walkthrough_step phase the agent should NOT ask direct slot-fishing questions.
 * Returns fraction of walkthrough turns that are phase-conforming (no direct slot question).
 * Non-walkthrough phases are not penalized — they have different conformity rules.
 */
const DIRECT_SLOT_PATTERNS = [
  /wie viele[^?]*pro monat\?/i,
  /wie viele[^?]*\?/i,
  /wie lange dauert/i,
  /wie lang (?:dauert|ist)/i,
  /welche (?:systeme|tools|anwendungen|software|programme)/i,
  /welche (?:daten|quellen|unterlagen)/i,
  /gibt es (?:regeln|vorgaben|richtlinien|vorschriften)/i,
  /sind (?:es )?(?:feste )?(?:regeln|vorgaben|vorschriften)/i,
  /wie hoch ist die fehlerquote/i,
  /wie oft (?:machst|führst|bearbeitest|erledigst)/i,
  /wie häufig (?:machst|führst|passiert|kommt)/i,
  /durchschnittlich[^?]+(?:minuten|stunden|tage|mal|monat)\?/i,
  /(?:wie|wieviel) (?:zeit|aufwand)/i,
]

export function scorePhaseAdherence(turns: TurnRecord[]): number {
  const walkthroughTurns = turns.filter(t => t.phase === 'walkthrough_step')
  if (walkthroughTurns.length === 0) return 1.0

  let conforming = 0
  for (const turn of walkthroughTurns) {
    const hasDirectSlotQuestion = DIRECT_SLOT_PATTERNS.some(re => re.test(turn.agentText))
    if (!hasDirectSlotQuestion) conforming++
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
