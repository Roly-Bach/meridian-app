import type { TurnRecord, ScoreSet } from '../scorers/types'
import type { StepEntry } from '@/services/interviewSemantic'

export interface TranscriptFixture {
  evalRunId: string
  interviewId: string
  model: string
  persona: string
  status: string
  turns: TurnRecord[]
  finalStepTracker: StepEntry[]
  /** Expected number of distinct main processes — feeds scoreStepRegistrationCoverage */
  expectedProcessCount?: number
  /** Scores at time of fixture creation — used as initial baseline */
  scores?: Partial<ScoreSet>
  generatedAt?: string
  /** Source MD path if applicable */
  sourceMd?: string
}

export interface BaselineFile {
  evalRunId: string
  scores: ScoreSet
  updatedAt: string
}

export interface ReplayResult {
  fixtureId: string
  evalRunId: string
  persona: string
  model: string
  scores: Partial<ScoreSet>
  baseline: ScoreSet | null
  passed: boolean
  diffs: Array<{ metric: string; actual: number | boolean; baseline: number | boolean; delta: number | string }>
}
