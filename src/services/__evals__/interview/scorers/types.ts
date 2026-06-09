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
