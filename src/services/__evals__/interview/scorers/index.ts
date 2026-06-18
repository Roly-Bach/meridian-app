export type { ScoreSet, TurnRecord, ToolCallRecord, ScorerInput } from './types'
export type { SlotDepthResult } from './slotDepth'

import { scoreSlotCoverage, scoreDedupCoverage } from './slotCoverage'
import { scorePhaseAdherence, scorePhaseProgression } from './phaseAdherence'
import { scoreAnchoringViolations } from './anchoringViolations'
import { scoreToolCallPlausibility } from './toolCallPlausibility'
import { scoreDialogNaturalness } from './dialogNaturalness'
import { scoreCompletionCorrectness } from './completionCorrectness'
import { scoreStepRegistrationCoverage } from './stepRegistrationCoverage'
import { scoreSchemaConformanceRate } from './schemaConformanceRate'
import { scoreHallucinationRate } from './hallucinationRate'
import { scoreConfidenceTrigger } from './confidenceTrigger'
import { scoreSlotDepth } from './slotDepth'
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
  scoreHallucinationRate,
  scoreConfidenceTrigger,
  scoreSlotDepth,
}

export async function runAllScorers(input: ScorerInput, isolatedCriteria = false): Promise<ScoreSet> {
  const [dialogNaturalnessResult, slotDepthResult] = await Promise.all([
    scoreDialogNaturalness(input.turns, input.evalModel, isolatedCriteria),
    scoreSlotDepth(input.finalStepTracker, input.turns, input.evalModel),
  ])

  const completionCorrectness = scoreCompletionCorrectness(input.interviewStatus)
  const slotCoverage = round2(scoreSlotCoverage(input.finalStepTracker))
  const dedupSlotCoverage = round2(scoreDedupCoverage(input.finalStepTracker))

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
    dialogNaturalness: dialogNaturalnessResult.score,
    dialogNaturalnessRationale: dialogNaturalnessResult.rationale || undefined,
    completionCorrectness,
    stepRegistrationCoverage: round2(scoreStepRegistrationCoverage(input.finalStepTracker, input.expectedProcessCount)),
    schemaConformanceRate: round2(scoreSchemaConformanceRate(input.finalStepTracker)),
    hallucinationRate: round2(scoreHallucinationRate(input.turns, input.finalStepTracker)),
    confidenceTriggerRate: round2(scoreConfidenceTrigger(input.turns)),
    depth_score: slotDepthResult.depth_score,
    depth_distribution: slotDepthResult.depth_distribution,
    slotDepthRationale: slotDepthResult.rationale || undefined,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
