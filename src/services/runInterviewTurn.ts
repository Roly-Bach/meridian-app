/**
 * runInterviewTurn — deep module for the interview turn loop (PROJ-33 / ADR-016,
 * timing flipped by PROJ-44 / ADR-021).
 *
 * Encapsulates the complete per-turn logic:
 *   load → role-guard → SYNCHRONOUS analyst → orchestrate → wrap-up-inject | talker-stream
 *
 * ADR-021 (Timing-Amendment): the Analyst (interviewAnalyst.ts's runAnalyst) now
 * runs synchronously, once per turn, BEFORE the phase/completion decision and
 * before the Talker — not after/parallel to the Talker as ADR-011 D2 had it.
 * `resolveTurnLifecycle` (ADR-022 merged the former `checkLifecycle`+
 * `decideNextPhaseWithMeta` into one call) therefore reads state INCLUDING the
 * current turn, not "end of previous turn". The old two-stage `soft_confirm`
 * recheck (KI-12) and the pre-Talker Quick-Extract (interviewQuickExtract.ts)
 * are gone — the single synchronous Analyst pass subsumes both.
 *
 * PROJ-46 (ADR-023): the closing-probe injection branch is gone — Closing is a
 * Talker-formulated discovery continuation now, no scripted probe turn.
 *
 * The Prod Route and the Eval Runner are thin adapters around this function.
 * Neither `import { after } from 'next/server'` belongs here — `after()` remains
 * the Prod adapter's concern, wrapping the returned `finalize()`.
 *
 * PROJ-34 / ADR-018: persistence is injected via `ports`. `runInterviewTurn`
 * never touches `getSupabaseAdmin()` directly — all loads, the turns-insert and
 * the interview_state/interviews updates go through `ports.store`. The
 * post-response derivation (`onCompleted`) and per-turn `extractAndEmbed` are
 * injected too: Prod = real, Eval = no-op. Default `ports` are the prod
 * Supabase store + real pipeline (lazy-imported so the eval/tsx graph stays clean).
 */

import {
  normalizeStepEntry,
  hasNewOField,
  type Phase,
  type StepEntry,
  type RawExtraction,
} from '@/services/interviewSemantic'
import type { TurnMessage, AnalystBriefing } from '@/services/interviewTypes'
import {
  resolveTurnLifecycle,
  computeFocusLock,
  updateODrought,
  computeTargetOFieldFallback,
  computeTransitionReason,
  type OrchestratorContext,
} from '@/services/interviewOrchestrator'
import { checkRoleGuard } from '@/services/roleGuard'
import { createTalkerStream, createOffTopicRedirectStream } from '@/services/interviewTalker'
import { runAnalyst, type AnalystRunResult } from '@/services/interviewAnalyst'
import type { InterviewStore } from '@/services/turnStore/port'
import type { OnTokenUsage } from '@/services/_telemetry'

// ─── Ports ─────────────────────────────────────────────────────────────────────

interface ExtractAndEmbedArgs {
  interviewId: string
  workspaceId: string
  turnId: string
  userInput: string
}

export interface RunTurnPorts {
  /** Persistence: loads + orchestration writes + per-pass session store. */
  store: InterviewStore
  /** Per-turn knowledge extraction + embedding. Prod = real; Eval = no-op (returns []). */
  extractAndEmbed: (args: ExtractAndEmbedArgs) => Promise<RawExtraction[]>
  /** Post-response derivation pipeline. Prod = real; Eval = no-op. */
  onCompleted: (args: { interviewId: string; workspaceId: string }) => Promise<void>
}

/**
 * Default prod ports — lazy-imported so the eval (tsx) path never pulls the
 * Supabase store or the embedding/clustering pipeline unless it is actually used.
 *
 * Only ever invoked when the caller passes no `ports` — in practice that's just
 * `chat/route.ts`. The eval runner always injects its own ports (evalStore.ts),
 * so this function (and everything it dynamically imports) never runs there.
 * The dynamic import() enforces this at the module-loading level too: a static
 * top-level import would pull supabaseTurnStore.ts (which declares itself
 * "Never imported by the eval (tsx) path") into the eval process's module graph
 * merely by importing this file, regardless of whether this function is called.
 */
