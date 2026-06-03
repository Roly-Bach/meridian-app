import { computeMissingMandatorySlots, MANDATORY_SLOTS, groupSemanticSteps } from './interviewAgent'
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

// historyLength ≈ 2× turn count (user msg + assistant msg per turn)
const PROCESS_LOOP_ESCAPE_HL = 20    // force walkthrough_step after ~10 turns
const WALKTHROUGH_ESCAPE_HL = 28     // force slot_completion after ~14 turns
const SLOT_COMPLETION_ESCAPE_HL = 32 // force coverage_check after ~16 turns
const COVERAGE_CHECK_ESCAPE_HL_BASE = 40  // force wrap_up after ~20 turns (2 steps)

// MAX_TURNS_HL: total history-length budget (2× turn count). Corresponds to
// COVERAGE_CHECK_ESCAPE_HL_BASE + reserveTurns×2 for farewell/wrap_up buffer.
const MAX_TURNS_HL_BASE = COVERAGE_CHECK_ESCAPE_HL_BASE + 10 // = 50 HL ≈ 25 turns

/**
 * Fix 5 (ADR-015): scale the coverage/wrap escape thresholds by the number of
 * registered steps. Each step beyond the baseline of 2 buys 6 extra HL (≈3
 * turns) so newly-discovered processes (e.g. Mahnwesen surfaced at wrap_up)
 * still get a fair walkthrough budget before the timer-based hard stop.
 *
 * Cap: never exceeds the timer-based hard stop (maxDurationMinutes drives it,
 * not historyLength), so this only matters before the timer fires.
 */
function dynamicCoverageEscapeHL(stepCount: number): number {
  const baselineSteps = 2
  const extraSteps = Math.max(0, stepCount - baselineSteps)
  const extraHL = Math.min(extraSteps * 6, 20) // cap at +10 turns
  return COVERAGE_CHECK_ESCAPE_HL_BASE + extraHL
}

function dynamicMaxTurnsHL(stepCount: number): number {
  return dynamicCoverageEscapeHL(stepCount) + 10
}

/**
 * Computes how many history-length units (HL) the current walkthrough step
 * may still consume before a forced push to slot_completion.
 *
 * @param historyLength  Current HL (2× turn count).
 * @param completedSteps Steps with status 'done' (already finished).
 * @param totalTopics    Total number of registered topics/steps.
 */
function computeStepBudget(historyLength: number, completedSteps: number, totalTopics: number): number {
  const reserveHL = 10 // 5 turns × 2 for farewell + coverage_check buffer
  const remainingBudgetHL = dynamicMaxTurnsHL(totalTopics) - historyLength - reserveHL
  const remainingSteps = Math.max(totalTopics - completedSteps, 1)
  const budgetHL = Math.floor(remainingBudgetHL / remainingSteps)
  const MIN_HL_PER_STEP = 6 // Floor: min 3 turns per step (3 turns × 2 HL)
  return Math.max(budgetHL, MIN_HL_PER_STEP)
}

/**
 * Estimates how many HL units have been spent on the current walkthrough step.
 * Derived from history: HL since phase entered walkthrough_step territory.
 * Uses PROCESS_LOOP_ESCAPE_HL as approximate walkthrough start boundary.
 */
