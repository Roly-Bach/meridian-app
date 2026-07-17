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
 * `checkLifecycle`/`decideNextPhaseWithMeta`/`shouldInjectClosingProbe` therefore
 * read state INCLUDING the current turn, not "end of previous turn". The old
 * two-stage `soft_confirm` recheck (KI-12) and the pre-Talker Quick-Extract
 * (interviewQuickExtract.ts) are gone — the single synchronous Analyst pass
 * subsumes both.
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
  computeMissingMandatorySlots,
  normalizeStepEntry,
  type Phase,
  type StepEntry,
  type RawExtraction,
} from '@/services/interviewSemantic'
import type { TurnMessage, AnalystBriefing } from '@/services/interviewTypes'
import {
  decideNextPhaseWithMeta,
  checkLifecycle,
  shouldInjectClosingProbe,
  CLOSING_PROBE_TEXT,
  type OrchestratorContext,
} from '@/services/interviewOrchestrator'
import { checkRoleGuard, buildOffTopicRedirect } from '@/services/roleGuard'
import { createTalkerStream } from '@/services/interviewTalker'
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

/** Shim for a deterministic, non-LLM turn (closing probe / off-topic redirect). */
function makeStaticStream(text: string): TurnStream {
  return {
    toTextStreamResponse: () => new Response(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    }),
    text: Promise.resolve(text),
  }
}

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

  // ── Role Guard (PROJ-42 / KI-24) ────────────────────────────────────────────
  // Earliest gate, phase-agnostic — runs before the synchronous Analyst. Class
  // off_topic ends the turn here: the Analyst never runs for this turn, the
  // Talker call is skipped, and the stored interview state (phase, stepTracker,
  // topics) is left completely unchanged.
  const talkerModelString = process.env.INTERVIEW_TALKER_MODEL ?? process.env.INTERVIEW_MODEL ?? 'google/gemini-3.1-flash-lite'
  const roleGuard = await checkRoleGuard(userInput, history, talkerModelString, traceCtx, input.onTokenUsage)
  if (roleGuard.classification === 'off_topic') {
    const redirectText = buildOffTopicRedirect(history)
    await store.insertTurn({
      interviewId,
      turnNumber: nextTurnNumber,
      userInput,
      agentResponse: redirectText,
    })
    return {
      stream: makeStaticStream(redirectText),
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

  // Failure-window (ADR-021 D2/D4): the previous turn's synchronous Analyst call
  // failed terminally — recover it by prepending its raw user input, on top of
  // whichever mode (online/closing) currentPhase selects this turn.
  const needsFailureWindow = analystStatus === 'failed' && existingTurns.length >= 2
  const previousUserInputForFailureWindow = needsFailureWindow
    ? existingTurns[existingTurns.length - 1]?.user_input
    : undefined

  void store.setAnalystStatus(interviewId, 'processing').then(() => {}, () => {})

  const resolvedTraceCtx = traceCtx ?? { interviewId, environment: 'prod' as const }

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
    topicsOpen: contextBase.topicsOpen,
    topicsCovered: contextBase.topicsCovered,
    timerMinutes,
    maxDurationMinutes: contextBase.maxDurationMinutes,
    historyLength: history.length,
    history,
  }

  // ── Lifecycle check ─────────────────────────────────────────────────────────
  let lifecycle = checkLifecycle(orchestratorCtx, analystBriefing)

  // ADR-021 D4: a soft_confirm decision must not complete the interview on a
  // turn whose synchronous Analyst call failed terminally — that decision would
  // rest on the PREVIOUS turn's state, never having seen this turn's userInput
  // at all (the exact class of bug the old KI-12 recheck existed to prevent).
  // hard_stop is unconditional (time-out) and proceeds regardless.
  if (analystFailedThisTurn && lifecycle.shouldComplete && lifecycle.reason === 'soft_confirm') {
    console.error('[runInterviewTurn] vetoing soft_confirm completion this turn — synchronous analyst failed (ADR-021 D4 fail-safe)')
    lifecycle = { shouldComplete: false, reason: null }
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

  if (lifecycle.shouldComplete) {
    await store.completeInterview(interviewId)

    console.log('[runInterviewTurn] lifecycle complete:', lifecycle.reason)

    const farewellBriefing: AnalystBriefing = {
      next_focus: 'Verabschiedung',
      suggested_question: 'Verabschiede dich kurz und herzlich.',
    }

    const farewellStream = await createTalkerStream({
      context: {
        ...contextBase,
        phase: 'closing' as Phase,
        timerMinutes,
        stepTracker,
        usedFillerPhrases,
        isCompletionFarewell: true,
      },
      history,
      briefing: farewellBriefing,
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
        phase: 'closing' as Phase,
        completed: true,
        reason: lifecycle.reason as 'hard_stop' | 'soft_confirm',
        stepTracker,
        analyst: analystResult,
      },
    }
  }

  // ── Phase decision ──────────────────────────────────────────────────────────
  const { phase: nextPhaseDecision } = decideNextPhaseWithMeta(orchestratorCtx, analystBriefing)
  const orchestratedPhase: Phase = nextPhaseDecision === 'completed' ? 'closing' : (nextPhaseDecision as Phase)

  if (orchestratedPhase !== currentPhase) {
    await store.updatePhase(interviewId, orchestratedPhase)
  }

  // ── Closing probe injection ─────────────────────────────────────────────────
  if (shouldInjectClosingProbe(orchestratedPhase, history)) {
    const agentText = CLOSING_PROBE_TEXT
    await store.insertTurn({
      interviewId,
      turnNumber: nextTurnNumber,
      userInput,
      agentResponse: agentText,
    })

    return {
      stream: makeStaticStream(agentText),
      finalize: noopFinalize,
      meta: {
        phase: 'closing' as Phase,
        completed: false,
        reason: null,
        stepTracker,
        analyst: analystResult,
      },
    }
  }

  // ── Missing slots ───────────────────────────────────────────────────────────
  // PROJ-42: coverage_check/slot_completion no longer exist as phases — the
  // equivalent "surface remaining gaps" moment is 'closing', right before
  // Clarification Cards take over the rest (unchanged PROJ-23 mechanism).
  const missingSlotsForCoverageCheck =
    orchestratedPhase === 'closing'
      ? computeMissingMandatorySlots(stepTracker)
      : undefined

  // ── Talker stream ───────────────────────────────────────────────────────────
  const stream = await createTalkerStream({
    context: {
      ...contextBase,
      phase: orchestratedPhase,
      timerMinutes,
      stepTracker,
      missingSlotsForCoverageCheck,
      usedFillerPhrases,
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