async function defaultProdPorts(): Promise<RunTurnPorts> {
  const [{ createSupabaseInterviewStore }, extraction, enrichment, clustering] = await Promise.all([
    import('@/services/turnStore/supabaseTurnStore'),
    import('@/services/extraction'),
    import('@/services/processEnrichment'),
    import('@/services/processClustering'),
  ])
  return {
    store: createSupabaseInterviewStore(),
    extractAndEmbed: (args) => extraction.extractAndEmbed(args),
    onCompleted: async ({ interviewId, workspaceId }) => {
      await enrichment.createProcessStepsFromTracker({ interviewId, workspaceId })
      clustering.clusterProcessSteps(workspaceId).catch((err) =>
        console.error('[runInterviewTurn] clusterProcessSteps failed:', err),
      )
      extraction.deduplicateKnowledgeObjects(workspaceId).catch((err) =>
        console.error('[runInterviewTurn] deduplicateKnowledgeObjects failed:', err),
      )
    },
  }
}

// ─── Public interface ─────────────────────────────────────────────────────────

/**
 * Narrow stream interface that both the real `streamText` result and the
 * wrap-up shim satisfy. Typed this way to avoid leaking `StreamTextResult`
 * into the adapter boundary.
 */
export interface TurnStream {
  toTextStreamResponse: () => Response
  /** PromiseLike so real StreamTextResult and the wrap-up shim both satisfy this. */
  text: PromiseLike<string>
}

// chat/route.ts (prod) never supplies OnTokenUsage — only the eval runner does, for
// per-run cost aggregation. Not dead: it's the Ports pattern working as intended
// (one optional field, unused by one of two callers).

export interface RunTurnInput {
  interviewId: string
  userInput: string
  /** Elapsed time in minutes since the first turn. Prod computes from `created_at`; Eval simulates. */
  timerMinutes: number
  /** Optional Langfuse trace context — merged into every LLM-call telemetry. */
  traceCtx?: Record<string, unknown>
  onTokenUsage?: OnTokenUsage
}

export interface TurnMeta {
  phase: Phase
  completed: boolean
  reason: 'hard_stop' | 'soft_confirm' | null
  stepTracker: StepEntry[]
  /** The synchronous Analyst's result this turn — null when it didn't run (off_topic) or failed terminally (ADR-021 D4). */
  analyst: AnalystRunResult | null
}

