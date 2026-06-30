import { POTENZIAL_SLOT_NAMES, groupSemanticSteps } from '@/services/interviewSemantic'
import type { StepEntry, PotenzialSlotName } from '@/services/interviewSemantic'

/**
 * PROJ-40 (Refokus KI-Potenzial): Coverage der quantitativen Potenzial-Facetten
 * (frequency_per_month, duration_minutes, error_rate_percent, media_breaks) — die
 * eigentlichen ROI-/Automatisierbarkeits-Eingänge. slotCoverage zählt diese bewusst NICHT
 * (nur die taziten/strukturellen O1–O6-Felder), weshalb das alte Gate das KI-Potenzial-Signal
 * nicht maß. Diese Metrik schließt die Lücke.
 *
 * Ein Potenzial-Slot gilt als gefüllt, wenn sein Wert non-null ist ODER ein nicht_befund_typ
 * gesetzt wurde (deckungsgleich mit slotCoverage.isCoverageFieldFilled).
 */
function isPotenzialFilled(step: StepEntry, slot: PotenzialSlotName): boolean {
  const sv = step.potenzial[slot]
  if (sv == null) return false
  return sv.value != null || sv.nicht_befund_typ != null
}

/** Raw: Σ gefüllte Potenzial-Slots / (n_steps × 4). */
export function scorePotenzialCoverage(stepTracker: StepEntry[]): number {
  if (stepTracker.length === 0) return 0
  let filled = 0
  const total = stepTracker.length * POTENZIAL_SLOT_NAMES.length
  for (const step of stepTracker) {
    for (const slot of POTENZIAL_SLOT_NAMES) {
      if (isPotenzialFilled(step, slot)) filled++
    }
  }
  return total === 0 ? 0 : filled / total
}

/** De-fragmentiert (groupSemanticSteps, threshold 0.2) — analog dedupSlotCoverage, die gate-relevante Form. */
export function scoreDedupPotenzialCoverage(stepTracker: StepEntry[]): number {
  if (stepTracker.length === 0) return 0
  const groups = groupSemanticSteps(stepTracker, 0.2)
  let filled = 0
  for (const group of groups) {
    for (const slot of POTENZIAL_SLOT_NAMES) {
      if (group.some(s => isPotenzialFilled(s, slot))) filled++
    }
  }
  const total = groups.length * POTENZIAL_SLOT_NAMES.length
  return total === 0 ? 0 : filled / total
}
