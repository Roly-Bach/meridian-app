export type { ScoreSet, TurnRecord, ToolCallRecord, ScorerInput } from './types'

import { scoreSlotCoverage } from './slotCoverage'
import { scorePhaseAdherence } from './phaseAdherence'
import { scoreAnchoringViolations } from './anchoringViolations'
import { scoreToolCallPlausibility } from './toolCallPlausibility'
import { scoreDialogNaturalness } from './dialogNaturalness'
import { scoreCompletionCorrectness } from './completionCorrectness'
import type { ScorerInput, ScoreSet } from './types'

export {
  scoreSlotCoverage,
  scorePhaseAdherence,
  scoreAnchoringViolations,
  scoreToolCallPlausibility,
  scoreDialogNaturalness,
  scoreCompletionCorrectness,
}

export async function runAllScorers(input: ScorerInput): Promise<ScoreSet> {
  const [dialogNaturalness] = await Promise.all([
    scoreDialogNaturalness(input.turns, input.evalModel),
  ])

  return {
    slotCoverage: round2(scoreSlotCoverage(input.finalStepTracker)),
    phaseAdherence: round2(scorePhaseAdherence(input.turns)),
    anchoringViolations: scoreAnchoringViolations(input.turns),
    toolCallPlausibility: round2(scoreToolCallPlausibility(input.turns)),
    dialogNaturalness,
    completionCorrectness: scoreCompletionCorrectness(input.interviewStatus),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
