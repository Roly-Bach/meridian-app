import { COVERAGE_FIELDS, groupSemanticSteps, isCoverageFieldFilled } from '@/services/interviewSemantic'
import type { StepEntry } from '@/services/interviewSemantic'

/**
 * O1–O6 Coverage: fraction of the 9 tazite/structural fields filled across all steps.
 * Formula: Σ filled_fields / (n_steps × 9)
 *
 * Note: potenzial-fields (frequency, duration, …) and governance are NOT counted here.
 * Coverage-Regression after PROJ-25: values drop systematically vs. the old 4-slot denominator
 * because O2–O5 start empty. This is correct and expected behavior — see CHANGELOG.
 */
export function scoreSlotCoverage(stepTracker: StepEntry[]): number {
  if (stepTracker.length === 0) return 0

  let filled = 0
  const total = stepTracker.length * COVERAGE_FIELDS.length

  for (const step of stepTracker) {
    for (const field of COVERAGE_FIELDS) {
      if (isCoverageFieldFilled(step, field)) filled++
    }
  }

  return total === 0 ? 0 : filled / total
}

/**
 * De-fragmented O1–O6 coverage using groupSemanticSteps (threshold=0.2, permissive).
 * Unions fields across semantically equivalent steps before computing coverage.
 */
export function scoreDedupCoverage(stepTracker: StepEntry[]): number {
  if (stepTracker.length === 0) return 0

  const groups = groupSemanticSteps(stepTracker, 0.2)

  let filled = 0
  for (const group of groups) {
    for (const field of COVERAGE_FIELDS) {
      if (group.some((s) => isCoverageFieldFilled(s, field))) filled++
    }
  }

  const total = groups.length * COVERAGE_FIELDS.length
  return total === 0 ? 0 : filled / total
}

/**
 * Governance coverage: fraction of governance sub-fields filled across all steps.
 * Reported separately — does NOT count toward O1–O6 coverage denominator.
 * A step's governance is filled if rolle/organisationseinheit/systeme is set OR nicht_befund_typ != null.
 */
export function scoreGovernanceCoverage(stepTracker: StepEntry[]): number {
  if (stepTracker.length === 0) return 0

  let filled = 0
  for (const step of stepTracker) {
    const g = step.governance
    if (g == null) continue
    if (
      g.rolle != null ||
      g.organisationseinheit != null ||
      (Array.isArray(g.systeme) && g.systeme.length > 0) ||
      g.nicht_befund_typ != null
    ) {
      filled++
    }
  }

  return filled / stepTracker.length
}
