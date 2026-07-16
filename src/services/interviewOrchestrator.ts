import { type Phase, type StepEntry } from './interviewSemantic'
import type { AnalystBriefing } from './interviewTypes'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExtendedPhase = Phase | 'completed'

export interface OrchestratorContext {
  phase: Phase
  stepTracker: StepEntry[]
  topicsOpen: string[]
  topicsCovered: string[]
  timerMinutes: number
  maxDurationMinutes: number
  /** Total number of messages in history including the current user turn */
  historyLength: number
  history: { role: 'user' | 'assistant'; content: string }[]
}

export interface LifecycleDecision {
  shouldComplete: boolean
  reason: 'hard_stop' | 'soft_confirm' | null
}

/**
 * PROJ-42 (KI-23 fix): the previous turn-count escalation ladder
 * (computeTurnBudget: 40/56/64/80% thresholds across six phases) was
 * content-blind and the root cause of the Tim bug — it escalated after ~9
 * turns regardless of how much had actually been covered. Replaced by two
 * signals within a single 'explore' phase:
 *   1. Content-driven: the Analyst's stepAdvanceReady signal + open-topics check.
 *   2. Safety nets: a deterministic no-new-extraction streak counter (content-
 *      aware but code-computed, not LLM-guessed) and a wall-clock soft anchor
 *      at ~80% of the interview's time budget (protects the interviewee's
 *      agreed time, not conversation quality — that's the streak counter's job).
 * "Whichever comes first" between full coverage and the soft anchor decides
 * the move to 'closing'.
 */
const SOFT_ANCHOR_RATIO = 0.8
const MAX_GRACE_MINUTES = 3
const DEFAULT_NO_NEW_EXTRACTION_LIMIT = 3

