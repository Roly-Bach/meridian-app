/**
 * PROJ-45 (ADR-025 D1): read-side adapter from process_steps.schritt_daten
 * (JSONB, StepEntry-shaped) to the flat display/heuristic fields the
 * pre-PROJ-45 consumers (useCaseEngine.ts, processStepsAggregation.ts,
 * processClustering.ts, reportGenerator.ts, ProcessStepsTable.tsx,
 * UseCaseSheet.tsx, InterviewReport.tsx) were built around.
 *
 * Keeps those consumers' own logic (ROI heuristics, cluster aggregation,
 * rendering) unchanged — only the read boundary adapts to the new JSONB
 * persistence. Pure, side-effect-free.
 */

import {
  parseSchrittDaten,
  resolveHaeufigkeitProMonat,
  resolveDauerMinuten,
  type StepEntry,
} from '@/services/interviewSemantic'

export interface ProcessStepDisplayFields {
  frequency: number | null
  duration: number | null
  data_sources: string[]
  rule_based: boolean
  error_rate_percent: number | null
  media_breaks: number
}

// Same heuristic the removed processEnrichment.ts coerceRuleBased used —
// relocated here as the one remaining consumer (R1/R3/R6/R7 in useCaseEngine.ts
// still need a boolean, entscheidungslogik is free text since PROJ-25).
const RULE_BASED_FALSY = new Set(['false', 'nein', 'no', 'none', 'keine', 'niemals', '0', ''])

function deriveRuleBased(entscheidungslogikValue: string | null | undefined): boolean {
  if (entscheidungslogikValue == null) return false
  return !RULE_BASED_FALSY.has(entscheidungslogikValue.toLowerCase().trim())
}

/** Derives the flat display/heuristic fields from a StepEntry (already parsed). */
export function deriveProcessStepDisplayFields(step: StepEntry | null): ProcessStepDisplayFields {
  const hilfsmittelValue = step?.slots.hilfsmittel?.value
  const dataSources = Array.isArray(hilfsmittelValue) ? hilfsmittelValue : []
  return {
    frequency: resolveHaeufigkeitProMonat(step?.potenzial.frequency),
    duration: resolveDauerMinuten(step?.potenzial.duration),
    data_sources: dataSources,
    rule_based: deriveRuleBased(step?.slots.entscheidungslogik?.value),
    error_rate_percent: step?.potenzial.error_rate_percent?.value ?? null,
    media_breaks: step?.potenzial.media_breaks?.value ?? 0,
  }
}

/** Convenience: parses the raw JSONB column and derives the display fields in one call. */
export function deriveProcessStepDisplayFieldsFromRaw(raw: unknown): ProcessStepDisplayFields {
  return deriveProcessStepDisplayFields(parseSchrittDaten(raw))
}

const EMPTY_STEP_ENTRY: StepEntry = {
  title: '',
  reihenfolge: 1,
  status: 'done',
  abhaengigkeiten: null,
  potenzial: { frequency: null, duration: null, error_rate_percent: null, media_breaks: null },
  slots: {
    entscheidungslogik: null, tazite_cues: null, ausnahmen: null, inputs: null, outputs: null,
    hilfsmittel: null, reibungspunkte: null, ausloeser: null, aufgabentyp: null, risiko_schwere: null,
    standardisierungsgrad: null, informationsdichte: null,
  },
}

/** Sentinel for a resolved-but-unanswered numeric slot — PROJ-43 AC4 ("Weiß ich nicht" / left blank in a Card round). */
export interface UnbekanntSentinel {
  unbekannt: true
}

export interface ManualCorrectionPatch {
  frequency?: number | UnbekanntSentinel | null
  duration?: number | UnbekanntSentinel | null
  data_sources?: string[]
  rule_based?: boolean
  error_rate_percent?: number | UnbekanntSentinel | null
  media_breaks?: number
}

function isUnbekanntSentinel(v: unknown): v is UnbekanntSentinel {
  return typeof v === 'object' && v !== null && (v as UnbekanntSentinel).unbekannt === true
}

/**
 * Read-merge-write helper for non-LLM writers of schritt_daten (manual PATCH
 * corrections in process-steps/[id]/route.ts, closed-choice clarification-card
 * answers in interview/[token]/clarification/route.ts). Values written this
 * way carry quote='[manuelle Korrektur]' + confidence='confirmed' — they are
 * not evidence-quoted the way an Analyst record_slot write is, but the field
 * is never left in an inconsistent half-wrapped state.
 */
export function mergeManualCorrection(current: StepEntry | null, patch: ManualCorrectionPatch): StepEntry {
  const base = current ?? EMPTY_STEP_ENTRY

  const numberSlot = (value: number, existing: StepEntry['potenzial']['frequency']) => ({
    value,
    quote: existing?.quote ?? '[manuelle Korrektur]',
    confidence: 'confirmed' as const,
    nicht_befund_typ: null,
    ...(existing?.einheit !== undefined ? { einheit: existing.einheit } : {}),
  })

  // PROJ-43 (AC4): a Card round that resolves to "Weiß ich nicht" / no answer
  // still counts as a completed round — explicit nicht_befund_typ='unbekannt'
  // instead of leaving the slot as an open (re-triggering) gap.
  const unbekanntSlot = (existing: StepEntry['potenzial']['frequency']) => ({
    value: null,
    quote: existing?.quote ?? '[manuelle Korrektur]',
    confidence: 'confirmed' as const,
    nicht_befund_typ: 'unbekannt' as const,
    ...(existing?.einheit !== undefined ? { einheit: existing.einheit } : {}),
  })

  function resolvePotenzial(
    value: number | UnbekanntSentinel | null | undefined,
    existing: StepEntry['potenzial']['frequency'],
  ): StepEntry['potenzial']['frequency'] {
    if (value === undefined) return existing
    if (value === null) return null
    if (isUnbekanntSentinel(value)) return unbekanntSlot(existing)
    return numberSlot(value, existing)
  }

  return {
    ...base,
    potenzial: {
      frequency: resolvePotenzial(patch.frequency, base.potenzial.frequency),
      duration: resolvePotenzial(patch.duration, base.potenzial.duration),
      error_rate_percent: resolvePotenzial(patch.error_rate_percent, base.potenzial.error_rate_percent),
      media_breaks: patch.media_breaks !== undefined
        ? numberSlot(patch.media_breaks, base.potenzial.media_breaks)
        : base.potenzial.media_breaks,
    },
    slots: {
      ...base.slots,
      hilfsmittel: patch.data_sources !== undefined
        ? { value: patch.data_sources.length > 0 ? patch.data_sources : null, quote: base.slots.hilfsmittel?.quote ?? '[manuelle Korrektur]', confidence: 'confirmed', nicht_befund_typ: null }
        : base.slots.hilfsmittel,
      entscheidungslogik: patch.rule_based !== undefined
        ? { value: patch.rule_based ? 'Ja, regelbasiert (manuelle Korrektur)' : 'Nein, variiert (manuelle Korrektur)', quote: '[manuelle Korrektur]', confidence: 'confirmed', nicht_befund_typ: null }
        : base.slots.entscheidungslogik,
    },
  }
}
