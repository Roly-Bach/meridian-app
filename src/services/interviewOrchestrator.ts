import { computeMissingMandatorySlots } from './interviewAgent'
import type { Phase, StepEntry, AnalystBriefing } from './interviewAgent'

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasStepInStatus(tracker: StepEntry[], status: 'exploring' | 'walkthrough' | 'done'): boolean {
  return tracker.some((s) => s.status === status)
}

function walkthroughHasContent(tracker: StepEntry[]): boolean {
  return tracker.some(
    (s) =>
      s.status === 'walkthrough' &&
      ((s.process_steps?.length ?? 0) + (s.friction_points?.length ?? 0) + (s.pain_point_primary ? 1 : 0)) >= 3,
  )
}

function allStepsDone(tracker: StepEntry[]): boolean {
  if (tracker.length === 0) return false
  return !tracker.some((s) => s.status === 'exploring' || s.status === 'walkthrough')
}

function hasUnexploredFocusTopic(topicsOpen: string[], tracker: StepEntry[]): boolean {
  if (topicsOpen.length === 0) return false
  const registeredTitles = tracker.map((s) => s.title.trim().toLowerCase())
  return topicsOpen.some((topic) => {
    const t = topic.trim().toLowerCase()
    return !registeredTitles.some((rt) => rt.includes(t) || t.includes(rt))
  })
}

function allMandatorySlotsFilled(tracker: StepEntry[]): boolean {
  return tracker.length > 0 && computeMissingMandatorySlots(tracker).length === 0
}

