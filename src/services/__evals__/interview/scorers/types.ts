import type { Phase, StepEntry } from '@/services/interviewSemantic'

export interface ToolCallRecord {
  toolName: string
  args: Record<string, unknown>
}

export interface TurnRecord {
  turnNumber: number
  userInput: string
  agentText: string
  phase: Phase
  toolCalls: ToolCallRecord[]
}

export interface ScoreSet {
  slotCoverage: number
  dedupSlotCoverage: number
  /** L9: slot_coverage at the moment clarification phase enters (before synthetic answers applied). */
  slotCoveragePreClarification: number
  /** L9: dedup_slot_coverage at the moment clarification phase enters (before synthetic answers applied). */
  dedupSlotCoveragePreClarification: number
  /** L9: delta = final − pre. Positive = clarification lifted coverage. 0 = no clarification ran. */
  clarificationCoverageDelta: number
  phaseAdherence: number
  phaseProgression: number
  anchoringViolations: number
  toolCallPlausibility: number
  dialogNaturalness: number
  completionCorrectness: boolean
  stepRegistrationCoverage: number
  /** PROJ-27/BL-E1.3: fraction of steps passing prozessschritt-schema validation (0–1) */
  schemaConformanceRate: number
  /** PROJ-28/BL-E2.1: fraction of filled slots whose evidence quote cannot be found in transcript. Target < 0.01 */
  hallucinationRate: number
  /** PROJ-28/BL-E2.2: fraction of estimate/unknown slots that received a follow-up re-ask within 3 turns. Target > 0.80 */
  confidenceTriggerRate: number
}

export interface ScorerInput {
  turns: TurnRecord[]
  finalStepTracker: StepEntry[]
  /** L9: tracker snapshot captured right before clarification phase ran.
   * If clarification did not run, set equal to finalStepTracker. */
  preClarificationStepTracker?: StepEntry[]
  interviewStatus: string
  evalModel: string
  expectedProcessCount?: number
}
