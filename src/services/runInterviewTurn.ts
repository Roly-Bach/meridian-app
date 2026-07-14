/**
 * runInterviewTurn — deep module for the interview turn loop (PROJ-33 / ADR-016).
 *
 * Encapsulates the complete per-turn logic:
 *   load → orchestrate → wrap-up-inject | talker-stream + background analyst
 *
 * The Prod Route and the Eval Runner are thin adapters around this function.
 * Neither `import { after } from 'next/server'` belongs here — `after()` remains
 * the Prod adapter's concern.
 *
 * PROJ-34 / ADR-018: persistence is injected via `ports`. `runInterviewTurn`
 * never touches `getSupabaseAdmin()` directly — all loads, the turns-insert and
 * the interview_state/interviews updates go through `ports.store`. The
 * post-completion derivation (`onCompleted`) and per-turn `extractAndEmbed` are
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
  shouldInjectWrapUpQuestion,
  WRAP_UP_QUESTION_TEXT,
  type OrchestratorContext,
} from '@/services/interviewOrchestrator'
import { createTalkerStream } from '@/services/interviewTalker'
import {
  runAnalystOnline,
  runAnalystCatchup,
  runAnalystFailureRetry,
  type AnalystRunResult,
} from '@/services/interviewAnalyst'
import { runQuickExtract } from '@/services/interviewQuickExtract'
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
  /** Post-completion derivation pipeline. Prod = real; Eval = no-op. */
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
}

