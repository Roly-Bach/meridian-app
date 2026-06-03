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
  interviewStatus: string
  evalModel: string
  expectedProcessCount?: number
}
