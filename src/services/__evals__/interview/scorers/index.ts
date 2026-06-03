export type { ScoreSet, TurnRecord, ToolCallRecord, ScorerInput } from './types'

import { scoreSlotCoverage, scoreDedupCoverage } from './slotCoverage'
import { scorePhaseAdherence, scorePhaseProgression } from './phaseAdherence'
import { scoreAnchoringViolations } from './anchoringViolations'
import { scoreToolCallPlausibility } from './toolCallPlausibility'
import { scoreDialogNaturalness } from './dialogNaturalness'
import { scoreCompletionCorrectness } from './completionCorrectness'
import { scoreStepRegistrationCoverage } from './stepRegistrationCoverage'
import type { ScorerInput, ScoreSet } from './types'

export {
  scoreSlotCoverage,
  scoreDedupCoverage,
  scorePhaseAdherence,
  scorePhaseProgression,
  scoreAnchoringViolations,
  scoreToolCallPlausibility,
  scoreDialogNaturalness,
  scoreCompletionCorrectness,
  scoreStepRegistrationCoverage,
}

export async function runAllScorers(input: ScorerInput): Promise<ScoreSet> {
  const [dialogNaturalness] = await Promise.all([
    scoreDialogNaturalness(input.turns, input.evalModel),
  ])

  const completionCorrectness = scoreCompletionCorrectness(input.interviewStatus)
  return {
    slotCoverage: round2(scoreSlotCoverage(input.finalStepTracker)),
    dedupSlotCoverage: round2(scoreDedupCoverage(input.finalStepTracker)),
    phaseAdherence: round2(scorePhaseAdherence(input.turns)),
    phaseProgression: round2(scorePhaseProgression(input.turns, completionCorrectness)),
    anchoringViolations: scoreAnchoringViolations(input.turns),
    toolCallPlausibility: round2(scoreToolCallPlausibility(input.turns)),
    dialogNaturalness,
    completionCorrectness,
    stepRegistrationCoverage: round2(scoreStepRegistrationCoverage(input.finalStepTracker, input.expectedProcessCount)),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
