/**
 * runInterviewTurn — deep module for the interview turn loop (PROJ-33 / ADR-016).
 *
 * Encapsulates the complete per-turn logic:
 *   load → orchestrate → wrap-up-inject | talker-stream + background analyst
 *
 * The Prod Route and the Eval Runner are thin adapters around this function.
 * Neither `import { after } from 'next/server'` nor TurnStore port (PROJ-34)
 * belong here — `after()` remains the Prod adapter's concern.
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  computeMissingMandatorySlots,
  normalizeStepEntry,
  type Phase,
  type StepEntry,
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
import { extractAndEmbed, deduplicateKnowledgeObjects, type RawExtraction } from '@/services/extraction'
import { createProcessStepsFromTracker } from '@/services/processEnrichment'
import { clusterProcessSteps } from '@/services/processClustering'
import type { Database } from '@/lib/database.types'

type StateRow = Database['public']['Tables']['interview_state']['Row']
type TurnRow = Database['public']['Tables']['turns']['Row']

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

export interface RunTurnInput {
  interviewId: string
  userInput: string
  /** Elapsed time in minutes since the first turn. Prod computes from `created_at`; Eval simulates. */
  timerMinutes: number
  /** Optional Langfuse trace context — merged into every LLM-call telemetry. */
  traceCtx?: Record<string, unknown>
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