export interface TurnResult {
  stream: TurnStream
  /** Post-response derivation: extractAndEmbed + onCompleted (ADR-021 D5). Prod: `after(() => turn.finalize())`. Void — the Analyst already ran synchronously above; `meta.analyst` carries its result. */
  finalize: () => Promise<void>
  /** Only consumed by the eval runner (turnResult.meta.phase/.completed/.analyst) — chat/route.ts ignores it. */
  meta: TurnMeta
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEED_FILLERS = [
  'Das ist ein', 'Das ist eine', 'Das klingt', 'Das macht',
  'Vielen Dank', 'Danke', 'Ich danke', 'Sehr gut',
  'Interessant', 'Gut,', 'Alles klar',
]

/** No-op finalize for turns that never reached the Talker (nothing to extract/complete). */
async function noopFinalize(): Promise<void> {}

// Bounded retry for the synchronous Analyst call (ADR-021 D4) — same shape as
// the roleGuard/talkerGroundingGuard judge-call retries elsewhere in this codebase.
const ANALYST_RETRIES = 1
const ANALYST_RETRY_DELAY_MS = 300

// ─── Core function ────────────────────────────────────────────────────────────

export async function runInterviewTurn(input: RunTurnInput, ports?: RunTurnPorts): Promise<TurnResult> {
  const { interviewId, userInput, timerMinutes, traceCtx } = input
  const p = ports ?? (await defaultProdPorts())
  const { store } = p

  // ── Load interview row ──────────────────────────────────────────────────────
  const interview = await store.loadInterview(interviewId)
  if (!interview) {
    throw new Error(`runInterviewTurn: interview ${interviewId} not found`)
  }

  // ── Load state + turns ──────────────────────────────────────────────────────
  const [state, existingTurns] = await Promise.all([
    store.loadState(interviewId),
    store.loadTurns(interviewId),
  ])

  const currentPhase = (state?.phase ?? 'intro') as Phase
  let stepTracker: StepEntry[] = ((state?.step_tracker as unknown[] | null) ?? [])
    .map((raw, i) => normalizeStepEntry(raw, i + 1))
  // PROJ-44 Remediation (H-1/M-3): the tracker exactly as loaded, before the
  // synchronous Analyst runs — the baseline hasNewStepThisTurn/computeFocusLock
  // diff against (stepTracker itself gets reassigned to the Analyst's result below).
  const preTurnTracker = stepTracker
  const nextTurnNumber = existingTurns.length + 1
  const currentLog = (state?.extractions_log as RawExtraction[] | null) ?? []

  // ── Build history including current user turn ───────────────────────────────
  const history: TurnMessage[] = existingTurns.flatMap((t) => [
    { role: 'user' as const, content: t.user_input },
    { role: 'assistant' as const, content: t.agent_response },
  ])
  // B2: opener_text is saved to interview_state (not as a DB turn) — inject it as the
  // first assistant message so the Talker doesn't re-greet the interviewee.
  if (existingTurns.length === 0 && state?.opener_text) {
    history.unshift({ role: 'assistant' as const, content: state.opener_text as string })
  }
  history.push({ role: 'user', content: userInput })

  const resolvedTraceCtx = traceCtx ?? { interviewId, environment: 'prod' as const }

  // ── Role Guard (PROJ-42 / KI-24) ────────────────────────────────────────────
  // Earliest gate, phase-agnostic — runs before the synchronous Analyst. Class
  // off_topic ends the turn here: the Analyst never runs for this turn, the
  // Talker call is skipped, and the stored interview state (phase, stepTracker,
  // topics) is left completely unchanged.
  const talkerModelString = process.env.INTERVIEW_TALKER_MODEL ?? process.env.INTERVIEW_MODEL ?? 'google/gemini-3.1-flash-lite'
  const roleGuard = await checkRoleGuard(userInput, history, talkerModelString, traceCtx, input.onTokenUsage)
  if (roleGuard.classification === 'off_topic') {
    // PROJ-46 (ADR-023 D6): the redirect wording is now Talker-formulated (a
    // schlanker call, no buildDynamicContext/grounding guard/filler tracking)
    // instead of a fixed string — state stays unaffected, off_topic still
    // short-circuits before the Analyst.
    const redirectStream = await createOffTopicRedirectStream({
      interviewId,
      history,
      traceCtx: resolvedTraceCtx,
      onTokenUsage: input.onTokenUsage,
    })
    const redirectText = await redirectStream.text
    await store.insertTurn({
      interviewId,
      turnNumber: nextTurnNumber,
      userInput,
      agentResponse: redirectText,
    })
    return {
      stream: redirectStream,
      finalize: noopFinalize,
      meta: {
        phase: currentPhase,
        completed: false,
        reason: null,
        stepTracker,
        analyst: null,
      },
    }
  }

  // ── Shared context fields (Analyst + Talker) ────────────────────────────────
  const contextBase = {
    interviewId,
    workspaceId: interview.workspace_id,
    employeeName: interview.employee_name,
    employeeRole: interview.employee_role,
    department: interview.department,
    focusTopics: interview.focus_topics,
    maxDurationMinutes: interview.max_duration_minutes ?? 30,
    topicsCovered: (state?.topics_covered as string[] | null) ?? [],
    topicsOpen: (state?.topics_open as string[] | null) ?? [],
    extractionsLog: currentLog,
  }

  // ── Synchronous Analyst (ADR-021 D1) ────────────────────────────────────────
  // Runs BEFORE the phase/completion decision and the Talker — mode is selected
  // from currentPhase (loaded state), not the not-yet-computed phase decision.
  const analystStatus = interview.analyst_status ?? 'idle'
  let analystBriefing: AnalystBriefing | null = (interview.next_briefing as AnalystBriefing | null) ?? null

  // PROJ-44 Remediation (M-3 Fokus-Lock): computed BEFORE the Analyst runs, from
  // the pre-turn tracker + the previous turn's persisted drought state — steers
  // this turn's target_o_field and seeds the streak the Analyst updates (see
  // interviewAnalyst.ts's runOnlinePass).
  const previousLockedStepId = analystBriefing?.oDrought?.stepId ?? null
  const focusLockThisTurn = computeFocusLock(preTurnTracker, analystBriefing?.oDrought ?? null)

  // Failure-window (ADR-021 D2/D4): the previous turn's synchronous Analyst call
  // failed terminally — recover it by prepending its raw user input, on top of
  // whichever mode (online/closing) currentPhase selects this turn.
  const needsFailureWindow = analystStatus === 'failed' && existingTurns.length >= 2
  const previousUserInputForFailureWindow = needsFailureWindow
    ? existingTurns[existingTurns.length - 1]?.user_input
    : undefined

  void store.setAnalystStatus(interviewId, 'processing').then(() => {}, () => {})

  let analystResult: AnalystRunResult | null = null
  for (let attempt = 0; attempt <= ANALYST_RETRIES; attempt++) {
    try {
      analystResult = await runAnalyst({
        context: { ...contextBase, phase: currentPhase, timerMinutes, stepTracker },
        history,
        currentUserInput: userInput,
        previousBriefing: analystBriefing,
        analystStatus,
        previousUserInput: previousUserInputForFailureWindow,
        traceCtx: resolvedTraceCtx,
        store,
        onTokenUsage: input.onTokenUsage,
        focusLock: focusLockThisTurn,
        updateODrought,
        computeTargetOFieldFallback,
      })
      break
    } catch (err) {
      if (attempt < ANALYST_RETRIES) {
        await new Promise((r) => setTimeout(r, ANALYST_RETRY_DELAY_MS * (attempt + 1)))
        continue
      }
      // #8/KI-12 successor (ADR-021 D4): terminal failure after all retries —
      // the turn continues with the PREVIOUS (state-loaded) briefing/tracker
      // (self-healing degradation, bounded to this one turn). The next turn's
      // analyst_status='failed' triggers the failure-window recovery above.
      console.error('[runInterviewTurn] synchronous analyst failed after retries, continuing with stale briefing/tracker:', err)
    }
  }

  const analystFailedThisTurn = analystResult === null
  if (analystResult) {
    analystBriefing = analystResult.briefing
    stepTracker = analystResult.stepTracker
  }

  // #18 (fixed 2026-07-14, structurally closed by PROJ-44): the Talker persists
  // usedFillerPhrases into next_briefing via a read-merge-write (interviewTalker.ts),
  // but AnalystBriefingSchema has no usedFillerPhrases field, so a produce_briefing
  // tool call never carries it forward. applyProduceBriefing (turnStore/applyIntent.ts)
  // merges the value from the session's loaded snapshot back into the patch, so the
  // Analyst's commit doesn't wipe it. Read AFTER the synchronous Analyst call so this
  // reflects what it just committed (the Analyst now always runs before the Talker,
  // same turn — the race this used to describe no longer exists).
  const persistedFillers = analystBriefing?.usedFillerPhrases ?? []
  const usedFillerPhrases: string[] = persistedFillers.length === 0
    ? SEED_FILLERS
    : persistedFillers

  // ── Build orchestrator context (fresh — includes this turn) ─────────────────
  const orchestratorCtx: OrchestratorContext = {
    phase: currentPhase,
    stepTracker,
    timerMinutes,
    maxDurationMinutes: contextBase.maxDurationMinutes,
    historyLength: history.length,
    // PROJ-46 (ADR-023 D4, M7-b): generalizes the former newStepThisTurn veto (a
    // new step always applies a register_step, so this subsumes it) — but a
    // genuinely NEW step is already caught separately by
    // hasStepInStatus(...'exploring') in resolvePhaseTransition's closing case,
    // so this signal's remaining job is "an EXISTING step gained real depth".
    // PROJ-46 QA H-1 Fix D: was hasAppliedExtraction(toolCalls) — ANY applied
    // knowledge-tool write, including re-records/potenzial-only/floskel-triggered
    // slots. That bounced Closing back to Explore on almost every turn (backfill
    // alone reliably finds something on the closing-entry turn), so ctx.phase
    // could never stay 'closing' for the consecutive turns the no-new-extraction
    // streak's soft_confirm completion requires. Narrowed to the same O-field-diff
    // signal Fix D applies to the streak (interviewSemantic.ts's hasNewOField) —
    // a potenzial-only or re-record write no longer re-opens Explore.
    hadExtractionThisTurn: hasNewOField(preTurnTracker, stepTracker),
    // PROJ-44 Remediation (M-1/M-3): the fresh (this-turn) O-Drought state —
    // runOnlinePass always attaches it before staging produce_briefing when the
    // Analyst ran; on a terminal Analyst failure analystBriefing stays the
    // previous turn's value (untouched), so fall back to the pre-computed lock.
    oDrought: analystBriefing?.oDrought ?? focusLockThisTurn,
  }

  // ── Lifecycle check (ADR-022: one merged decision, resolveTurnLifecycle) ────
  let lifecycle = resolveTurnLifecycle(orchestratorCtx, analystBriefing)

  // ADR-021 D4: a soft_confirm decision must not complete the interview on a
  // turn whose synchronous Analyst call failed terminally — that decision would
  // rest on the PREVIOUS turn's state, never having seen this turn's userInput
  // at all (the exact class of bug the old KI-12 recheck existed to prevent).
  // hard_stop is unconditional (time-out) and proceeds regardless.
  if (analystFailedThisTurn && lifecycle.complete && lifecycle.reason === 'soft_confirm') {
    console.error('[runInterviewTurn] vetoing soft_confirm completion this turn — synchronous analyst failed (ADR-021 D4 fail-safe)')
    lifecycle = { ...lifecycle, complete: false, reason: null }
  }

  // ── Shared post-response finalize (ADR-021 D5 — was background()) ──────────
  // Only extractAndEmbed + onCompleted remain here; the Analyst ran synchronously
  // above. Prod wraps this in after(); the eval runner awaits it inline.
  let capturedTurnId: string | undefined

  const finalize = async (): Promise<void> => {
    if (capturedTurnId) {
      try {
        const newExtractions = await p.extractAndEmbed({
          interviewId,
          workspaceId: interview.workspace_id,
          turnId: capturedTurnId,
          userInput,
        })
        if (newExtractions.length > 0) {
          const updatedLog = [...currentLog, ...newExtractions]
          await store.updateStateAfterTurn(interviewId, { extractionsLog: updatedLog })
        }
      } catch (err) {
        console.error('[runInterviewTurn/finalize] extractAndEmbed failed:', err)
      }
    }
    const ci = await store.loadInterview(interviewId)
    if (ci?.status === 'completed') {
      await p.onCompleted({ interviewId, workspaceId: interview.workspace_id })
    }
  }

  if (lifecycle.complete) {
    await store.completeInterview(interviewId)

    console.log('[runInterviewTurn] lifecycle complete:', lifecycle.reason)

    // PROJ-46 (ADR-023 D1/H-2): no briefing is passed — Invariante I1, there is
    // no briefing field that can express a farewell/termination, and
    // buildDynamicContext short-circuits on isCompletionFarewell before it
    // would ever read one anyway. The farewell wording is entirely the
    // Talker's own, driven only by the isCompletionFarewell flag + phase.
    const farewellStream = await createTalkerStream({
      context: {
        ...contextBase,
        phase: lifecycle.phase,
        timerMinutes,
        stepTracker,
        usedFillerPhrases,
        isCompletionFarewell: true,
      },
      history,
      onFinish: async (agentText) => {
        if (!agentText) return
        const newTurn = await store.insertTurn({
          interviewId,
          turnNumber: nextTurnNumber,
          userInput,
          agentResponse: agentText,
        })
        if (newTurn?.id) capturedTurnId = newTurn.id
      },
      onTokenUsage: input.onTokenUsage,
    })

    return {
      stream: farewellStream,
      finalize,
      meta: {
        phase: lifecycle.phase,
        completed: true,
        reason: lifecycle.reason as 'hard_stop' | 'soft_confirm',
        stepTracker,
        analyst: analystResult,
      },
    }
  }

  // ── Phase decision (ADR-022: already resolved by resolveTurnLifecycle above) ─
  const orchestratedPhase: Phase = lifecycle.phase

  if (orchestratedPhase !== currentPhase) {
    await store.updatePhase(interviewId, orchestratedPhase)
  }

  // PROJ-43 (AC4/AC5): persist this turn's final, deterministically-computed
  // Card list — the Analyst's own session already committed next_briefing
  // earlier this turn (analyst_status='done'), so this is a deliberate
  // follow-up write (updateNextBriefing bypasses the onlyIfNotDone race guard,
  // see port.ts). Fires exactly once, on the turn that transitions INTO
  // clarification — resolvePhaseTransition keeps 'clarification' pinned on
  // every later turn, so this branch only runs on the entry turn.
  if (orchestratedPhase === 'clarification' && lifecycle.clarificationCards) {
    analystBriefing = { ...(analystBriefing ?? {}), clarification_cards: lifecycle.clarificationCards }
    await store.updateNextBriefing(interviewId, analystBriefing)
  }

  // ── Binding Absicht for the Talker (PROJ-46 / ADR-023 D1/D3) ────────────────
  // Ziel-Schritt is the fresh (this-turn) O-Drought lock; Übergang-Grund is
  // code-computed, per-turn ephemeral (never persisted) — compares this turn's
  // lock against what was persisted at turn start.
  const currentLockedStepId = orchestratorCtx.oDrought.stepId
  const transitionReason = computeTransitionReason(previousLockedStepId, currentLockedStepId, currentPhase, orchestratedPhase)

  // ── Talker stream ───────────────────────────────────────────────────────────
  const stream = await createTalkerStream({
    context: {
      ...contextBase,
      phase: orchestratedPhase,
      timerMinutes,
      stepTracker,
      usedFillerPhrases,
      focusStepId: currentLockedStepId,
      transitionReason,
    },
    history,
    briefing: analystBriefing,
    userInput,
    onTokenUsage: input.onTokenUsage,
    onFinish: async (agentText) => {
      if (!agentText) return

      const newTurn = await store.insertTurn({
        interviewId,
        turnNumber: nextTurnNumber,
        userInput,
        agentResponse: agentText,
      })

      await store.updateStateAfterTurn(interviewId, { timerMinutes, extractionsLog: currentLog })

      if (newTurn?.id) capturedTurnId = newTurn.id
    },
  })

  return {
    stream,
    finalize,
    meta: {
      phase: orchestratedPhase,
      completed: false,
      reason: null,
      stepTracker,
      analyst: analystResult,
    },
  }
}
