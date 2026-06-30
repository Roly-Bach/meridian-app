import { POTENZIAL_SLOT_NAMES, TAZITE_SLOT_NAMES } from '@/services/interviewSemantic'
import type { StepEntry } from '@/services/interviewSemantic'
import type { TurnRecord } from './types'
import { tokenContainment } from './textOverlap'

/**
 * PROJ-28/BL-E2.1 — Hallucination Rate
 *
 * Fraction of filled slot values whose evidence quote cannot be found in any
 * user turn transcript. Lower is better; target < 0.01 (1%).
 *
 * PROJ-40 (Audit): der frühere 10-Zeichen-Prefix-Match war im LLM-Kontext der falsche Test
 * (LLMs paraphrasieren, ein verbatim-Prefix scheitert an jeder Umformulierung). Ersetzt durch
 * Token-Containment (textOverlap.ts): ein Zitat gilt als gedeckt, wenn ein hinreichender Anteil
 * seiner Inhaltswörter im Transkript vorkommt. Robust gegen Paraphrase, weiterhin deterministisch.
 * Konservativer Proxy — der Grounding-Guard (ADR-015) lehnt Span-Mismatches schon zur Schreibzeit
 * ab, eine non-null-Rate deutet auf Guard-Umgehung oder Altdaten.
 */

// Mindest-Containment, ab dem ein Zitat als im Transkript gedeckt gilt. 0.5 lässt Paraphrase Raum,
// ohne klare Fabrikation (kaum gemeinsame Inhaltswörter) durchzulassen. Nicht gate-relevant
// (PROJ-40: hallucination_rate bleibt berichtet), daher unkritisch kalibriert.
const GROUNDING_CONTAINMENT_THRESHOLD = 0.5
export function scoreHallucinationRate(turns: TurnRecord[], finalStepTracker: StepEntry[]): number {
  const allUserText = turns.map((t) => t.userInput).join(' ')

  let total = 0
  let suspicious = 0

  for (const step of finalStepTracker) {
    // Potenzial slots
    for (const slot of POTENZIAL_SLOT_NAMES) {
      const sv = step.potenzial[slot]
      if (sv == null || sv.value == null) continue
      total++
      if (!quoteFoundInTranscript(sv.quote, allUserText)) suspicious++
    }
    // Tazite slots
    for (const slot of TAZITE_SLOT_NAMES) {
      const sv = step.slots[slot]
      if (sv == null || sv.value == null) continue
      total++
      if (!quoteFoundInTranscript(sv.quote, allUserText)) suspicious++
    }
  }

  return total === 0 ? 0 : suspicious / total
}

// Matches a single leading/trailing quote character of any common style (straight, curly,
// German „…", guillemets). The Analyst's evidence_quote is meant to be a bare verbatim span,
// but the prompt's own illustrative examples are quote-wrapped ("100", "5 Minuten") and a weak
// model sometimes copies that style into the actual value — leaving literal quote chars baked
// into the stored string. Those break the prefix match below even though the content is
// correct, producing a false hallucination_rate signal (KI-15, eval 2026-06-26 run3: 240-char
// evidence with leading `"` scored as a violation despite matching the transcript verbatim).
const SURROUNDING_QUOTE_CHARS = /^["'„""‚''«»]+|["'„""‚''«»]+$/g

function quoteFoundInTranscript(quote: string | null | undefined, transcript: string): boolean {
  if (!quote || quote.trim().length === 0) return true // empty quote — assume ok
  const trimmed = quote.trim().replace(SURROUNDING_QUOTE_CHARS, '')
  if (trimmed.startsWith('[')) return true // backfill marker (e.g. [auto-backfill...]) — not a hallucination
  if (trimmed.length < 5) return true // too short to verify — assume ok
  // Token-Containment statt 10-Zeichen-Prefix (PROJ-40 Audit): robust gegen Paraphrase.
  return tokenContainment(trimmed, transcript) >= GROUNDING_CONTAINMENT_THRESHOLD
}
