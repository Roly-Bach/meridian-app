/**
 * Persona loader, extracted from runner.ts (PROJ-40 Batch 1) so validation harnesses
 * (testerStability.ts) can import the persona map WITHOUT pulling in runner.ts — which
 * calls main() unconditionally at module load and would run a full eval on import.
 * Side-effect-free: only the lazy import map and a lookup helper live here.
 */
import type { Persona } from './types'

export const PERSONA_MAP: Record<string, () => Promise<Persona>> = {
  buchhalter: async () => (await import('./buchhalter')).buchhalter,
  vertriebler: async () => (await import('./vertriebler')).vertriebler,
  'it-support': async () => (await import('./it-support')).itSupport,
}

export const PERSONA_NAMES = Object.keys(PERSONA_MAP)

export async function loadPersona(name: string): Promise<Persona> {
  const loader = PERSONA_MAP[name]
  if (!loader) {
    throw new Error(`Unknown persona: ${name}. Available: ${PERSONA_NAMES.join(', ')}`)
  }
  return loader()
}
