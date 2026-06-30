import { POTENZIAL_SLOT_NAMES, TAZITE_SLOT_NAMES } from '@/services/interviewSemantic'
import type { StepEntry } from '@/services/interviewSemantic'
import type { TurnRecord } from './types'

/**
 * PROJ-40 (Refokus KI-Potenzial / Coverage-Lücke): Konversations-Effizienz. Turn-Zahl skaliert
 * direkt mit Kosten und UX — ein Modell, das dieselben Daten in 18 statt 35 Turns erfasst, ist
 * besser und günstiger. Heute misst das keine Metrik (phaseAdherence erfasst nur Re-Ask-Schleifen).
 * Deterministisch, LLM-frei, aus TurnRecord[] + finalem Tracker. Kein Gate (Diskriminator,
 * kein Pass/Fail-Floor) — Versuchsplan-Zielgröße.
 */
export interface EfficiencyResult {
  /** Anzahl Turns bis Abschluss (Interview-Länge). Niedriger besser bei gleicher Ausbeute. */
  turnsToCompletion: number
  /** Gefüllte Slots (potenzial + tazite) im finalen Tracker. */
  filledSlots: number
  /** filledSlots / turnsToCompletion — Ausbeute pro Turn, maximize. */
  slotsPerTurn: number
}

function isFilled(sv: { value: unknown; nicht_befund_typ?: unknown } | null): boolean {
  if (sv == null) return false
  return sv.value != null || sv.nicht_befund_typ != null
}

export function scoreConversationalEfficiency(
  turns: TurnRecord[],
  finalStepTracker: StepEntry[],
): EfficiencyResult {
  const turnsToCompletion = turns.length

  let filledSlots = 0
  for (const step of finalStepTracker) {
    for (const slot of POTENZIAL_SLOT_NAMES) {
      if (isFilled(step.potenzial[slot])) filledSlots++
    }
    for (const slot of TAZITE_SLOT_NAMES) {
      if (isFilled(step.slots[slot])) filledSlots++
    }
  }

  const slotsPerTurn =
    turnsToCompletion === 0 ? 0 : Math.round((filledSlots / turnsToCompletion) * 100) / 100

  return { turnsToCompletion, filledSlots, slotsPerTurn }
}
