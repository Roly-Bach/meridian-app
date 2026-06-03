import { MANDATORY_SLOTS } from '@/services/interviewAgent'
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

// Token Jaccard similarity (mirrors interviewAgent.ts — kept local to avoid cross-boundary import)
function tokenJaccard(a: string, b: string): number {
  const STOP = new Set(['und', 'oder', 'per', 'bei', 'im', 'von', 'mit', 'der', 'die', 'das'])
  const tokenize = (s: string) => new Set(
    s.toLowerCase().replace(/[-().,&/: ]/g, ' ').split(/\s+/).filter(t => t.length >= 4 && !STOP.has(t))
  )
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let intersection = 0
  for (const t of ta) if (tb.has(t)) intersection++
  return intersection / (ta.size + tb.size - intersection)
}

/**
 * De-fragmented slot coverage: groups semantically equivalent steps (Jaccard ≥ 0.4),
 * unions their slots, then computes coverage per group.
 * Resilient to step-name fragmentation (e.g. "Rechnungsprüfung und Verbuchung" and
 * "Rechnungsprüfung und -verbuchung" merge into one group).
 */
export function scoreDedupCoverage(stepTracker: StepEntry[]): number {
  if (stepTracker.length === 0) return 0

  // Greedy grouping: each step joins the first group it overlaps with (Jaccard ≥ 0.4)
  const groups: StepEntry[][] = []
  for (const step of stepTracker) {
    const idx = groups.findIndex(g =>
      g.some(s => tokenJaccard(s.title, step.title) >= 0.4)
    )
    if (idx >= 0) {
      groups[idx].push(step)
    } else {
      groups.push([step])
    }
  }

  // For each group, union filled slots across all members
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
