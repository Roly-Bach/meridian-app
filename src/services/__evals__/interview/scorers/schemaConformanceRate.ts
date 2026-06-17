import { checkSchritt } from '@/services/schemaValidator'
import type { StepEntry } from '@/services/interviewSemantic'

/**
 * Fraction of steps in the final tracker that pass prozessschritt-schema validation.
 * Returns 1.0 when tracker is empty (nothing to fail).
 * BL-E1.3 / REQ-003
 */
export function scoreSchemaConformanceRate(steps: StepEntry[]): number {
  if (steps.length === 0) return 1.0
  let valid = 0
  for (let i = 0; i < steps.length; i++) {
    if (checkSchritt(steps[i], i + 1).valid) valid++
  }
  return valid / steps.length
}
