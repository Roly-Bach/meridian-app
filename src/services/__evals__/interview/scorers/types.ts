import type { Phase, StepEntry } from '@/services/interviewAgent'

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
  phaseAdherence: number
  anchoringViolations: number
  toolCallPlausibility: number
  dialogNaturalness: number
  completionCorrectness: boolean
}

export interface ScorerInput {
  turns: TurnRecord[]
  finalStepTracker: StepEntry[]
  interviewStatus: string
  evalModel: string
}
