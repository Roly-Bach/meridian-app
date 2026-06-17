/**
 * Shared AJV validator for Schritt objects (prozessschritt-schema.json).
 * Used by production code (interviewAgent) and eval scorers — single source of truth.
 * BL-E1.3 / REQ-003
 */
import Ajv from 'ajv'
import schemaJson from '@/schemas/prozessschritt-schema.json'
import { toGrenzobjekt } from '@/services/interviewSemantic'
import type { StepEntry } from '@/services/interviewSemantic'

const ajv = new Ajv({ allErrors: true })
const _validateSchritt = ajv.compile({
  $schema: 'http://json-schema.org/draft-07/schema#',
  ...schemaJson.definitions.Schritt,
  definitions: schemaJson.definitions,
})

export function checkSchritt(step: StepEntry, fallbackIndex: number): { valid: boolean; errors: unknown[] | null } {
  const schritt = toGrenzobjekt(step, fallbackIndex)
  const valid = _validateSchritt(schritt) as boolean
  return { valid, errors: valid ? null : (_validateSchritt.errors ?? null) }
}