export interface TurnResult {
  stream: TurnStream
  background: () => Promise<AnalystRunResult | null>
  /** Only consumed by the eval runner (turnResult.meta.phase/.completed) — chat/route.ts ignores it. */
  meta: TurnMeta
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEED_FILLERS = [
  'Das ist ein', 'Das ist eine', 'Das klingt', 'Das macht',
  'Vielen Dank', 'Danke', 'Ich danke', 'Sehr gut',
  'Interessant', 'Gut,', 'Alles klar',
]

/** Shim for the wrap-up question — returns a TurnStream without an LLM call. */
function makeWrapUpStream(text: string): TurnStream {
  return {
    toTextStreamResponse: () => new Response(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    }),
    text: Promise.resolve(text),
  }
}

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

  // ── Analyst briefing from previous turn ────────────────────────────────────
  const analystStatus = interview.analyst_status ?? 'idle'
  let analystBriefing: AnalystBriefing | null = (interview.next_briefing as AnalystBriefing | null) ?? null

  // #18 (fixed 2026-07-14): the Talker persists usedFillerPhrases into next_briefing via
  // a read-merge-write (interviewTalker.ts:312-336), but AnalystBriefingSchema has no
  // usedFillerPhrases field, so a produce_briefing tool call never carries it forward.
  // applyProduceBriefing (turnStore/applyIntent.ts) now merges the value from the
  // session's loaded snapshot back into the patch, so the Analyst's commit no longer
  // wipes it. Residual: a same-turn race with the Talker's own write is narrowed (the
  // snapshot is loaded once per pass) but not fully eliminated — see the TurnSnapshot
  // comment in turnStore/intents.ts.
  const persistedFillers = analystBriefing?.usedFillerPhrases ?? []
  const usedFillerPhrases: string[] = persistedFillers.length === 0
    ? SEED_FILLERS
    : persistedFillers

  // ── Build orchestrator context ──────────────────────────────────────────────
  const orchestratorCtx: OrchestratorContext = {
    phase: currentPhase,
    stepTracker,
    topicsOpen: (state?.topics_open as string[] | null) ?? [],
    topicsCovered: (state?.topics_covered as string[] | null) ?? [],
    timerMinutes,
    maxDurationMinutes: interview.max_duration_minutes ?? 30,
    historyLength: history.length,
    history,
  }

  // ── Lifecycle check ─────────────────────────────────────────────────────────
  let lifecycle = checkLifecycle(orchestratorCtx, analystBriefing)

  // KI-12: stepTracker/analystBriefing above reflect state as of the END of the
  // PREVIOUS turn — this turn's userInput has not been seen by any analyst pass
  // yet (that normally happens in background, after this turn streams). Deciding
  // soft_confirm on stale state can complete the interview the instant a brand-new
  // topic is mentioned in the very input that triggered it (e.g. answering the
  // wrap-up "anything we missed?" question by naming a process never seen before)
  // — the topic then never gets explored, just whatever this one pass can grab.
  // Run the online analyst synchronously once before trusting soft_confirm, so a
  // freshly-registered step can veto premature completion.
  //
  // 'farewell_pending_analyst' (eval 2026-06-25 run1 follow-up): the farewell-loop escape
  // valve in checkLifecycle detected two consecutive goodbyes but had no analystBriefing to
  // check for pending clarification_cards, so it couldn't decide and would otherwise leave the
  // turn to run normally — letting the farewell loop continue instead of completing. Same fix
  // applies: force the analyst pass, then re-decide with real data.
  let preCompletionAnalystResult: AnalystRunResult | null = null

  if (
    (lifecycle.shouldComplete && lifecycle.reason === 'soft_confirm') ||
    lifecycle.reason === 'farewell_pending_analyst'
  ) {
    try {
      preCompletionAnalystResult = await runAnalystOnline({
        context: {
          interviewId,
          workspaceId: interview.workspace_id,
          employeeName: interview.employee_name,
          employeeRole: interview.employee_role,
          department: interview.department,
          focusTopics: interview.focus_topics,
          phase: 'wrap_up' as Phase,
          timerMinutes,
          topicsCovered: (state?.topics_covered as string[] | null) ?? [],
          topicsOpen: (state?.topics_open as string[] | null) ?? [],
          extractionsLog: (state?.extractions_log as RawExtraction[] | null) ?? [],
          maxDurationMinutes: interview.max_duration_minutes ?? 30,
          stepTracker,
        },
        history,
        currentUserInput: userInput,
        traceCtx: traceCtx ?? { interviewId, environment: 'prod' as const },
        store,
        onTokenUsage: input.onTokenUsage,
      })

      stepTracker = (await store.loadStepTracker(interviewId) as unknown[])
        .map((raw, i) => normalizeStepEntry(raw, i + 1))
      orchestratorCtx.stepTracker = stepTracker
      analystBriefing = preCompletionAnalystResult.briefing
      lifecycle = checkLifecycle(orchestratorCtx, analystBriefing)
    } catch (err) {
      // #8 (2026-07-14): previously fell through and trusted the stale (pre-recheck)
      // lifecycle decision — if that decision was shouldComplete=true, a transient
      // failure here (network blip, rate limit) could complete the interview on
      // state that never saw this turn's userInput at all (the exact class of bug
      // this recheck exists to prevent, see KI-12 above). Veto completion instead:
      // the turn proceeds normally below, and background() runs the Analyst as a
      // natural retry on the next pass — no interview is silently lost, only delayed.
      console.error('[runInterviewTurn] pre-completion analyst recheck failed, vetoing completion this turn:', err)
      lifecycle = { shouldComplete: false, reason: null }
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
        interviewId,
        workspaceId: interview.workspace_id,
        employeeName: interview.employee_name,
        employeeRole: interview.employee_role,
        department: interview.department,
        focusTopics: interview.focus_topics,
        phase: 'wrap_up' as Phase,
        timerMinutes,
        topicsCovered: (state?.topics_covered as string[] | null) ?? [],
        topicsOpen: (state?.topics_open as string[] | null) ?? [],
        extractionsLog: (state?.extractions_log as RawExtraction[] | null) ?? [],
        maxDurationMinutes: interview.max_duration_minutes ?? 30,
        stepTracker,
        usedFillerPhrases,
        isCompletionFarewell: true,
      },
      history,
      briefing: farewellBriefing,
      onFinish: async (agentText) => {
        if (!agentText) return
        await store.insertTurn({
          interviewId,
          turnNumber: nextTurnNumber,
          userInput,
          agentResponse: agentText,
        })
      },
      onTokenUsage: input.onTokenUsage,
    })

    // This closure and the "Background analyst closure" further below (normal path)
    // independently check the same preCompletionAnalystResult dedup condition —
    // same logic twice instead of a shared helper (docs/architecture/00-vorgeschlagene-anpassungen.md #15).
    const background = async (): Promise<AnalystRunResult | null> => {
      if (preCompletionAnalystResult) {
        // Already ran synchronously above during the soft_confirm recheck —
        // running again would double-process this turn's input (duplicate
        // slot writes / knowledge objects).
        await p.onCompleted({ interviewId, workspaceId: interview.workspace_id })
        return preCompletionAnalystResult
      }
      try {
        // B5: hard_stop path — Analyst never ran for this final turn (no soft_confirm
        // recheck happened), run it now so this turn's slots aren't lost before
        // process-step creation.
        const freshTracker = (await store.loadStepTracker(interviewId) as unknown[])
          .map((raw, i) => normalizeStepEntry(raw, i + 1))
        await runAnalystOnline({
          context: {
            interviewId,
            workspaceId: interview.workspace_id,
            employeeName: interview.employee_name,
            employeeRole: interview.employee_role,
            department: interview.department,
            focusTopics: interview.focus_topics,
            phase: 'wrap_up' as Phase,
            timerMinutes,
            topicsCovered: (state?.topics_covered as string[] | null) ?? [],
            topicsOpen: (state?.topics_open as string[] | null) ?? [],
            extractionsLog: (state?.extractions_log as RawExtraction[] | null) ?? [],
            maxDurationMinutes: interview.max_duration_minutes ?? 30,
            stepTracker: freshTracker,
          },
          history,
          currentUserInput: userInput,
          traceCtx: traceCtx ?? { interviewId, environment: 'prod' as const },
          store,
          onTokenUsage: input.onTokenUsage,
        })
      } catch (err) {
        console.error('[runInterviewTurn] post-complete analyst failed:', err)
      }
      await p.onCompleted({ interviewId, workspaceId: interview.workspace_id })
      return null
    }

    return {
      stream: farewellStream,
      background,
      meta: {
        phase: 'wrap_up' as Phase,
        completed: true,
        // 'farewell_pending_analyst' never reaches this branch: it always carries shouldComplete=false.
        reason: lifecycle.reason as 'hard_stop' | 'soft_confirm',
        stepTracker,
      },
    }
  }

  // ── Phase decision ──────────────────────────────────────────────────────────
  const { phase: nextPhaseDecision, phaseJustEntered } = decideNextPhaseWithMeta(orchestratorCtx, analystBriefing)
  const orchestratedPhase: Phase = nextPhaseDecision === 'completed' ? 'wrap_up' : (nextPhaseDecision as Phase)

  if (orchestratedPhase !== currentPhase) {
    await store.updatePhase(interviewId, orchestratedPhase)
  }

  // ── Wrap-up question injection ──────────────────────────────────────────────
  if (shouldInjectWrapUpQuestion(orchestratedPhase, history)) {
    const agentText = WRAP_UP_QUESTION_TEXT
    await store.insertTurn({
      interviewId,
      turnNumber: nextTurnNumber,
      userInput,
      agentResponse: agentText,
    })

    return {
      stream: makeWrapUpStream(agentText),
      background: async () => null,
      meta: {
        phase: 'wrap_up' as Phase,
        completed: false,
        reason: null,
        stepTracker,
      },
    }
  }

  // ── Pre-Talker Quick-Extract ────────────────────────────────────────────────
  let freshStepTracker = stepTracker
  if (stepTracker.length > 0) {
    const activeStep = stepTracker.find(s => s.status === 'exploring' || s.status === 'walkthrough')
    const qeTracker = await runQuickExtract({
      interviewId,
      workspaceId: interview.workspace_id,
      userInput,
      stepTracker,
      currentTurnNumber: nextTurnNumber,
      activeStepTitle: activeStep?.title ?? null,
      store,
      onTokenUsage: input.onTokenUsage,
    })
    if (qeTracker !== null) freshStepTracker = qeTracker.map((raw, i) => normalizeStepEntry(raw as unknown, i + 1))
  }

  // ── Missing slots ───────────────────────────────────────────────────────────
  const missingSlotsForCoverageCheck =
    orchestratedPhase === 'coverage_check' || orchestratedPhase === 'slot_completion'
      ? computeMissingMandatorySlots(freshStepTracker)
      : undefined

  // ── Analyst status ──────────────────────────────────────────────────────────
  const needsCatchup = analystStatus === 'failed'

  void store.setAnalystStatus(interviewId, 'processing').then(() => {}, () => {})

  const currentLog = (state?.extractions_log as RawExtraction[] | null) ?? []

  // ── Talker stream ───────────────────────────────────────────────────────────
  const stream = await createTalkerStream({
    context: {
      interviewId,
      workspaceId: interview.workspace_id,
      employeeName: interview.employee_name,
      employeeRole: interview.employee_role,
      department: interview.department,
      focusTopics: interview.focus_topics,
      phase: orchestratedPhase,
      timerMinutes,
      topicsCovered: (state?.topics_covered as string[] | null) ?? [],
      topicsOpen: (state?.topics_open as string[] | null) ?? [],
      extractionsLog: currentLog,
      maxDurationMinutes: interview.max_duration_minutes ?? 30,
      stepTracker: freshStepTracker,
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

      const runPostCompletionTasks = async () => {
        const ci = await store.loadInterview(interviewId)
        if (ci?.status !== 'completed') return
        await p.onCompleted({ interviewId, workspaceId: interview.workspace_id })
      }

      if (newTurn?.id) {
        p.extractAndEmbed({
          interviewId,
          workspaceId: interview.workspace_id,
          turnId: newTurn.id,
          userInput,
        })
          .then(async (newExtractions) => {
            if (newExtractions.length > 0) {
              const updatedLog = [...currentLog, ...newExtractions]
              await store.updateStateAfterTurn(interviewId, { extractionsLog: updatedLog })
            }
            await runPostCompletionTasks()
          })
          .catch((err) => console.error('[runInterviewTurn/onFinish] extractAndEmbed failed:', err))
      } else {
        await runPostCompletionTasks()
      }
    },
  })

  // ── Background analyst closure ──────────────────────────────────────────────
  const background = async (): Promise<AnalystRunResult | null> => {
    if (preCompletionAnalystResult) {
      // Already ran synchronously during the soft_confirm recheck above (which
      // then decided NOT to complete) — don't process this turn's input twice.
      return preCompletionAnalystResult
    }
    try {
      const analystHistory = history

      const freshTrackerForAnalyst = (await store.loadStepTracker(interviewId) as unknown[])
        .map((raw, i) => normalizeStepEntry(raw, i + 1))

      const sharedContext = {
        interviewId,
        workspaceId: interview.workspace_id,
        employeeName: interview.employee_name,
        employeeRole: interview.employee_role,
        department: interview.department,
        focusTopics: interview.focus_topics,
        phase: orchestratedPhase,
        timerMinutes,
        topicsCovered: (state?.topics_covered as string[] | null) ?? [],
        topicsOpen: (state?.topics_open as string[] | null) ?? [],
        extractionsLog: currentLog,
        maxDurationMinutes: interview.max_duration_minutes ?? 30,
        stepTracker: freshTrackerForAnalyst,
      }

      const resolvedTraceCtx = traceCtx ?? { interviewId, environment: 'prod' as const }

      if (needsCatchup && existingTurns.length >= 2) {
        const prevUserInput = existingTurns[existingTurns.length - 1]?.user_input ?? ''
        const result = await runAnalystFailureRetry({
          context: sharedContext,
          history: analystHistory,
          previousUserInput: prevUserInput,
          currentUserInput: userInput,
          traceCtx: resolvedTraceCtx,
          store,
          onTokenUsage: input.onTokenUsage,
        })
        return result
      }

      const onlineResult = await runAnalystOnline({
        context: sharedContext,
        history: analystHistory,
        currentUserInput: userInput,
        traceCtx: resolvedTraceCtx,
        store,
        onTokenUsage: input.onTokenUsage,
      })

      const shouldRunCatchup =
        phaseJustEntered === 'coverage_check' || phaseJustEntered === 'wrap_up'
      if (shouldRunCatchup) {
        const postOnlineTracker = (await store.loadStepTracker(interviewId) as unknown[])
          .map((raw, i) => normalizeStepEntry(raw, i + 1))

        await runAnalystCatchup({
          context: { ...sharedContext, stepTracker: postOnlineTracker },
          history: analystHistory,
          currentUserInput: userInput,
          traceCtx: resolvedTraceCtx,
          store,
          onTokenUsage: input.onTokenUsage,
        })
      }

      return onlineResult
    } catch (err) {
      console.error('[runInterviewTurn] background analyst error:', err)
      return null
    }
  }

  return {
    stream,
    background,
    meta: {
      phase: orchestratedPhase,
      completed: false,
      reason: null,
      stepTracker: freshStepTracker,
    },
  }
}
