/**
 * Pure semantic utilities for interview step handling.
 *
 * Extracted from interviewAgent.ts so off-Next.js consumers (eval replay,
 * backfill scripts, CI workflows) can import these without dragging the
 * server-only Supabase admin chain through `import 'server-only'`.
 *
 * Everything here must remain side-effect-free and free of runtime imports
 * that touch Supabase, the AI SDK, or Next.js server modules.
 */

export type Phase =
  | 'intro'
  | 'process_loop'
  | 'walkthrough_step'
  | 'slot_completion'
  | 'coverage_check'
  | 'wrap_up'
  | 'clarification'

export interface SlotValue {
  value: string | number | boolean | string[]
  quote: string
  confidence?: 'confirmed' | 'estimate' | 'unknown'
  qualifier?: string | null
}

export interface StepEntry {
  title: string
  role?: string | null
  status: 'exploring' | 'walkthrough' | 'done'
  slots: {
    frequency_per_month: SlotValue | null
    duration_minutes: SlotValue | null
    rule_based: SlotValue | null
    data_sources: SlotValue | null
    error_rate_percent: SlotValue | null
    media_breaks: SlotValue | null
  }
  process_steps?: string[]
  friction_points?: string[]
  friction_tools?: string[]
  pain_point_primary?: string | null
}

export const MANDATORY_SLOTS = [
  'frequency_per_month',
  'duration_minutes',
  'rule_based',
  'data_sources',
] as const

export const OPTIONAL_SLOTS = ['error_rate_percent', 'media_breaks'] as const

export type SlotName = (typeof MANDATORY_SLOTS)[number] | (typeof OPTIONAL_SLOTS)[number]

const STEP_STOPWORDS = new Set(['und', 'oder', 'per', 'bei', 'im', 'von', 'mit', 'der', 'die', 'das'])

export function normalizeToken(t: string): string {
  return t
    .replace(/(prozess|wesen|ablauf|vorgang|schritt|bearbeitung|handling|verwaltung|management)$/i, '')
    .trim()
}

export function colonParent(title: string): string | null {
  const idx = title.indexOf(':')
  return idx > 2 ? title.slice(0, idx).trim().toLowerCase() : null
}

export function tokenJaccard(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[-().,&/: ]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 4 && !STEP_STOPWORDS.has(t)),
    )
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let intersection = 0
  for (const t of ta) if (tb.has(t)) intersection++
  return intersection / (ta.size + tb.size - intersection)
}

function normalizedTokenSet(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[-().,&/: ]/g, ' ')
      .split(/\s+/)
      .map((t) => normalizeToken(t))
      .filter((t) => t.length >= 4 && !STEP_STOPWORDS.has(t)),
  )
}

export function tokenJaccardNorm(a: string, b: string): number {
  const ta = normalizedTokenSet(a)
  const tb = normalizedTokenSet(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let intersection = 0
  for (const t of ta) if (tb.has(t)) intersection++
  return intersection / (ta.size + tb.size - intersection)
}

/**
 * Groups semantically equivalent steps into clusters.
 *
 * Matching priority:
 *   1. Shared colon-parent ("Foo: a" and "Foo: b" → same group)
 *   2. tokenJaccardNorm ≥ threshold
 */
export function groupSemanticSteps(tracker: StepEntry[], threshold = 0.4): StepEntry[][] {
  const groups: StepEntry[][] = []
  for (const step of tracker) {
    const parent = colonParent(step.title)
    let idx = -1
    if (parent !== null) {
      idx = groups.findIndex((g) => g.some((s) => colonParent(s.title) === parent))
    }
    if (idx < 0) {
      idx = groups.findIndex((g) => g.some((s) => tokenJaccardNorm(s.title, step.title) >= threshold))
    }
    if (idx >= 0) groups[idx].push(step)
    else groups.push([step])
  }
  return groups
}