function estimateTurnsUsedOnCurrentStep(historyLength: number, completedSteps: number): number {
  // Approximate HL consumed in walkthrough phases so far
  const walkthroughStartHL = PROCESS_LOOP_ESCAPE_HL
  const walkthroughHL = Math.max(0, historyLength - walkthroughStartHL)
  // Distribute evenly across completed steps + current step
  const totalSteps = completedSteps + 1
  return Math.floor(walkthroughHL / totalSteps)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasStepInStatus(tracker: StepEntry[], status: 'exploring' | 'walkthrough' | 'done'): boolean {
  return tracker.some((s) => s.status === status)
}

function walkthroughHasContent(tracker: StepEntry[]): boolean {
  return tracker.some(
    (s) =>
      s.status === 'walkthrough' &&
      (
        // Classic path: 3+ walkthrough data items from update_walkthrough_data
        (s.process_steps?.length ?? 0) + (s.friction_points?.length ?? 0) + (s.pain_point_primary ? 1 : 0) >= 3
        // Fallback A: at least 1 mandatory slot already filled via record_slot —
        // avoids deadlock when Analyst extracts slots directly without calling update_walkthrough_data first.
        // Fix-3 reverted: threshold back to "any slot" (>= 1) to prevent depth-first starvation.
        || MANDATORY_SLOTS.some(slot => s.slots[slot] !== null)
        // Fallback B: 2+ process_steps (orthogonally correct, kept from Fix-3)
        || (s.process_steps?.length ?? 0) >= 2
      ),
  )
}

function allStepsDone(tracker: StepEntry[]): boolean {
  if (tracker.length === 0) return false
  return !tracker.some((s) => s.status === 'exploring' || s.status === 'walkthrough')
}

// Groups semantically equivalent steps and checks whether the union of mandatory
// slots per group is complete. Uses groupSemanticSteps (single source of truth).
function semanticAllStepsDone(tracker: StepEntry[]): boolean {
  if (tracker.length === 0) return false
  return groupSemanticSteps(tracker).every(group =>
    MANDATORY_SLOTS.every(slot =>
      group.some(s => s.slots[slot] !== null)
    )
  )
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

/**
 * Deterministic wrap-up closing question. Injected verbatim by the orchestrator
 * when the interview transitions into wrap_up — replaces LLM-generated wording.
 * Constant exported so callers (route handler, eval runner) can write it as the
 * agent_response of the question-turn without invoking the Talker.
 */
export const WRAP_UP_QUESTION_TEXT =
  'Wenn du an deine letzte Arbeitswoche denkst — gibt es etwas Wiederkehrendes, das wir heute noch nicht erwähnt haben?'

/**
 * True iff the deterministic wrap-up question has been written to history.
 * Replaces the previous regex heuristic that scanned for paraphrases.
 * Match is exact (substring containment) on the constant above.
 */
export function wrapUpQuestionAlreadyAsked(
  history: { role: 'user' | 'assistant'; content: string }[],
): boolean {
  const marker = WRAP_UP_QUESTION_TEXT.slice(0, 60) // tolerate trailing decoration
  return history.some((t) => t.role === 'assistant' && t.content.includes(marker))
}

/**
 * Decision whether the next turn should be a deterministic wrap-up question
 * injection (no Talker call) or a normal Talker stream.
 *
 * Returns 'inject_question' iff:
 *   - the resolved next phase is 'wrap_up'
 *   - the deterministic question has NOT yet been written to history
 *   - the most recent message in history is a user message (we owe a response)
 */
export function shouldInjectWrapUpQuestion(
  nextPhase: ExtendedPhase,
  history: { role: 'user' | 'assistant'; content: string }[],
): boolean {
  if (nextPhase !== 'wrap_up') return false
  if (wrapUpQuestionAlreadyAsked(history)) return false
  if (history.length === 0) return false
  return history[history.length - 1].role === 'user'
}

// ─── Phase Invariants ─────────────────────────────────────────────────────────

/**
 * Asserts phase invariants at the start of each phase decision.
 * Violations are logged as warnings — no throw. Returns true if a violation
 * was detected (caller may use this to force-transition).
 */
function assertPhaseInvariants(historyLength: number, startedSteps: number, totalTopics: number): boolean {
  if (historyLength >= dynamicCoverageEscapeHL(totalTopics) - 4) {
    const expectedMin = Math.max(totalTopics - 1, 1)
    if (startedSteps < expectedMin) {
      console.warn('[INVARIANT_VIOLATION] farewell approaching, steps under-started', {
        historyLength,
        startedSteps,
        expectedMin,
        totalTopics,
      })
      return true // violation detected
    }
  }
  return false
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

  // Phase invariant check — log violation, potentially force-transition later
  const startedSteps = ctx.stepTracker.filter(s => s.status !== 'exploring').length
  const totalTopics = ctx.stepTracker.length
  const invariantViolated = assertPhaseInvariants(ctx.historyLength, startedSteps, totalTopics)

  switch (ctx.phase) {
    case 'intro':
      // Advance after first agent response (≥2 messages) — intro is a single greeting turn.
      // Previous threshold of ≥4 caused Flash 3.5 to re-greet on Turn 1 because the phase
      // stayed 'intro' while the methodology still said "Erkläre Gesprächszweck".
      return ctx.historyLength >= 2 ? 'process_loop' : 'intro'

    case 'process_loop':
      // Analyst writes exploring→walkthrough in same run, so Orchestrator reads walkthrough next turn.
      // Advance on either status — exploring = just registered, walkthrough = Analyst already progressed it.
      if (hasStepInStatus(ctx.stepTracker, 'exploring') || hasStepInStatus(ctx.stepTracker, 'walkthrough')) {
        return 'walkthrough_step'
      }
      // Escape: force walkthrough_step after ~10 turns even without a registered step.
      if (ctx.historyLength >= PROCESS_LOOP_ESCAPE_HL) return 'walkthrough_step'
      return 'process_loop'

    case 'walkthrough_step': {
      // Per-step turn budget: force push to slot_completion before walkthroughHasContent or escape.
      // Prevents depth-first starvation (B7): if agent drills one step too long, push forward.
      const completedSteps = ctx.stepTracker.filter(s => s.status === 'done').length
      const turnsUsed = estimateTurnsUsedOnCurrentStep(ctx.historyLength, completedSteps)
      const budget = computeStepBudget(ctx.historyLength, completedSteps, Math.max(totalTopics, 1))
      if (turnsUsed >= budget) return 'slot_completion'

      // Invariant violation: farewell approaching, force forward regardless of step state
      if (invariantViolated) return 'slot_completion'

      // Walkthrough content threshold reached → move to slot_completion
      if (walkthroughHasContent(ctx.stepTracker)) return 'slot_completion'
      // No active steps remaining → also move to slot_completion
      if (!hasStepInStatus(ctx.stepTracker, 'exploring') && !hasStepInStatus(ctx.stepTracker, 'walkthrough') && ctx.stepTracker.length > 0) {
        return 'slot_completion'
      }
      // Escape: force slot_completion after ~14 turns to prevent infinite walkthrough loop.
      if (ctx.historyLength >= WALKTHROUGH_ESCAPE_HL) return 'slot_completion'
      return 'walkthrough_step'
    }

    case 'slot_completion': {
      if (!semanticAllStepsDone(ctx.stepTracker)) {
        if (ctx.historyLength >= SLOT_COMPLETION_ESCAPE_HL) return 'coverage_check'
        return 'slot_completion'
      }
      if (hasUnexploredFocusTopic(ctx.topicsOpen, ctx.stepTracker)) return 'process_loop'
      return 'coverage_check'
    }

    case 'coverage_check':
      if (semanticAllStepsDone(ctx.stepTracker)) return 'wrap_up'
      if (ctx.historyLength >= dynamicCoverageEscapeHL(totalTopics)) return 'wrap_up'
      return 'coverage_check'

    case 'wrap_up': {
      // Skip push-back once escape valve has already fired — committed to wrap_up.
      // Without this guard, the push-back defeats the coverage_check escape valve:
      // wrap_up → walkthrough_step → slot_completion → coverage_check → wrap_up → ∞
      const escapeAlreadyFired = ctx.historyLength >= dynamicCoverageEscapeHL(totalTopics)
      // Only push back if there are genuinely uncovered semantic groups (not just fragmented duplicates)
      if (!escapeAlreadyFired && !semanticAllStepsDone(ctx.stepTracker)) {
        if (hasStepInStatus(ctx.stepTracker, 'exploring')) return 'walkthrough_step'
        if (hasStepInStatus(ctx.stepTracker, 'walkthrough')) return 'slot_completion'
      }

      // Trigger B: deterministic check — the orchestrator-injected wrap-up
      // question must be present in history. wrap_up_question_asked flag from
      // Analyst is no longer trusted (was fragile; Analyst could lie or forget).
      const questionAsked = wrapUpQuestionAlreadyAsked(ctx.history)

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
    // Don't complete if genuinely new (uncovered) steps exist — but fragmented duplicates are fine
    if (!semanticAllStepsDone(ctx.stepTracker) &&
        (hasStepInStatus(ctx.stepTracker, 'exploring') || hasStepInStatus(ctx.stepTracker, 'walkthrough'))) {
      return { shouldComplete: false, reason: null }
    }

    const questionAsked = wrapUpQuestionAlreadyAsked(ctx.history)

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
