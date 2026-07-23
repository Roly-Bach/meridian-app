/**
 * PROJ-43 (AC3/AC4/AC5): applies submitted Clarification-Card answers to a
 * step_tracker (StepEntry[]).
 *
 * The single implementation shared by the production route
 * (/api/interview/[token]/clarification) and the eval runner's evalStore.ts —
 * both persist through the same TurnStore abstraction against
 * interview_state.step_tracker, so this function is the actual "code-identical"
 * completion path the PROJ-43 Tech Design assumes (previously the two call
 * sites duplicated slightly different logic against process_steps, which
 * doesn't even exist yet at this point in the flow — process_steps rows are
 * only created from step_tracker AFTER the clarification round, see
 * processEnrichment.ts's createProcessStepsFromTracker).
 *
 * Pure — no DB access. Callers own persistence.
 */

import { MANDATORY_NUMERIC_SLOTS, type MandatoryNumericSlot, type StepEntry } from './interviewSemantic'
import { findStepFuzzy, findStepById } from './turnStore/applyIntent'
import { mergeManualCorrection, type ManualCorrectionPatch } from '@/lib/schrittDatenView'
import { resolveBucketValue, parseFreeNumericAnswer } from '@/lib/clarificationBuckets'

export interface ClarificationSlotAnswer {
  process_step_id: string
  slot_key: string
  answer: string | string[]
}

// entscheidungslogik SlotCard — unchanged since before PROJ-43 (AC3 only
// extends the three numeric slot types with a free-text input + buckets).
const ENTSCHEIDUNGSLOGIK_MAP: Record<string, boolean> = {
  'Immer gleich': true,
  'Meistens gleich': true,
  'Variiert stark': false,
}

const MANDATORY_NUMERIC_SLOT_SET: ReadonlySet<string> = new Set(MANDATORY_NUMERIC_SLOTS)

function findStepIndex(tracker: StepEntry[], processStepId: string): number {
  const byId = findStepById(tracker, processStepId)
  if (byId !== -1) return byId
  return findStepFuzzy(tracker, processStepId)
}

/**
 * AC3: a numeric SlotCard answer is either a direction-tailored bucket label
 * or a free numeric/range value (equal-weight input paths) — or "Weiß ich
 * nicht"/empty, which AC4 requires to still resolve the gate via an explicit
 * nicht_befund_typ='unbekannt' rather than leaving the slot an open gap.
 */
function resolveNumericPatch(step: StepEntry, slot: MandatoryNumericSlot, answer: string): ManualCorrectionPatch | null {
  const trimmed = answer.trim()
  if (trimmed === '' || trimmed === 'Weiß ich nicht') {
    const unbekannt = { unbekannt: true as const }
    if (slot === 'frequency') return { frequency: unbekannt }
    if (slot === 'duration') return { duration: unbekannt }
    return { error_rate_percent: unbekannt }
  }

  const direction = step.potenzial[slot]?.richtung ?? null
  const bucketValue = resolveBucketValue(slot, direction, trimmed)
  const resolved = bucketValue !== undefined ? bucketValue : parseFreeNumericAnswer(trimmed)
  if (resolved === null) return null

  if (slot === 'frequency') return { frequency: resolved }
  if (slot === 'duration') return { duration: resolved }
  return { error_rate_percent: resolved }
}

/**
 * Applies every submitted slot answer to the tracker, read-merge-write per
 * step (mergeManualCorrection). Returns a NEW tracker (immutable) — callers
 * persist it via the TurnStore's register_step full-array intent, exactly the
 * pattern computeMergedSteps/data_sources-backfill already use.
 *
 * Only the numeric slots (AC3) and entscheidungslogik (unchanged) are
 * handled here — open_item/qualitative answers keep their existing,
 * unrelated handling at the call sites (knowledge_objects/process_steps
 * inserts, PROJ-47 territory, not touched this round).
 */
export function applyClarificationSlotAnswers(tracker: StepEntry[], answers: ClarificationSlotAnswer[]): StepEntry[] {
  let next = tracker

  for (const a of answers) {
    if (typeof a.answer !== 'string') continue
    const isNumeric = MANDATORY_NUMERIC_SLOT_SET.has(a.slot_key)
    const isEntscheidungslogik = a.slot_key === 'entscheidungslogik'
    if (!isNumeric && !isEntscheidungslogik) continue

    const stepIndex = findStepIndex(next, a.process_step_id)
    if (stepIndex === -1) continue
    const step = next[stepIndex]

    let patch: ManualCorrectionPatch | null = null
    if (isNumeric) {
      patch = resolveNumericPatch(step, a.slot_key as MandatoryNumericSlot, a.answer)
    } else if (a.answer !== 'Weiß ich nicht' && ENTSCHEIDUNGSLOGIK_MAP[a.answer] !== undefined) {
      patch = { rule_based: ENTSCHEIDUNGSLOGIK_MAP[a.answer] }
    }
    if (patch == null) continue

    const merged = mergeManualCorrection(step, patch)
    const updatedStep: StepEntry = merged.status === 'exploring' ? { ...merged, status: 'walkthrough' } : merged
    next = next.map((s, i) => (i === stepIndex ? updatedStep : s))
  }

  return next
}
