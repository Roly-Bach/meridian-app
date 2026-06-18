import type { TurnRecord } from './types'

/**
 * Plausibility of record_slot evidence_quote vs. referenced user input.
 *
 * Historical (pre-2026-06-03): exact substring match. Flash 3.5 / Claude
 * paraphrase rather than verbatim-quote → scorer reported 0.16 even when
 * extractions were semantically correct. Fix: token-overlap (Jaccard) of
 * content tokens, plus optional verbatim bonus.
 *
 * Per candidate:
 *   - normalize both strings (lowercase, strip punctuation)
 *   - tokenize into ≥3-char content tokens (drop German stopwords)
 *   - score = 1.0 if verbatim substring present
 *           else Jaccard(quoteTokens, inputTokens)
 *           clamped to [0, 1]
 *
 * source_turn handling:
 *   - present + valid → score against turns[source_turn - 1].userInput
 *   - missing → score against UNION of all prior turn inputs (best match wins),
 *     then × 0.9 penalty for missing attribution
 *
 * Target: ≥ 0.85 (lowered from 0.95 since paraphrased quotes are normal).
 * Returns 1.0 if no record_slot calls were made.
 */

const STOPWORDS = new Set([
  'und', 'oder', 'aber', 'wenn', 'dann', 'wie', 'was', 'wer', 'wo',
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem',
  'mit', 'von', 'für', 'auf', 'bei', 'aus', 'nach', 'vor', 'zur', 'zum',
  'ist', 'sind', 'war', 'sein', 'wird', 'werden', 'wurde', 'wurden',
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich',
  'sich', 'mein', 'dein', 'unser', 'auch', 'nicht', 'noch', 'nur',
  'schon', 'also', 'dass', 'weil', 'damit', 'denn',
])

function tokenize(s: string): Set<string> {
  const cleaned = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics for robustness
    .replace(/[^a-z0-9äöüß\s]/gi, ' ')
  const tokens = cleaned.split(/\s+/).filter(t => t.length >= 3 && !STOPWORDS.has(t))
  return new Set(tokens)
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const t of a) if (b.has(t)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

function scoreOne(evidenceQuote: string, userInput: string): number {
  const normalizedQuote = evidenceQuote.toLowerCase().replace(/\s+/g, ' ').trim()
  const normalizedInput = userInput.toLowerCase().replace(/\s+/g, ' ').trim()
  if (normalizedInput.length === 0) return 0
  if (normalizedInput.includes(normalizedQuote)) return 1.0
  const qTokens = tokenize(evidenceQuote)
  const iTokens = tokenize(userInput)
  return jaccard(qTokens, iTokens)
}

export function scoreToolCallPlausibility(turns: TurnRecord[]): number {
  type Candidate = {
    evidenceQuote: string
    sourceTurnIdx: number | null
  }

  type SpanCandidate = { evidenceSpan: string; turnIdx: number }
  type QuoteCandidate = { evidenceQuote: string; sourceTurnIdx: number | null }
  const spanCandidates: SpanCandidate[] = []
  const quoteCandidates: QuoteCandidate[] = []

  turns.forEach((turn, turnIdx) => {
    for (const call of turn.toolCalls) {
      if (call.toolName !== 'record_slot') continue
      if (!call.args) continue

      // Fix 3 (ADR-015): prefer evidence_span — deterministically verified by
      // the tool itself, so the scorer trusts it (score = 1.0 if present).
      const evidenceSpan = call.args['evidence_span']
      if (typeof evidenceSpan === 'string' && evidenceSpan.trim().length >= 2) {
        spanCandidates.push({ evidenceSpan: evidenceSpan.trim(), turnIdx })
        continue
      }

      const evidenceQuote = call.args['evidence_quote']
      if (typeof evidenceQuote !== 'string' || evidenceQuote.trim().length < 3) continue

      const rawSourceTurn = call.args['source_turn']
      const sourceTurn = typeof rawSourceTurn === 'number' && Number.isInteger(rawSourceTurn) && rawSourceTurn > 0
        ? rawSourceTurn
        : null

      quoteCandidates.push({
        evidenceQuote: evidenceQuote.trim(),
        sourceTurnIdx: sourceTurn !== null ? sourceTurn - 1 : null,
      })
    }
  })

  const total = spanCandidates.length + quoteCandidates.length
  if (total === 0) return 1.0

  let totalScore = 0

  // Span-based candidates: deterministic — tool already validated verbatim presence.
  // If not in recording turn, check prior turns (analyst catchup from earlier user input).
  for (const { evidenceSpan, turnIdx } of spanCandidates) {
    const input = turns[turnIdx]?.userInput ?? ''
    if (input.includes(evidenceSpan)) {
      totalScore += 1.0
    } else {
      const foundInPrior = turns.some((t, i) => i < turnIdx && t.userInput.includes(evidenceSpan))
      totalScore += foundInPrior ? 0.9 : 0.5
    }
  }

  // Quote-based candidates: fall back to token-overlap heuristic.
  for (const { evidenceQuote, sourceTurnIdx } of quoteCandidates) {
    let score: number
    if (sourceTurnIdx !== null) {
      const referencedTurn = turns[sourceTurnIdx]
      score = scoreOne(evidenceQuote, referencedTurn?.userInput ?? '')
    } else {
      let best = 0
      for (const t of turns) {
        const s = scoreOne(evidenceQuote, t.userInput)
        if (s > best) best = s
      }
      score = best * 0.9
    }
    totalScore += score
  }

  return totalScore / total
}