export async function runInterviewTurn(input: RunTurnInput): Promise<TurnResult> {
  const { interviewId, userInput, timerMinutes, traceCtx } = input
  const supabase = getSupabaseAdmin()

  // ── Load interview row ──────────────────────────────────────────────────────
  const { data: rawInterview } = await supabase
    .from('interviews')
    .select('id, workspace_id, employee_name, employee_role, department, focus_topics, status, max_duration_minutes, analyst_status, next_briefing')
    .eq('id', interviewId)
    .single()

  if (!rawInterview) {
    throw new Error(`runInterviewTurn: interview ${interviewId} not found`)
  }

  const interview = rawInterview as typeof rawInterview & {
    analyst_status?: string | null
    next_briefing?: AnalystBriefing | null
  }

  // ── Load state + turns ──────────────────────────────────────────────────────
  const [{ data: rawState }, { data: rawTurns }] = await Promise.all([
    supabase
      .from('interview_state')
      .select('phase, timer_minutes, topics_covered, topics_open, extractions_log, step_tracker, opener_text')
      .eq('interview_id', interviewId)
      .maybeSingle(),
    supabase
      .from('turns')
      .select('turn_number, user_input, agent_response, created_at')
      .eq('interview_id', interviewId)
      .order('turn_number', { ascending: true }),
  ])

  const state = rawState as (Partial<StateRow> & { step_tracker?: unknown }) | null
  const existingTurns = (rawTurns as TurnRow[]) ?? []
  const currentPhase = (state?.phase ?? 'intro') as Phase
  const stepTracker: StepEntry[] = ((state?.step_tracker as unknown[] | null) ?? [])
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
  const analystBriefing: AnalystBriefing | null = (interview.next_briefing as AnalystBriefing | null) ?? null

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
  const lifecycle = checkLifecycle(orchestratorCtx, analystBriefing)
  if (lifecycle.shouldComplete) {
    await supabase
      .from('interviews')
      .update({ status: 'completed', extractions_pending: true })
      .eq('id', interviewId)

    console.log('[runInterviewTurn] lifecycle complete:', lifecycle.reason)

    const farewellBriefing: AnalystBriefing = {
      next_focus: 'Verabschiedung',
      suggested_question: 'Verabschiede dich kurz und herzlich.',
    }

    const farewellStream = createTalkerStream({
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
      },
      history,
      briefing: farewellBriefing,
      onFinish: async (agentText) => {
        if (!agentText) return
        await supabase.from('turns').insert({
          interview_id: interviewId,
          turn_number: nextTurnNumber,
          user_input: userInput,
          agent_response: agentText,
        })
      },
    })

    const background = async (): Promise<AnalystRunResult | null> => {
      try {
        // B5: run the Analyst on the final wrap-up user turn. The completion path exits
        // before the normal Analyst run below, so this turn's slots would otherwise be
        // lost before process-step creation.
        const { data: freshStateRow } = await supabase
          .from('interview_state')
          .select('step_tracker')
          .eq('interview_id', interviewId)
          .maybeSingle()
        const freshTracker = ((freshStateRow?.step_tracker as unknown[] | null) ?? (stepTracker as unknown[]))
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
        })
      } catch (err) {
        console.error('[runInterviewTurn] post-complete analyst failed:', err)
      }
      await createProcessStepsFromTracker({ interviewId, workspaceId: interview.workspace_id })
      clusterProcessSteps(interview.workspace_id).catch((err) =>
        console.error('[runInterviewTurn] post-complete clusterProcessSteps failed:', err),
      )
      deduplicateKnowledgeObjects(interview.workspace_id).catch((err) =>
        console.error('[runInterviewTurn] post-complete deduplicateKnowledgeObjects failed:', err),
      )
      return null
    }

    return {
      stream: farewellStream,
      background,
      meta: {
        phase: 'wrap_up' as Phase,
        completed: true,
        reason: lifecycle.reason,
        stepTracker,
      },
    }
  }

  // ── Phase decision ──────────────────────────────────────────────────────────
  const { phase: nextPhaseDecision, phaseJustEntered } = decideNextPhaseWithMeta(orchestratorCtx, analystBriefing)
  const orchestratedPhase: Phase = nextPhaseDecision === 'completed' ? 'wrap_up' : (nextPhaseDecision as Phase)

  if (orchestratedPhase !== currentPhase) {
    await supabase
      .from('interview_state')
      .update({ phase: orchestratedPhase, updated_at: new Date().toISOString() })
      .eq('interview_id', interviewId)
  }

  // ── Wrap-up question injection ──────────────────────────────────────────────
  if (shouldInjectWrapUpQuestion(orchestratedPhase, history)) {
    const agentText = WRAP_UP_QUESTION_TEXT
    await supabase.from('turns').insert({
      interview_id: interviewId,
      turn_number: nextTurnNumber,
      user_input: userInput,
      agent_response: agentText,
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

  void supabase
    .from('interviews')
    .update({ analyst_status: 'processing' })
    .eq('id', interviewId)
    .then(() => {}, () => {})

  const currentLog = (state?.extractions_log as RawExtraction[] | null) ?? []

  // ── Talker stream ───────────────────────────────────────────────────────────
  const stream = createTalkerStream({
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
    onFinish: async (agentText) => {
      if (!agentText) return

      const { data: newTurn, error: turnError } = await supabase
        .from('turns')
        .insert({
          interview_id: interviewId,
          turn_number: nextTurnNumber,
          user_input: userInput,
          agent_response: agentText,
        })
        .select('id')
        .single()
      if (turnError) console.error('[runInterviewTurn/onFinish] turns insert failed:', turnError.message)

      const { error: stateError } = await supabase
        .from('interview_state')
        .update({
          timer_minutes: timerMinutes,
          updated_at: new Date().toISOString(),
          extractions_log: currentLog as unknown as import('@/lib/database.types').Json,
        })
        .eq('interview_id', interviewId)
      if (stateError) console.error('[runInterviewTurn/onFinish] state update failed:', stateError.message)

      const runPostCompletionTasks = async () => {
        const { data: ci } = await supabase
          .from('interviews')
          .select('status')
          .eq('id', interviewId)
          .single()
        if (ci?.status !== 'completed') return
        await createProcessStepsFromTracker({ interviewId, workspaceId: interview.workspace_id })
        clusterProcessSteps(interview.workspace_id).catch((err) =>
          console.error('[runInterviewTurn] clusterProcessSteps failed:', err),
        )
        deduplicateKnowledgeObjects(interview.workspace_id).catch((err) =>
          console.error('[runInterviewTurn] deduplicateKnowledgeObjects failed:', err),
        )
      }

      if (newTurn?.id) {
        const transcript = [
          ...existingTurns.map((t) => ({ user_input: t.user_input, agent_response: t.agent_response })),
          { user_input: userInput, agent_response: agentText },
        ]
        extractAndEmbed({
          interviewId,
          workspaceId: interview.workspace_id,
          turnId: newTurn.id,
          transcript,
        })
          .then(async (newExtractions) => {
            if (newExtractions.length > 0) {
              const updatedLog = [...currentLog, ...newExtractions]
              const { error } = await supabase
                .from('interview_state')
                .update({
                  extractions_log: updatedLog as unknown as import('@/lib/database.types').Json,
                  updated_at: new Date().toISOString(),
                })
                .eq('interview_id', interviewId)
              if (error) console.error('[runInterviewTurn] extractions_log update failed:', error.message)
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
    try {
      const analystHistory = history

      const adminDb = getSupabaseAdmin()
      const { data: freshStateRow } = await adminDb
        .from('interview_state')
        .select('step_tracker')
        .eq('interview_id', interviewId)
        .maybeSingle()
      const freshTrackerForAnalyst = ((freshStateRow?.step_tracker as unknown[] | null) ?? (stepTracker as unknown[]))
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
        })
        return result
      }

      const onlineResult = await runAnalystOnline({
        context: sharedContext,
        history: analystHistory,
        currentUserInput: userInput,
        traceCtx: resolvedTraceCtx,
      })

      const shouldRunCatchup =
        phaseJustEntered === 'coverage_check' || phaseJustEntered === 'wrap_up'
      if (shouldRunCatchup) {
        const { data: postOnlineStateRow } = await adminDb
          .from('interview_state')
          .select('step_tracker')
          .eq('interview_id', interviewId)
          .maybeSingle()
        const postOnlineTracker = ((postOnlineStateRow?.step_tracker as unknown[] | null) ?? (freshTrackerForAnalyst as unknown[]))
          .map((raw, i) => normalizeStepEntry(raw, i + 1))

        await runAnalystCatchup({
          context: { ...sharedContext, stepTracker: postOnlineTracker },
          history: analystHistory,
          currentUserInput: userInput,
          traceCtx: resolvedTraceCtx,
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
