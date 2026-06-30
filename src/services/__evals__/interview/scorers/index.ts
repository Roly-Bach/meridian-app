export type { ScoreSet, TurnRecord, ToolCallRecord, ScorerInput, TokenUsageRecord, CostSummary, ComponentCostSummary } from './types'
export type { SlotDepthResult } from './slotDepth'

import { scoreSlotCoverage, scoreDedupCoverage } from './slotCoverage'
import { scorePhaseAdherence, scorePhaseProgression } from './phaseAdherence'
import { scoreAnchoringViolations, scoreAnchoringViolationRate } from './anchoringViolations'
import { scoreToolCallPlausibility } from './toolCallPlausibility'
import { scoreDialogNaturalness } from './dialogNaturalness'
import { scoreCompletionCorrectness } from './completionCorrectness'
import { scoreStepRegistrationCoverage } from './stepRegistrationCoverage'
import { scoreSchemaConformanceRate } from './schemaConformanceRate'
import { scoreHallucinationRate } from './hallucinationRate'
import { scoreConfidenceTrigger } from './confidenceTrigger'
import { scoreSlotDepth } from './slotDepth'
import { scoreTalkerFactualGrounding } from './talkerFactualGrounding'
import { scorePotenzialCoverage, scoreDedupPotenzialCoverage } from './potenzialCoverage'
import { scoreDependencyCapture } from './dependencyCapture'
import { scoreConversationalEfficiency } from './conversationalEfficiency'
import { estimateTokenCost, computeCostSummary, MODEL_PRICING } from './costSummary'
import type { ScorerInput, ScoreSet } from './types'

export {
  scoreSlotCoverage,
  scoreDedupCoverage,
  scorePhaseAdherence,
  scorePhaseProgression,
  scoreAnchoringViolations,
  scoreAnchoringViolationRate,
  scoreToolCallPlausibility,
  scoreDialogNaturalness,
  scoreCompletionCorrectness,
  scoreStepRegistrationCoverage,
  scoreSchemaConformanceRate,
  scoreHallucinationRate,
  scoreConfidenceTrigger,
  scoreSlotDepth,
  scoreTalkerFactualGrounding,
  scorePotenzialCoverage,
  scoreDedupPotenzialCoverage,
  scoreDependencyCapture,
  scoreConversationalEfficiency,
  estimateTokenCost,
  computeCostSummary,
  MODEL_PRICING,
}

export async function runAllScorers(input: ScorerInput, isolatedCriteria = false): Promise<ScoreSet> {
  const [dialogNaturalnessResult, slotDepthResult, groundingResult] = await Promise.all([
    scoreDialogNaturalness(input.turns, input.evalModel, isolatedCriteria, input.onTokenUsage),
    scoreSlotDepth(input.finalStepTracker, input.turns, input.evalModel, input.onTokenUsage),
    scoreTalkerFactualGrounding(input.turns, input.evalModel, input.onTokenUsage),
  ])

  const completionCorrectness = scoreCompletionCorrectness(input.interviewStatus)
  const slotCoverage = round2(scoreSlotCoverage(input.finalStepTracker))
  const dedupSlotCoverage = round2(scoreDedupCoverage(input.finalStepTracker))

  const preTracker = input.preClarificationStepTracker ?? input.finalStepTracker
  const slotCoveragePreClarification = round2(scoreSlotCoverage(preTracker))
  const dedupSlotCoveragePreClarification = round2(scoreDedupCoverage(preTracker))

  const efficiency = scoreConversationalEfficiency(input.turns, input.finalStepTracker)

  return {
    slotCoverage,
    dedupSlotCoverage,
    slotCoveragePreClarification,
    dedupSlotCoveragePreClarification,
    clarificationCoverageDelta: round2(dedupSlotCoverage - dedupSlotCoveragePreClarification),
    potenzialCoverage: round2(scorePotenzialCoverage(input.finalStepTracker)),
    dedupPotenzialCoverage: round2(scoreDedupPotenzialCoverage(input.finalStepTracker)),
    dependencyCapture: round2(scoreDependencyCapture(input.finalStepTracker)),
    slotsPerTurn: efficiency.slotsPerTurn,
    turnsToCompletion: efficiency.turnsToCompletion,
    phaseAdherence: round2(scorePhaseAdherence(input.turns)),
    phaseProgression: round2(scorePhaseProgression(input.turns, completionCorrectness)),
    anchoringViolations: scoreAnchoringViolations(input.turns),
    anchoringViolationRate: round2(scoreAnchoringViolationRate(input.turns)),
    toolCallPlausibility: round2(scoreToolCallPlausibility(input.turns)),
    dialogNaturalness: dialogNaturalnessResult.score,
    dialogNaturalnessRationale: dialogNaturalnessResult.rationale || undefined,
    completionCorrectness,
    stepRegistrationCoverage: round2(scoreStepRegistrationCoverage(input.finalStepTracker, input.expectedProcessCount)),
    schemaConformanceRate: round2(scoreSchemaConformanceRate(input.finalStepTracker)),
    hallucinationRate: round2(scoreHallucinationRate(input.turns, input.finalStepTracker)),
    confidenceTriggerRate: round2OrNull(scoreConfidenceTrigger(input.turns)),
    depth_score: slotDepthResult.depth_score,
    depth_distribution: slotDepthResult.depth_distribution,
    slotDepthRationale: slotDepthResult.rationale || undefined,
    talkerGroundingViolations: groundingResult.violations,
    talkerGroundingRationale: groundingResult.rationale || undefined,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round2OrNull(n: number | null): number | null {
  return n === null ? null : round2(n)
}