/** Eval-tunable via NO_NEW_EXTRACTION_LIMIT env var (AC: "Startwert K=3, eval-tunbar"). */
function noNewExtractionLimit(): number {
  const env = Number(process.env.NO_NEW_EXTRACTION_LIMIT)
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_NO_NEW_EXTRACTION_LIMIT
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasStepInStatus(tracker: StepEntry[], status: 'exploring' | 'walkthrough' | 'done'): boolean {
  return tracker.some((s) => s.status === status)
}

function hasUnexploredFocusTopic(topicsOpen: string[], tracker: StepEntry[]): boolean {
  if (topicsOpen.length === 0) return false
  const registeredTitles = tracker.map((s) => s.title.trim().toLowerCase())
  return topicsOpen.some((topic) => {
    const t = topic.trim().toLowerCase()
    return !registeredTitles.some((rt) => rt.includes(t) || t.includes(rt))
  })
}

/**
 * Deterministic catch-all closing probe. Injected verbatim by the orchestrator
 * when the interview transitions into 'closing' — successor to the pre-PROJ-42
 * WRAP_UP_QUESTION_TEXT, same mechanism: replaces LLM-generated wording so
 * callers (route handler, eval runner) can write it as the agent_response of
 * the question-turn without invoking the Talker.
 */
export const CLOSING_PROBE_TEXT =
  'Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute noch nicht erwähnt haben?'

/**
 * True iff the deterministic closing probe has been written to history.
 * Match is exact (substring containment) on the constant above.
 */
export function closingProbeAlreadyAsked(
  history: { role: 'user' | 'assistant'; content: string }[],
): boolean {
  const marker = CLOSING_PROBE_TEXT.slice(0, 60) // tolerate trailing decoration
  return history.some((t) => t.role === 'assistant' && t.content.includes(marker))
}

/**
 * Decision whether the next turn should be a deterministic closing-probe
 * injection (no Talker call) or a normal Talker stream.
 *
 * Returns true iff:
 *   - the resolved next phase is 'closing'
 *   - the deterministic probe has NOT yet been written to history
 *   - the most recent message in history is a user message (we owe a response)
 */
export function shouldInjectClosingProbe(
  nextPhase: ExtendedPhase,
  history: { role: 'user' | 'assistant'; content: string }[],
): boolean {
  if (nextPhase !== 'closing') return false
  if (closingProbeAlreadyAsked(history)) return false
  if (history.length === 0) return false
  return history[history.length - 1].role === 'user'
}

/**
 * True iff the deterministic closing probe has been asked AND the user has
 * since replied — i.e. a completion/clarification decision is owed this turn.
 * Shared by decideNextPhase's 'closing' case and checkLifecycle's Trigger B.
 */
export function closingProbeAnswerReceived(
  history: { role: 'user' | 'assistant'; content: string }[],
): boolean {
  return (
    closingProbeAlreadyAsked(history) &&
    history.length > 0 &&
    history[history.length - 1].role === 'user'
  )
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Deterministically decides the phase for the upcoming Talker turn.
 * Reads the state that was left by the PREVIOUS turn's Analyst/tools.
 * The phase returned is the phase that should be WRITTEN to interview_state before the Talker runs.
 */
export function decideNextPhase(ctx: OrchestratorContext, analystSuggestion: AnalystBriefing | null): ExtendedPhase {
  // Hard-Stop: unconditional, phase-agnostic, last resort. Writes 'closing' phase
  // (not 'completed' — 'completed' is interviews.status, decided by checkLifecycle).
  if (ctx.timerMinutes >= ctx.maxDurationMinutes) {
    return 'closing'
  }

  switch (ctx.phase) {
    case 'intro':
      // Advance after first agent response (≥2 messages) — intro is a single greeting turn.
      return ctx.historyLength >= 2 ? 'explore' : 'intro'

    case 'explore': {
      const hasActiveStep = hasStepInStatus(ctx.stepTracker, 'exploring') || hasStepInStatus(ctx.stepTracker, 'walkthrough')

      // Wall-clock soft anchor (~80% of budget): "whichever comes first" between
      // content coverage and the anchor. Deliberately content-blind (that's the
      // no-new-extraction counter's job below) — protects the interviewee's
      // agreed time budget, not conversation quality.
      const softAnchorMinutes = ctx.maxDurationMinutes * SOFT_ANCHOR_RATIO
      if (ctx.timerMinutes >= softAnchorMinutes) {
        // A step freshly/actively being explored gets a short, capped grace
        // window for a natural close before Closing is forced — never an
        // abrupt mid-topic pivot. The window is naturally bounded by the hard
        // stop above (never runs past 100% of the budget).
        const graceMinutes = Math.min(MAX_GRACE_MINUTES, ctx.maxDurationMinutes - softAnchorMinutes)
        const graceExpired = ctx.timerMinutes >= softAnchorMinutes + graceMinutes
        if (hasActiveStep && !graceExpired) return 'explore'
        return 'closing'
      }

      // Safety net: content-blind escalation after K consecutive turns with zero
      // new extraction — catches disengaged/unproductive conversations without
      // reproducing the old pure turn-count ladder (KI-23).
      const noNewExtractionStreak = analystSuggestion?.noNewExtractionStreak ?? 0
      if (noNewExtractionStreak >= noNewExtractionLimit()) return 'closing'

      // Primary driver — content-based advance: the active process is judged
      // sufficiently explored (Analyst signal) AND no open topic/finding
      // remains → Closing. Advance-signal alone (an open topic remains) keeps
      // Explore running; the Talker methodology actively asks about the next
      // recurring task (breadth-first, unchanged principle).
      const stepAdvanceReady = analystSuggestion?.step_advance_ready === true
      if (stepAdvanceReady && !hasUnexploredFocusTopic(ctx.topicsOpen, ctx.stepTracker)) {
        return 'closing'
      }

      return 'explore'
    }

    case 'closing': {
      // A newly-discovered process during Closing is first-class — back to
      // Explore in full (no more 2-turn clarification-only cap for late finds).
      if (hasStepInStatus(ctx.stepTracker, 'exploring')) return 'explore'

      // Deterministic in STATE: the catch-all probe must be present in history
      // and answered before a completion/clarification decision is owed.
      if (closingProbeAnswerReceived(ctx.history)) {
        const cards = analystSuggestion?.clarification_cards
        if (cards && cards.length > 0) return 'clarification'
        return 'completed'
      }
      return 'closing'
    }

    case 'clarification':
      // Stays until all clarification answers written (checked by route handler via DB).
      return 'clarification'

    default:
      return ctx.phase
  }
}

export interface PhaseDecisionMeta {
  phase: ExtendedPhase
  /**
   * The phase that was just entered this turn (i.e. the previous phase differed
   * from the resolved phase). Null when the phase stays the same.
   */
  phaseJustEntered: Phase | null
}

/**
 * Wrapper around decideNextPhase that also signals when a phase transition
 * happened. Used by the route handler to trigger analyst_catchup on entry
 * into 'closing'.
 */
export function decideNextPhaseWithMeta(ctx: OrchestratorContext, analystSuggestion: AnalystBriefing | null): PhaseDecisionMeta {
  const phase = decideNextPhase(ctx, analystSuggestion)
  const phaseJustEntered = (phase !== ctx.phase && phase !== 'completed')
    ? (phase as Phase)
    : null
  return { phase, phaseJustEntered }
}

/**
 * Decides whether the interview should be completed this turn.
 * Returns shouldComplete=true for both Hard-Stop (timer) and Soft-Confirm (closing-sequence convergence).
 *
 * PROJ-42: the previous phase-agnostic farewell-loop escape valve (regex
 * FAREWELL_MARKERS string matching over the last two assistant turns) is
 * removed entirely — termination is now deterministic in state (the closing
 * probe + its answer), not guessed from text heuristics (KI-23).
 */
export function checkLifecycle(ctx: OrchestratorContext, analystSuggestion: AnalystBriefing | null): LifecycleDecision {
  // Trigger A: Hard-Stop — unconditional, last resort. Still produces a
  // coherent, LLM-formulated farewell (runInterviewTurn.ts's
  // isCompletionFarewell path) — never a raw abort or system message.
  if (ctx.timerMinutes >= ctx.maxDurationMinutes) {
    return { shouldComplete: true, reason: 'hard_stop' }
  }

  // Trigger B: Soft-Confirm — the Closing sequence converged: catch-all probe
  // asked + answered, no newly-discovered process, no pending clarification cards.
  if (ctx.phase === 'closing') {
    if (hasStepInStatus(ctx.stepTracker, 'exploring')) {
      // Routed back to Explore by decideNextPhase — don't complete out from under it.
      return { shouldComplete: false, reason: null }
    }
    if (closingProbeAnswerReceived(ctx.history)) {
      const cards = analystSuggestion?.clarification_cards
      if (!cards || cards.length === 0) {
        return { shouldComplete: true, reason: 'soft_confirm' }
      }
    }
  }

  return { shouldComplete: false, reason: null }
}
