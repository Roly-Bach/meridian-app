/**
 * Pure conversation-signal analysis for the interview engine.
 *
 * PROJ-46 (ADR-023 D5): reduced to the single remaining provisional detector —
 * question-stem repetition (KI-15). exception, the numeric ambiguity detector,
 * recentlyRecontextualized, drill-stop, and laddering were removed ersatzlos:
 * the synchronous Analyst (interviewAnalyst.ts) now sees every turn BEFORE the
 * Talker (PROJ-44/ADR-021), so these were compensating for a Talker that had
 * no fresh Analyst read — that compensation is now redundant. Their intention
 * (don't keep drilling an exhausted target / don't re-target a blocked thread)
 * is absorbed into the deterministic Fokus-Lock + Ziel-O-Feld choice
 * (interviewOrchestrator.ts's computeFocusLock/computeTargetOFieldFallback).
 * question-stem is kept provisionally (Löschkandidat, PROJ-46 spec Abschnitt
 * E) — verify by eval that question repetition doesn't return before deleting
 * this module outright.
 *
 * No server-only chain: no supabase-admin, no next/server imports.
 */

export interface Signals {
  /** Question-stem opener repeated in the last 2 assistant turns (KI-15), e.g. "Wie oft". */
  repeatedQuestionStem: string | null
}

// ─── Private: Question-Stem Repetition (KI-15) ───────────────────────────────
//
// dialog_naturalness judges (eval 2026-06-24/25/26, buchhalter) consistently dinged "repetitive
// Frage-Struktur ('Wie oft...', 'Wie viel Zeit...')" as a Stufe-1 (oberflächlich) signal. Unlike
// filler phrases (opening pleasantries), this is about the QUESTION ITSELF — the same
// interrogative stem fired twice in a row reads as a form, not a conversation.
const QUESTION_STEM_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'Wie oft', pattern: /\bwie oft\b/i },
  { label: 'Wie lange', pattern: /\bwie lange\b/i },
  { label: 'Wie viel(e) Zeit', pattern: /\bwie viel(?:e)? zeit\b/i },
  { label: 'Wie häufig', pattern: /\bwie häufig\b/i },
  { label: 'Wie viele', pattern: /\bwie viele\b/i },
]

function detectQuestionStemRepetition(recentAssistantTurns: string[] | undefined): string | null {
  if (!recentAssistantTurns || recentAssistantTurns.length < 2) return null
  const lastTwo = recentAssistantTurns.slice(-2)
  for (const { label, pattern } of QUESTION_STEM_PATTERNS) {
    if (lastTwo.every((t) => pattern.test(t))) return label
  }
  return null
}

// ─── Public: analyzeConversationSignals ──────────────────────────────────────

/**
 * Single entry point for conversation-signal analysis. Composes the (now
 * single) detector — kept as a function rather than inlining
 * detectQuestionStemRepetition directly into talkerPrompt.ts so a future
 * detector can be added back through the same seam without re-touching the
 * Talker prompt's import shape.
 */
export function analyzeConversationSignals(recentAssistantTurns: string[] | undefined): Signals {
  return {
    repeatedQuestionStem: detectQuestionStemRepetition(recentAssistantTurns),
  }
}
