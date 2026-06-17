export type { ScoreSet, TurnRecord, ToolCallRecord, ScorerInput } from './types'

import { scoreSlotCoverage, scoreDedupCoverage } from './slotCoverage'
import { scorePhaseAdherence, scorePhaseProgression } from './phaseAdherence'
import { scoreAnchoringViolations } from './anchoringViolations'
import { scoreToolCallPlausibility } from './toolCallPlausibility'
import { scoreDialogNaturalness } from './dialogNaturalness'
import { scoreCompletionCorrectness } from './completionCorrectness'
import { scoreStepRegistrationCoverage } from './stepRegistrationCoverage'
import { scoreSchemaConformanceRate } from './schemaConformanceRate'
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
  scoreSchemaConformanceRate,
}

export async function runAllScorers(input: ScorerInput): Promise<ScoreSet> {
  const [dialogNaturalness] = await Promise.all([
    scoreDialogNaturalness(input.turns, input.evalModel),
  ])

  const completionCorrectness = scoreCompletionCorrectness(input.interviewStatus)
  const slotCoverage = round2(scoreSlotCoverage(input.finalStepTracker))
  const dedupSlotCoverage = round2(scoreDedupCoverage(input.finalStepTracker))

  // L9: pre-clarification snapshot. Falls back to final tracker when clarification
  // did not run (delta then 0 — neither penalty nor credit to recovery path).
  const preTracker = input.preClarificationStepTracker ?? input.finalStepTracker
  const slotCoveragePreClarification = round2(scoreSlotCoverage(preTracker))
  const dedupSlotCoveragePreClarification = round2(scoreDedupCoverage(preTracker))

  return {
    slotCoverage,
    dedupSlotCoverage,
    slotCoveragePreClarification,
    dedupSlotCoveragePreClarification,
    clarificationCoverageDelta: round2(dedupSlotCoverage - dedupSlotCoveragePreClarification),
    phaseAdherence: round2(scorePhaseAdherence(input.turns)),
    phaseProgression: round2(scorePhaseProgression(input.turns, completionCorrectness)),
    anchoringViolations: scoreAnchoringViolations(input.turns),
    toolCallPlausibility: round2(scoreToolCallPlausibility(input.turns)),
    dialogNaturalness,
    completionCorrectness,
    stepRegistrationCoverage: round2(scoreStepRegistrationCoverage(input.finalStepTracker, input.expectedProcessCount)),
    schemaConformanceRate: round2(scoreSchemaConformanceRate(input.finalStepTracker)),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
