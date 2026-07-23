/**
 * PROJ-43 (AC2/AC3): direction-aware bucket definitions for the three
 * deterministic Clarification-Card slot types (frequency/duration/
 * error_rate_percent) + a free-text numeric/range parser.
 *
 * Pure, side-effect-free — imported both client-side (ClarificationCards.tsx,
 * rendering the buttons) and server-side (the clarification completion path,
 * mapping a chosen label back to its canonical value). Kept as the single
 * source of truth for label↔value mapping so client and server never drift
 * (KI-18 precedent: bucket-to-value mapping must stay deterministic code, not
 * duplicated free text).
 *
 * Values are already in the field's canonical unit (frequency → pro Monat,
 * duration → Minuten, error_rate_percent → %) — same convention as the
 * pre-PROJ-43 fixed SLOT_OPTIONS maps.
 */

import type { MandatoryNumericSlot } from '@/services/interviewSemantic'

export type Direction = 'niedrig' | 'hoch' | null | undefined

export interface Bucket {
  label: string
  value: number
}

const FREQUENCY_BUCKETS: Record<'default' | 'niedrig' | 'hoch', Bucket[]> = {
  default: [
    { label: 'Täglich', value: 22 },
    { label: 'Wöchentlich', value: 4 },
    { label: 'Mehrfach/Monat', value: 8 },
    { label: 'Monatlich', value: 1 },
  ],
  hoch: [
    { label: 'Mehrmals täglich', value: 44 },
    { label: 'Täglich', value: 22 },
    { label: 'Mehrfach/Woche', value: 12 },
    { label: 'Wöchentlich', value: 4 },
  ],
  niedrig: [
    { label: 'Monatlich', value: 1 },
    { label: 'Alle paar Monate', value: 0.33 },
    { label: 'Ein paar Mal im Jahr', value: 0.17 },
    { label: 'Seltener', value: 0.05 },
  ],
}

const DURATION_BUCKETS: Record<'default' | 'niedrig' | 'hoch', Bucket[]> = {
  default: [
    { label: '< 5 Min', value: 3 },
    { label: '5–15 Min', value: 10 },
    { label: '15–30 Min', value: 22 },
    { label: '> 30 Min', value: 45 },
  ],
  hoch: [
    { label: '30–60 Min', value: 45 },
    { label: '1–2 Std', value: 90 },
    { label: '2–4 Std', value: 180 },
    { label: '> 4 Std', value: 300 },
  ],
  niedrig: [
    { label: '< 1 Min', value: 0.5 },
    { label: '1–3 Min', value: 2 },
    { label: '3–5 Min', value: 4 },
    { label: '5–10 Min', value: 7 },
  ],
}

const ERROR_RATE_BUCKETS: Record<'default' | 'niedrig' | 'hoch', Bucket[]> = {
  default: [
    { label: 'Selten Fehler', value: 2 },
    { label: 'Gelegentlich', value: 10 },
    { label: 'Häufig', value: 30 },
  ],
  hoch: [
    { label: 'Häufig', value: 30 },
    { label: 'Sehr häufig', value: 50 },
    { label: 'Fast immer', value: 70 },
  ],
  niedrig: [
    { label: 'So gut wie nie', value: 1 },
    { label: 'Sehr selten', value: 3 },
    { label: 'Gelegentlich', value: 8 },
  ],
}

const BUCKET_SETS: Record<MandatoryNumericSlot, Record<'default' | 'niedrig' | 'hoch', Bucket[]>> = {
  frequency: FREQUENCY_BUCKETS,
  duration: DURATION_BUCKETS,
  error_rate_percent: ERROR_RATE_BUCKETS,
}

function variantFor(direction: Direction): 'default' | 'niedrig' | 'hoch' {
  return direction === 'niedrig' || direction === 'hoch' ? direction : 'default'
}

/** The ordered bucket labels/values to render for a slot, given its captured direction (AC2). */
export function bucketsFor(slot: MandatoryNumericSlot, direction: Direction): Bucket[] {
  return BUCKET_SETS[slot][variantFor(direction)]
}

/** Maps a chosen bucket label back to its canonical value — direction must match what was rendered. */
export function resolveBucketValue(slot: MandatoryNumericSlot, direction: Direction, label: string): number | undefined {
  return bucketsFor(slot, direction).find((b) => b.label === label)?.value
}

/**
 * AC3(a): free numeric/range input, equal-weight alternative to the bucket
 * choice. Accepts a bare number ("12", "12,5") or a range ("10-15",
 * "10 bis 15") — a range resolves to its mean, mirroring how the Analyst
 * resolves spoken spans (interviewTools.ts's record_slot guidance). Returns
 * null when nothing numeric can be extracted — callers must not guess.
 */
export function parseFreeNumericAnswer(input: string): number | null {
  const normalized = input.trim().replace(/,/g, '.')
  if (!normalized) return null

  const rangeMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|—|bis)\s*(-?\d+(?:\.\d+)?)/i)
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1])
    const b = parseFloat(rangeMatch[2])
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.round(((a + b) / 2) * 100) / 100
  }

  const singleMatch = normalized.match(/-?\d+(?:\.\d+)?/)
  if (singleMatch) {
    const n = parseFloat(singleMatch[0])
    if (Number.isFinite(n)) return n
  }

  return null
}
