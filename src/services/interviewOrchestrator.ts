import { type Phase, type StepEntry, type OSlotField, countFilledOFields, O_SLOT_FIELDS, isOFieldFilled } from './interviewSemantic'
import type { AnalystBriefing, ClarificationCard, ODroughtState, TransitionReason } from './interviewTypes'
import { computeClarificationCards } from './clarificationCards'

export type { TransitionReason }

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrchestratorContext {
  phase: Phase
  stepTracker: StepEntry[]
  timerMinutes: number
  maxDurationMinutes: number
  /** Total number of messages in history including the current user turn */
  historyLength: number
  /**
   * PROJ-46 (ADR-023 D4): true iff the tracker's total filled-O2–O6-field count
   * grew this turn (interviewSemantic.ts's hasNewOField, diffed pre- vs.
   * post-Analyst — see runInterviewTurn.ts) — generalizes the former
   * newStepThisTurn veto (a new step always applies a register_step) to
   * "existing content deepened, even on an already-registered step". Used by
   * the Closing→Explore M7-b reentry. PROJ-46 QA H-1 Fix D: narrowed from "any
   * applied knowledge-tool write" (interviewAnalyst.ts's former
   * hasAppliedExtraction) — that fired on re-records/potenzial-only/floskel
   * writes too, bouncing Closing back to Explore almost every turn and starving
   * the no-new-extraction streak of the consecutive closing turns it needs to
   * reach its limit.
   */
  hadExtractionThisTurn: boolean
  /**
   * PROJ-44 Remediation (M-1/M-3): this turn's fresh O-Drought state (after
   * updateODrought ran inside the synchronous Analyst pass) — read by
   * hasUnexhaustedStep to decide whether explore→closing is still premature.
   */
  oDrought: ODroughtState
}

export interface TurnLifecycle {
  phase: Phase
  complete: boolean
  reason: 'hard_stop' | 'soft_confirm' | null
  /**
   * PROJ-43 (AC4/AC5): the turn's final, deterministically-computed Card list —
   * only set when phase='clarification'. The caller (runInterviewTurn.ts)
   * persists this into interviews.next_briefing.clarification_cards; this
   * function itself never touches the DB (pure, ADR-018/022).
   */
  clarificationCards?: ClarificationCard[]
}

/**
 * PROJ-42 (KI-23 fix): the previous turn-count escalation ladder
 * (computeTurnBudget: 40/56/64/80% thresholds across six phases) was
 * content-blind and the root cause of the Tim bug — it escalated after ~9
 * turns regardless of how much had actually been covered. Replaced by signals
 * within a single 'explore' phase:
 *   1. Content-driven: the Analyst's stepAdvanceReady signal + tracker-derived
 *      O-Drought exhaustion check.
 *   2. PROJ-46/ADR-024 (B/C): the Analyst's own discovery_exhausted Readiness
 *      judgment (Coverage-Sanity-guarded) — replaces the former deterministic
 *      no-new-extraction streak counter, which was breadth-blind and produced
 *      a K-turn Farewell-Loop once the Analyst had already judged itself done.
 *   3. Upper bound: a wall-clock soft anchor at ~80% of the interview's time
 *      budget (protects the interviewee's agreed time, not conversation
 *      quality — that's discovery_exhausted's job).
 * "Whichever comes first" between content-driven readiness and the soft
 * anchor decides the move to 'closing'.
 */
const SOFT_ANCHOR_RATIO = 0.8
const MAX_GRACE_MINUTES = 3
const DEFAULT_O_DROUGHT_LIMIT = 3
/**
 * PROJ-46/ADR-024 (B/C, D3 Coverage-Sanity): the Analyst's discovery_exhausted
 * Readiness is only honored once at least one registered step has been
 * substantially drilled — guards against an empty/barely-started interview
 * completing on a premature Readiness judgment ("nie leer abschließen").
 */
const MIN_SUBSTANTIAL_O_FIELDS = 2

/**
 * PROJ-44 Remediation (M-1/M-3): consecutive turns without a new O-field for the
 * locked step before its drought fires. Eval-tunable via O_DROUGHT_LIMIT env var
 * — measure-first, no fixed threshold.
 */
function oDroughtLimit(): number {
  const env = Number(process.env.O_DROUGHT_LIMIT)
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_O_DROUGHT_LIMIT
}

