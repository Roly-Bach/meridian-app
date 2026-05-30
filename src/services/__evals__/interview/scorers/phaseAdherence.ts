import type { TurnRecord } from './types'

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