/** Detect if the wrap-up closing question was asked (Iteration 2 heuristic for Trigger B). */
function closingQuestionWasAsked(history: { role: 'user' | 'assistant'; content: string }[]): boolean {
  const allAssistant = history.filter((t) => t.role === 'assistant')

  // Primary: search full history — the question may have been asked many turns ago if a new
  // process was discovered at wrap-up and then explored before the final goodbye.
  const mandatoryQuestionAsked = allAssistant.some((t) => {
    const lc = t.content.toLowerCase()
    return (
      lc.includes('letzte arbeitswoche') ||
      lc.includes('nicht erwähnt haben') ||
      lc.includes('wiederkehrend') ||
      lc.includes('nicht besprochen') ||
      lc.includes('nicht beleuchtet') ||
      lc.includes('noch nicht erwähnt') ||
      lc.includes('noch nicht besprochen') ||
      lc.includes('noch nicht angesprochen') ||
      lc.includes('fehlt noch') ||
      lc.includes('gibt es noch etwas') ||
      (lc.includes('gibt es') && lc.includes('noch etwas')) ||
      (lc.includes('gibt es etwas') && lc.includes('nicht'))
    )
  })
  return mandatoryQuestionAsked
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Deterministically decides the phase for the upcoming Talker turn.
 * Reads the state that was left by the PREVIOUS turn's Analyst/tools.
 * The phase returned is the phase that should be WRITTEN to interview_state before the Talker runs.
 *
 * analystSuggestion is null in Iteration 2; populated by interviewAnalyst.ts in Iteration 3.
 */
export function decideNextPhase(ctx: OrchestratorContext, analystSuggestion: AnalystBriefing | null): ExtendedPhase {
  // Hard-Stop: write wrap_up phase (not 'completed' — 'completed' is interviews.status)
  if (ctx.timerMinutes >= ctx.maxDurationMinutes) {
    return 'wrap_up'
  }

  switch (ctx.phase) {
    case 'intro':
      // Advance after 2 full exchanges (≥4 messages including current user turn)
      return ctx.historyLength >= 4 ? 'process_loop' : 'intro'

    case 'process_loop':
      // Analyst writes exploring→walkthrough in same run, so Orchestrator reads walkthrough next turn.
      // Advance on either status — exploring = just registered, walkthrough = Analyst already progressed it.
      if (hasStepInStatus(ctx.stepTracker, 'exploring') || hasStepInStatus(ctx.stepTracker, 'walkthrough')) {
        return 'walkthrough_step'
      }
      return 'process_loop'

    case 'walkthrough_step':
      // Walkthrough content threshold reached → move to slot_completion
      if (walkthroughHasContent(ctx.stepTracker)) return 'slot_completion'
      // No active steps remaining → also move to slot_completion
      if (!hasStepInStatus(ctx.stepTracker, 'exploring') && !hasStepInStatus(ctx.stepTracker, 'walkthrough') && ctx.stepTracker.length > 0) {
        return 'slot_completion'
      }
      return 'walkthrough_step'

    case 'slot_completion': {
      if (!allStepsDone(ctx.stepTracker)) return 'slot_completion'
      if (hasUnexploredFocusTopic(ctx.topicsOpen, ctx.stepTracker)) return 'process_loop'
      return 'coverage_check'
    }

    case 'coverage_check':
      if (allMandatorySlotsFilled(ctx.stepTracker)) return 'wrap_up'
      return 'coverage_check'

    case 'wrap_up': {
      // If agent registered new steps after asking the closing question → back to exploration
      if (hasStepInStatus(ctx.stepTracker, 'exploring')) return 'walkthrough_step'
      if (hasStepInStatus(ctx.stepTracker, 'walkthrough')) return 'slot_completion'

      // Trigger B: Analyst confirmed (Iteration 3) or text heuristic (Iteration 2)
      const questionAsked =
        analystSuggestion?.wrap_up_question_asked === true || closingQuestionWasAsked(ctx.history)

      if (questionAsked && ctx.history.length > 0 && ctx.history[ctx.history.length - 1].role === 'user') {
        // Amendment A: if Analyst produced clarification_cards → clarification phase
        const cards = analystSuggestion?.clarification_cards
        if (cards && cards.length > 0) return 'clarification'
        return 'completed'
      }
      return 'wrap_up'
    }

    case 'clarification':
      // Stays until all clarification answers written (checked by route handler via DB)
      return 'clarification'

    default:
      return ctx.phase
  }
}

/**
 * Decides whether the interview should be completed this turn.
 * Returns shouldComplete=true for both Hard-Stop (timer) and Soft-Confirm (wrap-up heuristic).
 */
export function checkLifecycle(ctx: OrchestratorContext, analystSuggestion: AnalystBriefing | null): LifecycleDecision {
  // Trigger A: Hard-Stop
  if (ctx.timerMinutes >= ctx.maxDurationMinutes) {
    return { shouldComplete: true, reason: 'hard_stop' }
  }

  // Farewell-loop escape valve — phase-agnostic. Fires when the agent is stuck in a goodbye
  // loop regardless of phase. Necessary because a step discovered at wrap_up can push the phase
  // back to walkthrough_step/slot_completion; if that step stays walkthrough, the wrap_up-gated
  // path below is never reached and the farewell loop runs until MAX_TURNS.
  // Must check BEFORE the active-step guard.
  {
    const allAssistant = ctx.history.filter((t) => t.role === 'assistant')
    const lastTwo = allAssistant.slice(-2)
    const FAREWELL_MARKERS = ['vielen dank', 'auf wiedersehen', 'bis zum nächsten', 'wünsche dir', 'verabschied']
    if (
      lastTwo.length >= 2 &&
      ctx.history.length > 0 &&
      ctx.history[ctx.history.length - 1].role === 'user' &&
      lastTwo.every((t) => FAREWELL_MARKERS.some((m) => t.content.toLowerCase().includes(m)))
    ) {
      // PROJ-23: Don't complete when Analyst has clarification_cards pending — route to clarification instead.
      // Also don't complete when analyst hasn't run yet (analystSuggestion=null means next_briefing is not
      // set, i.e. we never reached wrap_up). An agent saying farewell at coverage_check/slot_completion is
      // premature — let decideNextPhase advance to wrap_up so the analyst runs and can produce cards.
      const cards = analystSuggestion?.clarification_cards
      if (analystSuggestion !== null && (!cards || cards.length === 0)) {
        return { shouldComplete: true, reason: 'soft_confirm' }
      }
    }
  }

  // Trigger B: Soft-Confirm (wrap_up question asked + user has responded)
  if (ctx.phase === 'wrap_up') {
    // Don't complete if new steps were registered (new content introduced at wrap-up)
    if (hasStepInStatus(ctx.stepTracker, 'exploring') || hasStepInStatus(ctx.stepTracker, 'walkthrough')) {
      return { shouldComplete: false, reason: null }
    }

    const questionAsked =
      analystSuggestion?.wrap_up_question_asked === true || closingQuestionWasAsked(ctx.history)

    if (questionAsked && ctx.history.length > 0 && ctx.history[ctx.history.length - 1].role === 'user') {
      // Don't complete if Analyst generated clarification_cards — go to clarification phase instead
      const cards = analystSuggestion?.clarification_cards
      if (!cards || cards.length === 0) {
        return { shouldComplete: true, reason: 'soft_confirm' }
      }
    }
  }

  return { shouldComplete: false, reason: null }
}
