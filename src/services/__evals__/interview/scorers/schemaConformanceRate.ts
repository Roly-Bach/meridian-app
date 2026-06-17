import Ajv from 'ajv'
import schemaJson from '@/schemas/prozessschritt-schema.json'
import { toGrenzobjekt } from '@/services/interviewSemantic'
import type { StepEntry } from '@/services/interviewSemantic'

const ajv = new Ajv({ allErrors: true })
const validateSchritt = ajv.compile({
  $schema: 'http://json-schema.org/draft-07/schema#',
  ...schemaJson.definitions.Schritt,
  definitions: schemaJson.definitions,
})

/**
 * Fraction of steps in the final tracker that pass prozessschritt-schema validation.
 * Returns 1.0 when tracker is empty (nothing to fail).
 * BL-E1.3 / REQ-003
 */
export function scoreSchemaConformanceRate(steps: StepEntry[]): number {
  if (steps.length === 0) return 1.0
  let valid = 0
  for (let i = 0; i < steps.length; i++) {
    const schritt = toGrenzobjekt(steps[i], i + 1)
    if (validateSchritt(schritt)) valid++
  }
  return valid / steps.length
}
