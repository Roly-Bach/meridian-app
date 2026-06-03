import { MANDATORY_SLOTS, groupSemanticSteps } from '@/services/interviewAgent'
import type { StepEntry } from '@/services/interviewAgent'

/**
 * Fraction of mandatory slots filled across all registered process steps.
 * Formula: filled_mandatory / (n_steps × 4)
 * NOTE: inflated step counts from fragmentation deflate this metric artificially.
 * Use scoreDedupCoverage for a fragmentation-resilient signal.
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

/**
 * De-fragmented slot coverage using groupSemanticSteps (threshold=0.2, permissive).
 * Unions slots across semantically equivalent steps before computing coverage.
 * Threshold 0.2 catches cross-context fragmentation (e.g. "Debitorenbuchhaltung: Mahnprozess"
 * grouped with "Mahnwesen: Bearbeitung" via shared normalized root "mahn").
 */
export function scoreDedupCoverage(stepTracker: StepEntry[]): number {
  if (stepTracker.length === 0) return 0

  const groups = groupSemanticSteps(stepTracker, 0.2)

  let filled = 0
  for (const group of groups) {
    for (const slot of MANDATORY_SLOTS) {
      if (group.some(s => s.slots[slot] !== null && s.slots[slot] !== undefined)) {
        filled++
      }
    }
  }

  const total = groups.length * MANDATORY_SLOTS.length
  return total === 0 ? 0 : filled / total
}
