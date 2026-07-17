/**
 * Slot-Writer Priority Hierarchy (ADR-016, quick removed PROJ-44/ADR-021 D3)
 *
 * Two synchronous sub-passes (interviewAnalyst.ts's runAnalyst) can write the
 * same slot within one turn:
 *   analyst_catchup  — Backfill sub-pass, full-history scan (highest authority: wide context)
 *   analyst_online   — Online sub-pass, current-turn extraction (strong authority: fresh evidence)
 *   backfill         — deterministic data_sources heuristic (lowest: no LLM evidence)
 *   analyst          — legacy label, treated same as analyst_online
 *
 * Rule: lower-priority writes are blocked when the slot is already owned by a
 * higher-priority source. Same-priority writes are always allowed (idempotent
 * correction within the same path level).
 */

export type WriteSource = 'analyst_catchup' | 'analyst_online' | 'analyst' | 'backfill'

const PRIORITY: Record<WriteSource, number> = {
  analyst_catchup: 4,
  analyst_online: 3,
  analyst: 3,
  backfill: 1,
}

/**
 * Returns true when `newSource` may overwrite a slot currently owned by `existingSource`.
 * If existingSource is undefined (slot was empty), always returns true.
 */
export function canOverwrite(existingSource: WriteSource | string | undefined, newSource: WriteSource): boolean {
  if (!existingSource) return true
  const existing = PRIORITY[existingSource as WriteSource] ?? 0
  const incoming = PRIORITY[newSource] ?? 0
  return incoming >= existing
}
