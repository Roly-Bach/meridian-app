import { MANDATORY_SLOTS } from '@/services/interviewAgent'
import type { StepEntry } from '@/services/interviewAgent'

/**
 * Fraction of mandatory slots filled across all registered process steps.
 * Formula: filled_mandatory / (n_steps × 4)
 */
export function scoreSlotCoverage(stepTracker: StepEntry[]): number {
  if (stepTracker.length === 0) return 0

  let filled = 0
  const total = stepTracker.length * MANDATORY_SLOTS.length

  for (const step of stepTracker) {
    for (const slot of MANDATORY_SLOTS) {
      if (step.slots[slot] !== null && step.slots[slot] !== undefined) {
        filled++
      }
    }
  }

  return total === 0 ? 0 : filled / total
}