/**
 * PROJ-46/ADR-024 (B/C, D3): Coverage-Sanity guard for discovery_exhausted —
 * see MIN_SUBSTANTIAL_O_FIELDS above.
 */
function hasSubstantialCoverage(stepTracker: StepEntry[]): boolean {
  return stepTracker.some((s) => countFilledOFields(s) >= MIN_SUBSTANTIAL_O_FIELDS)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasStepInStatus(tracker: StepEntry[], status: 'exploring' | 'walkthrough' | 'done'): boolean {
  return tracker.some((s) => s.status === status)
}

/**
 * PROJ-46 (ADR-023 D3): a step is exhausted independent of its drought streak
 * once every O2–O6 field is filled (value OR nicht_befund_typ — same threshold
 * countFilledOFields uses). Without this, a step whose 7th field fills on the
 * SAME turn its streak resets to 0 stays locked for up to K more turns with no
 * empty field left to target (flat circling). Shared by computeFocusLock
 * (which step to lock) and hasUnexhaustedStep (is Explore still premature).
 */
function isFullyCovered(step: StepEntry): boolean {
  return countFilledOFields(step) >= O_SLOT_FIELDS.length
}

/**
 * PROJ-44 Remediation (M-3 Fokus-Lock): determines which registered, non-done
 * step's question-direction is "locked" for this turn — computed from the
 * tracker + the previous turn's persisted drought state, BEFORE the
 * synchronous Analyst runs (so it can steer target_o_field). A step whose
 * drought already fired, or whose O2–O6 coverage is already complete
 * (PROJ-46/ADR-023 D3), is never re-locked; the lock advances to the next
 * non-exhausted step. Returns stepId=null when nothing is lockable (empty
 * tracker, or every step done/exhausted).
 */
export function computeFocusLock(stepTracker: StepEntry[], previous: ODroughtState | null): ODroughtState {
  const limit = oDroughtLimit()
  const exhausted = new Set(previous?.exhaustedStepIds ?? [])
  if (previous?.stepId != null && previous.streak >= limit) exhausted.add(previous.stepId)
  for (const s of stepTracker) {
    if (s.id != null && s.status !== 'done' && isFullyCovered(s)) exhausted.add(s.id)
  }

  const candidates = stepTracker.filter((s) => s.status !== 'done' && s.id != null && !exhausted.has(s.id))
  if (candidates.length === 0) {
    return { stepId: null, streak: 0, exhaustedStepIds: [...exhausted] }
  }

  const stillLocked = previous?.stepId != null ? candidates.find((s) => s.id === previous.stepId) : undefined
  // PROJ-48 (KI-29, revidiert): bei fehlendem fortführbaren Lock (Bootstrap oder
  // vorheriger Lock gerade erschöpft/done) wird der erste noch offene Kandidat in
  // Tracker-/Registrierungsreihenfolge gewählt. Die frühere
  // pickMostSalientCandidate-Heuristik (am-meisten-abgedeckt zuerst) zog in die
  // falsche Richtung — sie ließ frisch genannte 0-Feld-Schritte warten und brachte
  // keinen belegten Nutzen. Start-/Relevanz-Ordering bleibt bewusst PROJ-49
  // vorbehalten. Der updateODrought-Bootstrap-Recompute (Talker-Ziel-Block ab
  // Turn 1) bleibt davon unberührt.
  const locked = stillLocked ?? candidates[0]

  return {
    stepId: locked.id ?? null,
    streak: stillLocked ? (previous?.streak ?? 0) : 0,
    exhaustedStepIds: [...exhausted],
  }
}

/**
 * PROJ-46 (ADR-023 D1): deterministic fallback for the Analyst's
 * target_o_field when the LLM omits it — the first still-open O2–O6 field of
 * the locked step, in O_SLOT_FIELDS order. Pure, injected into
 * interviewAnalyst.ts's runAnalyst (ballast-avoidance, same pattern as
 * updateODrought). Returns null when there is no locked step or it's already
 * fully covered (D3 would have already advanced the lock past it).
 */
export function computeTargetOFieldFallback(step: StepEntry | undefined): OSlotField | null {
  if (!step) return null
  return O_SLOT_FIELDS.find((f) => !isOFieldFilled(step, f)) ?? null
}

/**
 * PROJ-46 (ADR-023 D1): why the Talker's binding target changed this turn —
 * code-computed, per-turn ephemeral (never persisted). closing_entry takes
 * priority: on the turn Explore first resolves into Closing there is no
 * locked step to compare against, and it is unambiguously a transition.
 */
export function computeTransitionReason(
  previousLockedStepId: string | null,
  currentLockedStepId: string | null,
  previousPhase: Phase,
  resolvedPhase: Phase,
): TransitionReason {
  if (previousPhase !== 'closing' && resolvedPhase === 'closing') return 'closing_entry'
  if (currentLockedStepId != null && currentLockedStepId !== previousLockedStepId) return 'step_switch'
  return null
}

/**
 * PROJ-44 Remediation (M-1/M-3): post-Analyst update of the locked step's
 * drought streak — did it gain a new O2–O6 field THIS turn? Resets on
 * progress, increments on drought. `beforeTracker` is the tracker as loaded at
 * turn start (pre-Analyst); `afterTracker` is the Analyst's committed result.
 * `lock` is this turn's computeFocusLock result (its streak is the carried-over
 * starting point — already reset to 0 if the lock just switched to a new step).
 */
export function updateODrought(lock: ODroughtState, beforeTracker: StepEntry[], afterTracker: StepEntry[]): ODroughtState {
  // PROJ-48 (KI-29): previously returned `lock` unchanged here, silently
  // carrying a null stepId forward even when the Analyst just registered one
  // or more steps THIS turn (the common bootstrap-turn case — an employee's
  // first substantial answer often names 2+ recurring tasks at once). That
  // left this turn's Talker call without a Ziel-Block (buildZielBlock renders
  // nothing for a null focusStepId) and delayed the lock by a turn. Re-running
  // computeFocusLock against the now-populated afterTracker establishes a real
  // lock (first candidate in registration order — PROJ-48 revidiert, kein
  // pickMostSalient mehr) in the same turn the steps appear. Note: this only
  // touches the null-lock branch; the streak logic below is unchanged.
  if (lock.stepId == null) return computeFocusLock(afterTracker, lock)
  const before = beforeTracker.find((s) => s.id === lock.stepId)
  const after = afterTracker.find((s) => s.id === lock.stepId)
  const beforeCount = before ? countFilledOFields(before) : 0
  const afterCount = after ? countFilledOFields(after) : beforeCount
  const progressed = afterCount > beforeCount
  return { ...lock, streak: progressed ? 0 : lock.streak + 1 }
}

/**
 * PROJ-44 Remediation (M-1): replaces the removed hasUnexploredFocusTopic
 * breadth check — "gibt es einen registrierten Prozess, der qualitativ noch
 * nicht erschöpft ist?" (tracker-derived, not topicsOpen-derived). `lock` must
 * be this turn's POST-update O-Drought state (after updateODrought ran).
 * PROJ-46 (ADR-023 D3): a step whose O2–O6 coverage is already complete
 * counts as exhausted here too, independent of its streak — mirrors
 * computeFocusLock's isFullyCovered check so the two never disagree.
 */
function hasUnexhaustedStep(stepTracker: StepEntry[], lock: ODroughtState): boolean {
  const limit = oDroughtLimit()
  const exhausted = new Set(lock.exhaustedStepIds)
  if (lock.stepId != null && lock.streak >= limit) exhausted.add(lock.stepId)
  return stepTracker.some((s) => s.status !== 'done' && !exhausted.has(s.id ?? '') && !isFullyCovered(s))
}

/**
 * PROJ-48 (KI-30-Verengung): ein Schritt ist "unexplored", wenn er GAR KEIN
 * O2–O6-Feld hat (countFilledOFields === 0) — mentioned-but-never-explored.
 * Ersetzt hasUnexhaustedStep an den beiden KI-30-Stellen (explore→closing-Gate
 * + closing→explore-Reentry): hasUnexhaustedStep (= nicht voll 10/10) war zu
 * breit — bei 4–6 einzeln abgearbeiteten Prozessen fast immer true, wodurch das
 * Interview nie sauber schließen konnte (Verabschiedungs-Schleife/Reopening).
 * Diese Fassung fängt weiterhin den ursprünglichen 0/10-Steamroll (Schritt
 * registriert + nur ein Potenzial-Feld wie frequency → walkthrough, 0 O-Felder),
 * blockiert aber nicht wegen teil-abgedeckter Schritte. Ausgetrocknete Schritte
 * sind ausgenommen (gleiche exhausted-Behandlung wie hasUnexhaustedStep): ein
 * Schritt, der 3 Turns lang 0 O-Felder liefert, darf den Abschluss nicht ewig
 * blockieren.
 */
function hasUnexploredStep(stepTracker: StepEntry[], lock: ODroughtState): boolean {
  const limit = oDroughtLimit()
  const exhausted = new Set(lock.exhaustedStepIds)
  if (lock.stepId != null && lock.streak >= limit) exhausted.add(lock.stepId)
  return stepTracker.some((s) => s.status !== 'done' && !exhausted.has(s.id ?? '') && countFilledOFields(s) === 0)
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Phase-transition sub-step of resolveTurnLifecycle (ehem. decideNextPhase).
 * Never returns a terminal verdict itself — the 'closing' case only decides
 * whether this turn re-enters Explore (late-discovery reentry) or stays in
 * Closing; whether staying in Closing also means completing THIS turn is
 * decided once, by resolveTurnLifecycle, against this function's result
 * (ADR-022 D1 — the fix for H-3/BUG-6: the old checkLifecycle evaluated
 * against ctx.phase, the Vorturn value, instead of this resolved target).
 */
function resolvePhaseTransition(ctx: OrchestratorContext, analystSuggestion: AnalystBriefing | null): Phase {
  switch (ctx.phase) {
    case 'intro':
      // Advance after first agent response (≥2 messages) — intro is a single greeting turn.
      return ctx.historyLength >= 2 ? 'explore' : 'intro'

    case 'explore': {
      // PROJ-46 QA H-1 Fix A: was hasStepInStatus(...'exploring') || hasStepInStatus(...'walkthrough')
      // — raw status, which practically never leaves 'exploring'/'walkthrough' (the
      // applyIntent.ts auto-'done' transition requires EVERY potenzial slot filled
      // too, including the two optional ones — the KI-23 "praktisch nie true"
      // condition). That nailed the soft-anchor grace window open even for a step
      // whose O2–O6 coverage was already exhausted. Coupled to the same exhaustion
      // logic the Fokus-Lock already uses (hasUnexhaustedStep: isFullyCovered OR
      // drought-fired) so an O-exhausted step actually releases the grace window
      // instead of buying up to MAX_GRACE_MINUTES more explore time it doesn't need.
      const hasActiveStep = hasUnexhaustedStep(ctx.stepTracker, ctx.oDrought)

      // Wall-clock soft anchor (~80% of budget): "whichever comes first" between
      // content coverage and the anchor. Deliberately content-blind (that's
      // discovery_exhausted's job below) — protects the interviewee's agreed
      // time budget, not conversation quality.
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

      // PROJ-46/ADR-024 (B/C, D1/D2): the Analyst's own Completion-Readiness
      // judgment ("discovery is exhausted, nothing substantial left") may open
      // Closing directly — replaces the former no-new-extraction streak safety
      // net, which was breadth-blind and K-turn-delayed (QA-Runde 2's Farewell-
      // Loop). Coverage-Sanity-guarded so it can never fire on an empty/barely-
      // started interview. This turn's ctx.phase is still 'explore' here, so
      // resolveTurnLifecycle's terminal check below can never complete on the
      // SAME turn Closing opens — at least one more discovery question is
      // always asked first (the D2 guarantee).
      // PROJ-48 (KI-30, verengt): hasSubstantialCoverage allein verlangt nur EINEN
      // Schritt mit ≥2 O-Feldern — ein diesen Turn registrierter 0-Feld-Schritt
      // könnte daneben in Closing gesteamrollt werden. Der Veto prüft daher, dass
      // KEIN Schritt komplett unerkundet (0 O-Felder) ist. Ursprünglich (fälschlich)
      // hasUnexhaustedStep (= nicht voll 10/10) — das blockierte den Abschluss bei
      // mehreren teil-abgedeckten Prozessen dauerhaft; hasUnexploredStep trifft die
      // KI-30-Absicht ("kein Schritt mit null Inhalt") ohne diesen Treadmill.
      if (
        analystSuggestion?.discovery_exhausted === true
        && hasSubstantialCoverage(ctx.stepTracker)
        && !hasUnexploredStep(ctx.stepTracker, ctx.oDrought)
      ) {
        return 'closing'
      }

      // Primary driver — content-based advance: the active process is judged
      // sufficiently explored (Analyst signal) AND no registered step remains
      // qualitatively unexhausted (PROJ-44 Remediation M-1: tracker-derived
      // O-Drought check, replaces the removed topicsOpen-based
      // hasUnexploredFocusTopic — depth and breadth collapse into one
      // criterion). Advance-signal alone (an unexhausted step remains) keeps
      // Explore running.
      const stepAdvanceReady = analystSuggestion?.step_advance_ready === true
      if (stepAdvanceReady && !hasUnexhaustedStep(ctx.stepTracker, ctx.oDrought)) {
        return 'closing'
      }

      return 'explore'
    }

    case 'closing': {
      // A newly-discovered process during Closing is first-class — back to
      // Explore in full (no more 2-turn clarification-only cap for late finds).
      // PROJ-46 (ADR-023 D4, M7-b): hadExtractionThisTurn generalizes the
      // former newStepThisTurn veto — a new step always applies a
      // register_step, so this subsumes it — to ANY applied knowledge write
      // this turn, not just a brand-new step.
      // PROJ-48 (KI-30, verengt): hasStepInStatus('exploring') fängt einen Schritt
      // nur im exakten Registrierungs-Turn — ein einziges gefülltes Slot (auch ein
      // Potenzial-Feld wie frequency) kippt ihn sofort auf 'walkthrough'
      // (applyIntent.ts:219), und hadExtractionThisTurn zählt nur O2–O6-Wachstum,
      // keine Potenzial-Schreibungen. Ein Schritt, der diesen Turn an beiden vorbei
      // rutschte, blieb unerkundet, während die Phase 'closing' blieb (realer Fall:
      // buchhalter "Mahnlauf", registriert + frequency-gefüllt im selben Turn,
      // Interview im selben Turn mit 0/10 O-Feldern abgeschlossen). hasUnexploredStep
      // (= irgendein Schritt mit 0 O-Feldern) fängt genau diesen Fall. Vorher stand
      // hier hasUnexhaustedStep (= nicht voll 10/10) — zu breit: das warf jeden
      // ruhigen Verabschiedungs-Turn zurück nach explore, solange irgendein Prozess
      // nicht vollständig abgedeckt war (Verabschiedungs-Schleife/Reopening). Dieser
      // Check sichert transitiv auch resolveTurnLifecycles readyToComplete unten ab
      // — der läuft nur, wenn dieser Case 'closing' zurückgibt.
      if (hasStepInStatus(ctx.stepTracker, 'exploring') || ctx.hadExtractionThisTurn || hasUnexploredStep(ctx.stepTracker, ctx.oDrought)) return 'explore'
      return 'closing'
    }

    case 'clarification':
      // Stays until all clarification answers written (checked by route handler via DB).
      return 'clarification'

    default:
      return ctx.phase
  }
}

/**
 * The interview turn's single lifecycle decision: which phase to write to
 * interview_state, and whether the interview completes this turn — resolved
 * once, against one fresh snapshot (ADR-022 D1, merging the former
 * decideNextPhase + decideNextPhaseWithMeta + checkLifecycle).
 *
 * PROJ-44/ADR-021: reads state INCLUDING the current turn — the synchronous
 * Analyst (interviewAnalyst.ts's runAnalyst) has already run against this
 * turn's userInput by the time runInterviewTurn.ts calls this, so
 * ctx.stepTracker and analystSuggestion reflect this turn, not the end of the
 * previous one.
 *
 * ADR-022 (H-3/BUG-6 fix): the terminal (complete/reason) verdict is decided
 * exactly once, against the RESOLVED phase from this turn's transition — not
 * against ctx.phase (the Vorturn value the old two-function split used for
 * checkLifecycle's Trigger B). A turn whose transition resolves explore→closing
 * with the probe already answered (late-discovery reentry re-converging) can
 * therefore complete in the SAME turn instead of one Leerlauf-turn later.
 *
 * D2 invariant: `complete:true` with reason:'soft_confirm' is only reachable
 * when the resolved phase is 'closing' — intro/explore/clarification can never
 * soft-confirm-complete. Only hard_stop (Trigger A) is phase-agnostic.
 *
 * PROJ-42: the previous phase-agnostic farewell-loop escape valve (regex
 * FAREWELL_MARKERS string matching) is removed entirely — termination is
 * deterministic in state, not guessed from text heuristics (KI-23).
 *
 * PROJ-46 (ADR-023 D4): the closing terminal evaluation no longer depends on
 * a scripted probe having been asked+answered (that whole injection machinery
 * — CLOSING_PROBE_TEXT/shouldInjectClosingProbe/closingProbeAnswerReceived —
 * is deleted). Closing is now a Talker-formulated discovery continuation.
 *
 * PROJ-46/ADR-024 (B/C, D2/D4): completion binds to ctx.phase (the phase
 * LOADED at turn start) already being 'closing' AND the Analyst's own
 * discovery_exhausted Readiness judgment (Coverage-Sanity-guarded) — replaces
 * the former no-new-extraction streak, which was breadth-blind and reliably
 * produced a K-turn Farewell-Loop once the Analyst had already judged itself
 * done (QA-Runde 2). The explore→closing ENTRY turn therefore always has
 * ctx.phase==='explore' and can never soft-confirm-complete on the same
 * turn — it always asks at least one more discovery question first.
 *
 * Fail-safe: runInterviewTurn.ts vetoes a soft_confirm result when the
 * synchronous Analyst call failed this turn (ADR-021 D4) — hard_stop is
 * unconditional and proceeds regardless.
 */
export function resolveTurnLifecycle(ctx: OrchestratorContext, analystSuggestion: AnalystBriefing | null): TurnLifecycle {
  // Trigger A — Hard-Stop: unconditional, phase-agnostic, last resort. Still
  // produces a coherent, LLM-formulated farewell (runInterviewTurn.ts's
  // isCompletionFarewell path) — never a raw abort or system message.
  // ADR-022 (Nutzer-Korrektur): never skips already-generated clarification
  // cards — they carry the quantitative ROI slots — so a pending-cards turn
  // routes to 'clarification' instead of completing out from under them.
  //
  // KI-36 (fix relocated to talkerPrompt.ts): the turn that pins
  // phase='clarification' + cards must always read as a clean farewell, never
  // a further open question the frontend then makes unanswerable
  // (ChatInterface.tsx's checkCompleted swaps to the TransitionPrompt as soon
  // as it sees phase==='clarification' WITH cards — whatever the Talker just
  // asked has no reply box left). That's enforced unconditionally in
  // talkerPrompt.ts's buildPhaseMethodology (the former hasExploringSteps
  // "late topic" branch, which could ask 1–2 more questions here, is removed
  // — see that file for the rationale). This function's job stays unchanged:
  // decide phase/cards from the tracker, nothing turn-count- or grace-based.
  if (ctx.timerMinutes >= ctx.maxDurationMinutes) {
    const cards = computeClarificationCards(ctx.stepTracker, analystSuggestion?.clarification_cards)
    if (cards.length > 0) {
      return { phase: 'clarification', complete: false, reason: null, clarificationCards: cards }
    }
    return { phase: 'closing', complete: true, reason: 'hard_stop' }
  }

  const target = resolvePhaseTransition(ctx, analystSuggestion)

  // Terminal evaluation — GENAU EINMAL, against the resolved phase. A reentry
  // out of Closing (target !== 'closing') falls through to the plain return
  // below — no separate "don't complete out from under it" check needed, since
  // a non-closing target can never complete (D2).
  if (target === 'closing') {
    const readyToComplete = ctx.phase === 'closing'
      && analystSuggestion?.discovery_exhausted === true
      && hasSubstantialCoverage(ctx.stepTracker)
    if (readyToComplete) {
      const cards = computeClarificationCards(ctx.stepTracker, analystSuggestion?.clarification_cards)
      if (cards.length > 0) {
        return { phase: 'clarification', complete: false, reason: null, clarificationCards: cards }
      }
      return { phase: 'closing', complete: true, reason: 'soft_confirm' }
    }
    // Fresh entry into Closing, OR the Analyst hasn't judged discovery
    // exhausted yet — the Talker asks another freshly-formulated discovery
    // question (ADR-023 D4).
    return { phase: 'closing', complete: false, reason: null }
  }

  return { phase: target, complete: false, reason: null }
}
