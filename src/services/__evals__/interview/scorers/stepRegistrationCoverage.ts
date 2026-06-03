import { tokenJaccard, colonParent } from '@/services/interviewAgent'
import type { StepEntry } from '@/services/interviewAgent'

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

  const groups: StepEntry[][] = []
  for (const step of stepTracker) {
    const parent = colonParent(step.title)
    let idx = -1
    if (parent !== null) {
      idx = groups.findIndex(g => g.some(s => colonParent(s.title) === parent))
    }
    if (idx < 0) {
      idx = groups.findIndex(g => g.some(s => tokenJaccard(s.title, step.title) >= 0.4))
    }
    if (idx >= 0) groups[idx].push(step)
    else groups.push([step])
  }

  return Math.min(groups.length / expectedProcessCount, 1.0)
}
