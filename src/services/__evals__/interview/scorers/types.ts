import type { Phase, StepEntry } from '@/services/interviewSemantic'

/**
 * Convention (2026-06-24 eval-system audit, KI-9 follow-up): every LLM-judge-based
 * scorer (dialogNaturalness, slotDepth, talkerFactualGrounding, ...) must have a
 * unit test that asserts on the *constructed prompt content* sent to the judge,
 * not just on the parsed return value of a mocked response. Mocking generateText's
 * return value alone proves the parser works — it cannot catch a bug in how the
 * prompt itself is built (e.g. KI-9's transcript-ordering bug, which 8 mock-only
 * tests missed entirely and only a live run caught). Capture the mock's call args
 * (`vi.mocked(generateText).mock.calls[0][0].prompt`) and assert structural
 * invariants on it.
 */

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
  /** 2026-06-24 audit: anchoringViolations normalized by turn count — the raw count
   * alone isn't comparable across interviews of different lengths. */
  anchoringViolationRate: number
  toolCallPlausibility: number
  dialogNaturalness: number
  completionCorrectness: boolean
  stepRegistrationCoverage: number
  /** PROJ-27/BL-E1.3: fraction of steps passing prozessschritt-schema validation (0–1) */
  schemaConformanceRate: number
  /** PROJ-28/BL-E2.1: fraction of filled slots whose evidence quote cannot be found in transcript. Target < 0.01 */
  hallucinationRate: number
  /** PROJ-28/BL-E2.2: fraction of estimate/unknown slots that received a follow-up re-ask within 3 turns.
   * Target > 0.80. null = no estimate/unknown slots this interview (no signal, NOT a perfect score —
   * 2026-06-24 audit: treating "no unknowns" as 1.0 caused 0↔1 swings that looked like instability). */
  confidenceTriggerRate: number | null
  /** KI-9: count of Talker turns asserting a false premise about prior persona statements. Target 0. */
  talkerGroundingViolations: number
  depth_score: number | null
  depth_distribution: { p1: number; p2: number; p3: number } | null
  /** BL-E5.2: CoT rationale from the dialogNaturalness judge (optional) */
  dialogNaturalnessRationale?: string
  /** BL-E5.2: CoT rationale from the slotDepth judge (optional) */
  slotDepthRationale?: string
  /** KI-9: CoT rationale from the talkerFactualGrounding judge (optional) */
  talkerGroundingRationale?: string
}

export interface TokenUsageRecord {
  component: 'analyst' | 'analyst_online' | 'analyst_catchup' | 'talker' | 'quick_extract' | 'grounding_guard' | 'tester' | 'judge_dialog_naturalness' | 'judge_slot_depth' | 'judge_talker_grounding'
  model: string
  inputTokens: number
  cacheReadTokens?: number
  outputTokens: number
}

export interface ComponentCostSummary {
  calls: number
  inputTokens: number
  cacheReadTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

export interface CostSummary {
  interviewEngine: Record<string, ComponentCostSummary>
  /** PROJ-40 B: the persona simulator (`tester` component) gets its own bucket — a
   * cheap interview model's savings shouldn't be hidden inside a fixed test/eval overhead. */
  testEngine: Record<string, ComponentCostSummary>
  evalEngine: Record<string, ComponentCostSummary>
  totalInputTokens: number
  totalCacheReadTokens: number
  totalOutputTokens: number
  totalEstimatedCostUsd: number
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
  onTokenUsage?: (r: TokenUsageRecord) => void
}
