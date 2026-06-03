import { groupSemanticSteps } from '@/services/interviewSemantic'
import type { StepEntry } from '@/services/interviewSemantic'

/**
 * Measures whether the expected number of distinct main processes were registered.
 * Score = min(registeredGroups / expectedProcessCount, 1.0)
 * Returns 1.0 if expectedProcessCount is undefined/0.
 */
export function scoreStepRegistrationCoverage(
  stepTracker: StepEntry[],
  expectedProcessCount: number | undefined,
): number {
  if (!expectedProcessCount || expectedProcessCount === 0) return 1.0
  if (stepTracker.length === 0) return 0

  const groups = groupSemanticSteps(stepTracker) // default threshold 0.4
  return Math.min(groups.length / expectedProcessCount, 1.0)
}
