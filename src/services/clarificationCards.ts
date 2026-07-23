/**
 * PROJ-43 (AC3/AC4/AC5): deterministic Clarification-Card mechanism for the
 * three gate-critical numeric slots (frequency/duration/error_rate_percent).
 *
 * Replaces the pre-PROJ-43 LLM-driven generation for exactly these three slot
 * types (M-4: LLM-only generation fired in 0/4 test runs) with a pure,
 * code-owned scan + fixed question text + direction-tailored buckets — see
 * PROJ-43 Tech Design Section D.3 for the KI-18-precedent rationale (prompt-only
 * reliability fixes have repeatedly failed in this codebase; the actual gap
 * check is a yes/no data question, not a judgment call).
 *
 * Pure, side-effect-free: no LLM calls, no DB access — called once at the
 * single decision point where an interview would otherwise complete
 * (interviewOrchestrator.ts's resolveTurnLifecycle).
 */

import { MANDATORY_NUMERIC_SLOTS, type MandatoryNumericSlot, type StepEntry } from './interviewSemantic'
import type { ClarificationCard } from './interviewTypes'

const MAX_CLARIFICATION_CARDS = 8

const QUESTION_TEXT: Record<MandatoryNumericSlot, string> = {
  frequency: 'Wie oft kommt dieser Schritt vor?',
  duration: 'Wie lange dauert eine einzelne Durchführung?',
  error_rate_percent: 'Wie häufig treten dabei Fehler oder Korrekturen auf?',
}

export interface MandatoryNumericGap {
  step: StepEntry
  slot: MandatoryNumericSlot
}

function isMandatoryNumericSlotEmpty(step: StepEntry, slot: MandatoryNumericSlot): boolean {
  const sv = step.potenzial[slot]
  return sv == null || (sv.value == null && sv.nicht_befund_typ == null)
}

/**
 * AC4's entire completion gate: every registered step, scanned fresh against
 * the CURRENT tracker (never a stored history) — so late-discovered steps are
 * automatically covered (AC4 edge case) and a step resolved via an earlier
 * Card round (value or nicht_befund_typ set) never reappears.
 */
export function computeMandatoryNumericGaps(tracker: StepEntry[]): MandatoryNumericGap[] {
  const gaps: MandatoryNumericGap[] = []
  for (const step of tracker) {
    for (const slot of MANDATORY_NUMERIC_SLOTS) {
      if (isMandatoryNumericSlotEmpty(step, slot)) gaps.push({ step, slot })
    }
  }
  return gaps
}

/** AC4 priority: a captured "hoch" direction sorts first, "niedrig" next, no signal last. */
function directionRank(gap: MandatoryNumericGap): number {
  const richtung = gap.step.potenzial[gap.slot]?.richtung
  if (richtung === 'hoch') return 0
  if (richtung === 'niedrig') return 1
  return 2
}

/** Deterministically builds one SlotCard per numeric gap — fixed question text, no LLM. */
export function buildDeterministicSlotCards(tracker: StepEntry[]): ClarificationCard[] {
  const gaps = computeMandatoryNumericGaps(tracker)
  const sorted = [...gaps].sort((a, b) => directionRank(a) - directionRank(b))
  return sorted.map(({ step, slot }) => ({
    process_step_id: step.id ?? step.title,
    step_title: step.title,
    question: QUESTION_TEXT[slot],
    options: [],
    slot_key: slot,
    answer_type: 'single' as const,
    direction: step.potenzial[slot]?.richtung ?? null,
  }))
}

const MANDATORY_NUMERIC_SLOT_SET: ReadonlySet<string> = new Set(MANDATORY_NUMERIC_SLOTS)

/**
 * AC4/D6: the turn's final Card list — deterministic numeric gaps always go
 * first (gate-blocking, sorted by direction), the LLM-suggested cards
 * (entscheidungslogik/open_item/qualitative — PROJ-47 territory, unchanged
 * this round) fill the remaining slots in their own order, capped at 8. Any
 * stray numeric-slot card the LLM still proposes is dropped — these three
 * slots are exclusively code-owned now (Tech Design D.3/D.5).
 */
export function computeClarificationCards(
  tracker: StepEntry[],
  llmCards: ClarificationCard[] | undefined,
): ClarificationCard[] {
  const numericCards = buildDeterministicSlotCards(tracker)
  const otherCards = (llmCards ?? []).filter((c) => !MANDATORY_NUMERIC_SLOT_SET.has(c.slot_key))
  return [...numericCards, ...otherCards].slice(0, MAX_CLARIFICATION_CARDS)
}
