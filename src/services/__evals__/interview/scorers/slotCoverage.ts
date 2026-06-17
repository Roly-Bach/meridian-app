import { COVERAGE_FIELDS, groupSemanticSteps } from '@/services/interviewSemantic'
import type { StepEntry } from '@/services/interviewSemantic'

/**
 * Returns true if an O1–O6 coverage field is considered "filled" for a step.
 * A field is filled when its value is non-null OR a nicht_befund_typ is set.
 */
function isCoverageFieldFilled(step: StepEntry, field: (typeof COVERAGE_FIELDS)[number]): boolean {
  switch (field) {
    case 'bezeichnung':
      // O1 — title always present (non-empty string = filled)
      return typeof step.title === 'string' && step.title.trim().length > 0
    case 'reihenfolge':
      // O1 — integer set by register_step; always filled for PROJ-25+ entries
      return typeof step.reihenfolge === 'number'
    case 'abhaengigkeiten': {
      const dep = step.abhaengigkeiten
      if (dep == null) return false
      return (
        (Array.isArray(dep.depends_on) && dep.depends_on.length > 0) ||
        (Array.isArray(dep.influences) && dep.influences.length > 0) ||
        dep.nicht_befund_typ != null
      )
    }
    default: {
      // O2–O5 tazite slots — field name matches slots key directly
      const slot = step.slots[field as keyof typeof step.slots]
      if (slot == null) return false
      return slot.value != null || slot.nicht_befund_typ != null
    }
  }
}

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
