import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  computeMissingMandatorySlots,
  type Phase,
  type TurnMessage,
  type StepEntry,
  type AnalystBriefing,
} from '@/services/interviewAgent'
import { normalizeStepEntry } from '@/services/interviewSemantic'
import {
  decideNextPhaseWithMeta,
  checkLifecycle,
  shouldInjectWrapUpQuestion,
  WRAP_UP_QUESTION_TEXT,
  type OrchestratorContext,
} from '@/services/interviewOrchestrator'
import { createTalkerStream } from '@/services/interviewTalker'
import { runAnalystOnline, runAnalystCatchup, runAnalystFailureRetry } from '@/services/interviewAnalyst'
import { runQuickExtract } from '@/services/interviewQuickExtract'
import { extractAndEmbed, deduplicateKnowledgeObjects, type RawExtraction } from '@/services/extraction'
import { createProcessStepsFromTracker } from '@/services/processEnrichment'
import { clusterProcessSteps } from '@/services/processClustering'
import { checkTokenEndpointLimits, extractIP } from '@/lib/ratelimit'
import { buildTraceMetadata } from '@/services/_telemetry'
import type { Database } from '@/lib/database.types'

type InterviewRow = Database['public']['Tables']['interviews']['Row']
type StateRow = Database['public']['Tables']['interview_state']['Row']
type TurnRow = Database['public']['Tables']['turns']['Row']

const ChatInputSchema = z.object({
  user_input: z.string().min(1, 'Nachricht darf nicht leer sein').max(10000),
})

const TOKEN_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── POST /api/interview/[token]/chat ─────────────────────────────────────────
// Iteration 2: Orchestrator decides phase (deterministic TypeScript).
// Iteration 3: Talker streams text-only; Analyst runs in background via after().

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!TOKEN_UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }
  const supabase = getSupabaseAdmin()

  // ── Validate input ──────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ChatInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { user_input } = parsed.data

  // ── Load interview ──────────────────────────────────────────────────────────
  const { data: rawInterview, error: fetchError } = await supabase
    .from('interviews')
    .select('id, workspace_id, employee_name, employee_role, department, focus_topics, status, token_expires_at, max_duration_minutes, created_at, analyst_status, next_briefing')
    .eq('access_token', token)
    .single()

  const interview = rawInterview as (InterviewRow & { analyst_status?: string | null; next_briefing?: AnalystBriefing | null }) | null

  if (fetchError || !interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }

  if (new Date(interview.token_expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'Dieser Interview-Link ist nicht mehr gültig' },
      { status: 410 }
    )
  }

  if (interview.status === 'completed') {
    return NextResponse.json(
      { error: 'Dieses Interview wurde bereits abgeschlossen' },
      { status: 409 }
    )
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const ip = extractIP(req)
  const rateLimitResponse = await checkTokenEndpointLimits(token, ip)
  if (rateLimitResponse) return rateLimitResponse

  // ── Activate on first message ───────────────────────────────────────────────
  if (interview.status === 'created') {
    const { error: activateError } = await supabase
      .from('interviews')
      .update({ status: 'active' })
      .eq('id', interview.id)
    if (activateError) {
      return NextResponse.json({ error: 'Failed to activate interview' }, { status: 500 })
    }
  }

  // ── Load state + turns ──────────────────────────────────────────────────────
  const [{ data: rawState }, { data: rawTurns }] = await Promise.all([
    supabase
      .from('interview_state')
      .select('phase, timer_minutes, topics_covered, topics_open, extractions_log, step_tracker, opener_text')
      .eq('interview_id', interview.id)
      .maybeSingle(),
    supabase
      .from('turns')
      .select('turn_number, user_input, agent_response, created_at')
      .eq('interview_id', interview.id)
      .order('turn_number', { ascending: true }),
  ])

  const state = rawState as (Partial<StateRow> & { step_tracker?: unknown }) | null
  const existingTurns = (rawTurns as TurnRow[]) ?? []
  const currentPhase = (state?.phase ?? 'intro') as Phase
  const stepTracker: StepEntry[] = ((state?.step_tracker as unknown[] | null) ?? [])
    .map((raw, i) => normalizeStepEntry(raw, i + 1))
  const nextTurnNumber = existingTurns.length + 1

  let timerMinutes = 0
  if (existingTurns.length > 0) {
    const firstTurnTime = new Date(existingTurns[0].created_at).getTime()
    timerMinutes = Math.floor((Date.now() - firstTurnTime) / 60000)
  }

  // ── Build full history (including current user turn) ────────────────────────
  const history: TurnMessage[] = existingTurns.flatMap((t) => [
    { role: 'user' as const, content: t.user_input },
    { role: 'assistant' as const, content: t.agent_response },
  ])
  // B2: opener_text is saved to interview_state (not as a DB turn) — inject it
  // as the first assistant message so the Talker doesn't re-greet the interviewee.
  if (existingTurns.length === 0 && state?.opener_text) {
    history.unshift({ role: 'assistant' as const, content: state.opener_text as string })
  }
  history.push({ role: 'user', content: user_input })

  // ── Read Analyst briefing from previous turn ────────────────────────────────
  const analystStatus = interview.analyst_status ?? 'idle'
  const analystBriefing: AnalystBriefing | null = (interview.next_briefing as AnalystBriefing | null) ?? null
  // F3: Seed filler phrase list with common German fillers from Turn 1 onward.
  // Prevents "Das ist..." / "Vielen Dank" from appearing even on first turns.
  const SEED_FILLERS = [
    'Das ist ein', 'Das ist eine', 'Das klingt', 'Das macht',
    'Vielen Dank', 'Danke', 'Ich danke', 'Sehr gut',
    'Interessant', 'Gut,', 'Alles klar',
  ]
  const persistedFillers = analystBriefing?.usedFillerPhrases ?? []
  const usedFillerPhrases: string[] = persistedFillers.length === 0
    ? SEED_FILLERS
    : persistedFillers

  // ── Iteration 2: Orchestrator decides phase ─────────────────────────────────
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

  // Log Orchestrator span
  const orchTelemetry = buildTraceMetadata('interview.orchestrator', {
    interviewId: interview.id,
    environment: 'prod',
    component: 'orchestrator',
  })
  if (orchTelemetry.isEnabled) {
    console.log('[orchestrator] phase decision', { from: currentPhase, analystStatus })
  }

  // Check lifecycle (complete interview if Hard-Stop or Soft-Confirm)
  const lifecycle = checkLifecycle(orchestratorCtx, analystBriefing)
  if (lifecycle.shouldComplete) {
    await supabase
      .from('interviews')
      .update({ status: 'completed', extractions_pending: true })
      .eq('id', interview.id)

    console.log('[orchestrator] lifecycle complete:', lifecycle.reason)

    // Trigger post-completion tasks fire-and-forget
    after(async () => {
      try {
        // B5: run Analyst on the final wrap-up user turn (shouldComplete path exits
        // before the normal Analyst after() block, so this turn would be skipped).
        const adminDb = getSupabaseAdmin()
        const { data: freshStateRow } = await adminDb
          .from('interview_state')
          .select('step_tracker')
          .eq('interview_id', interview.id)
          .maybeSingle()
        const freshStepTracker = ((freshStateRow?.step_tracker as unknown[] | null) ?? (stepTracker as unknown[]))
          .map((raw, i) => normalizeStepEntry(raw, i + 1))
        await runAnalystOnline({
          context: {
            interviewId: interview.id,
            workspaceId: interview.workspace_id,
            employeeName: interview.employee_name,
            employeeRole: interview.employee_role,
            department: interview.department,
            focusTopics: interview.focus_topics,
            phase: 'wrap_up',
            timerMinutes,
            topicsCovered: (state?.topics_covered as string[] | null) ?? [],
            topicsOpen: (state?.topics_open as string[] | null) ?? [],
            extractionsLog: (state?.extractions_log as RawExtraction[] | null) ?? [],
            maxDurationMinutes: interview.max_duration_minutes ?? 30,
            stepTracker: freshStepTracker,
          },
          history,
          currentUserInput: user_input,
          traceCtx: { interviewId: interview.id, environment: 'prod' },
        })
      } catch (err) {
        console.error('[chat] post-complete analyst failed:', err)
      }
      await createProcessStepsFromTracker({ interviewId: interview.id, workspaceId: interview.workspace_id })
      clusterProcessSteps(interview.workspace_id).catch((err) =>
        console.error('[chat] post-complete clusterProcessSteps failed:', err),
      )
      deduplicateKnowledgeObjects(interview.workspace_id).catch((err) =>
        console.error('[chat] post-complete deduplicateKnowledgeObjects failed:', err),
      )
    })

    // Save farewell turn before returning — Talker stream for farewell message
    const farewellContext = {
      interviewId: interview.id,
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
    }

    const farewellBriefing: AnalystBriefing = {
      next_focus: 'Verabschiedung',
      suggested_question: 'Verabschiede dich kurz und herzlich.',
    }

    const farewellStream = createTalkerStream({
      context: farewellContext,
      history,
      briefing: farewellBriefing,
      onFinish: async (agentText) => {
        if (!agentText) return
        await supabase.from('turns').insert({
          interview_id: interview.id,
          turn_number: nextTurnNumber,
          user_input,
          agent_response: agentText,
        })
      },
    })
    return farewellStream.toTextStreamResponse()
  }

  // Decide phase for this turn
  const { phase: nextPhaseDecision, phaseJustEntered } = decideNextPhaseWithMeta(orchestratorCtx, analystBriefing)
  // 'completed' means lifecycle.shouldComplete should have caught it above; treat as wrap_up for safety
  const orchestratedPhase: Phase = nextPhaseDecision === 'completed' ? 'wrap_up' : (nextPhaseDecision as Phase)

  // Update phase in DB if changed
  if (orchestratedPhase !== currentPhase) {
    await supabase
      .from('interview_state')
      .update({ phase: orchestratedPhase, updated_at: new Date().toISOString() })
      .eq('interview_id', interview.id)
  }

  // ── Fix 1 (ADR-015): Deterministic wrap_up question injection ───────────────
  // When transitioning into wrap_up for the first time, skip the Talker and
  // write the verbatim closing question as agent_response. This guarantees the
  // question is asked exactly once and exactly as designed — no LLM paraphrase,
  // no regex heuristic, no Analyst-flag race.
  if (shouldInjectWrapUpQuestion(orchestratedPhase, history)) {
    const agentText = WRAP_UP_QUESTION_TEXT
    await supabase.from('turns').insert({
      interview_id: interview.id,
      turn_number: nextTurnNumber,
      user_input,
      agent_response: agentText,
    })
    // Stream the constant text back to the client without invoking the LLM.
    const encoder = new TextEncoder()
    const injectedStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(agentText))
        controller.close()
      },
    })
    return new Response(injectedStream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  // ── Fix 2 (ADR-015): Synchronous Pre-Talker Quick-Extract ─────────────────
  // Closes the 1-turn race between Analyst (post-Talker, async) and the next
  // Talker turn. Runs only when steps are already registered so it can never
  // fragment the tracker. Failures are non-fatal — the full Analyst still runs.
  // runQuickExtract returns fresh tracker when it made tool calls, null otherwise.
  // Eliminates an extra DB round-trip on every turn.
  let freshStepTracker = stepTracker
  if (stepTracker.length > 0) {
    const activeStep = stepTracker.find(s => s.status === 'exploring' || s.status === 'walkthrough')
    const qeTracker = await runQuickExtract({
      interviewId: interview.id,
      workspaceId: interview.workspace_id,
      userInput: user_input,
      stepTracker,
      currentTurnNumber: nextTurnNumber,
      activeStepTitle: activeStep?.title ?? null,
    })
    if (qeTracker !== null) freshStepTracker = qeTracker
  }

  // ── Compute missing slots for slot_completion / coverage_check ──────────────
  const missingSlotsForCoverageCheck =
    orchestratedPhase === 'coverage_check' || orchestratedPhase === 'slot_completion'
      ? computeMissingMandatorySlots(freshStepTracker)
      : undefined

  // ── Catch-up run detection (analyst_status='failed') ───────────────────────
  const needsCatchup = analystStatus === 'failed'

  // ── Iteration 3: Talker stream (text-only, no tools) ───────────────────────

  // Set analyst_status='processing' (non-blocking write, Orchestrator span)
  // Non-blocking: set analyst_status='processing' before Talker stream starts
  void supabase.from('interviews').update({ analyst_status: 'processing' }).eq('id', interview.id).then(() => {}, () => {})

  const currentLog = (state?.extractions_log as RawExtraction[] | null) ?? []

  const stream = createTalkerStream({
    context: {
      interviewId: interview.id,
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
    userInput: user_input,
    onFinish: async (agentText) => {
      if (!agentText) return

      const { data: newTurn, error: turnError } = await supabase
        .from('turns')
        .insert({
          interview_id: interview.id,
          turn_number: nextTurnNumber,
          user_input,
          agent_response: agentText,
        })
        .select('id')
        .single()
      if (turnError) console.error('[onFinish] turns insert failed:', turnError.message)

      const { error: stateError } = await supabase
        .from('interview_state')
        .update({
          timer_minutes: timerMinutes,
          updated_at: new Date().toISOString(),
          extractions_log: currentLog as unknown as import('@/lib/database.types').Json,
        })
        .eq('interview_id', interview.id)
      if (stateError) console.error('[onFinish] state update failed:', stateError.message)

      // Post-completion tasks: fire-and-forget extraction pipeline
      const runPostCompletionTasks = async () => {
        const { data: ci } = await supabase
          .from('interviews')
          .select('status')
          .eq('id', interview.id)
          .single()
        if (ci?.status !== 'completed') return
        await createProcessStepsFromTracker({ interviewId: interview.id, workspaceId: interview.workspace_id })
        clusterProcessSteps(interview.workspace_id).catch((err) =>
          console.error('[chat] clusterProcessSteps failed:', err),
        )
        deduplicateKnowledgeObjects(interview.workspace_id).catch((err) =>
          console.error('[chat] deduplicateKnowledgeObjects failed:', err),
        )
      }

      // extractAndEmbed: post-turn semantic extraction (knowledge_objects)
      // Continues to run alongside the Analyst's live tracker-pflege (PROJ-20 out of scope)
      if (newTurn?.id) {
        const transcript = [
          ...existingTurns.map((t) => ({ user_input: t.user_input, agent_response: t.agent_response })),
          { user_input, agent_response: agentText },
        ]
        extractAndEmbed({
          interviewId: interview.id,
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
                .eq('interview_id', interview.id)
              if (error) console.error('[onFinish] extractions_log update failed:', error.message)
            }
            await runPostCompletionTasks()
          })
          .catch((err) => console.error('[onFinish] extractAndEmbed failed:', err))
      } else {
        await runPostCompletionTasks()
      }
    },
  })

  // ── Iteration 3: Analyst runs in background ─────────────────────────────────
  after(async () => {
    try {
      const analystHistory = history // includes current user_input as last message

      // Reload step_tracker so Analyst sees slots filled by Talker tools during streaming.
      // Pre-streaming stepTracker is stale — tools update DB after state was loaded.
      const adminDb = getSupabaseAdmin()
      const { data: freshStateRow } = await adminDb
        .from('interview_state')
        .select('step_tracker')
        .eq('interview_id', interview.id)
        .maybeSingle()
      const freshStepTracker = ((freshStateRow?.step_tracker as unknown[] | null) ?? (stepTracker as unknown[]))
        .map((raw, i) => normalizeStepEntry(raw, i + 1))

      if (needsCatchup && existingTurns.length >= 2) {
        // Catch-up: previous analyst failed, process two turns at once
        const prevUserInput = existingTurns[existingTurns.length - 1]?.user_input ?? ''
        await runAnalystFailureRetry({
          context: {
            interviewId: interview.id,
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
          },
          history: analystHistory,
          previousUserInput: prevUserInput,
          currentUserInput: user_input,
          traceCtx: { interviewId: interview.id, environment: 'prod' },
        })
      } else {
        const sharedContext = {
          interviewId: interview.id,
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
        }

        // Online analyst: extracts from current turn only
        await runAnalystOnline({
          context: sharedContext,
          history: analystHistory,
          currentUserInput: user_input,
          traceCtx: { interviewId: interview.id, environment: 'prod' },
        })

        // History catchup: runs once when entering coverage_check or wrap_up.
        // Fills slots mentioned in earlier turns but not yet recorded.
        // Idempotency: phaseJustEntered is non-null only on the turn where the
        // phase changes — so this fires at most once per phase transition.
        const shouldRunCatchup =
          phaseJustEntered === 'coverage_check' || phaseJustEntered === 'wrap_up'
        if (shouldRunCatchup) {
          // Reload step_tracker after online analyst to get freshest slots
          const { data: postOnlineStateRow } = await adminDb
            .from('interview_state')
            .select('step_tracker')
            .eq('interview_id', interview.id)
            .maybeSingle()
          const postOnlineTracker = ((postOnlineStateRow?.step_tracker as unknown[] | null) ?? (freshStepTracker as unknown[]))
            .map((raw, i) => normalizeStepEntry(raw, i + 1))

          await runAnalystCatchup({
            context: { ...sharedContext, stepTracker: postOnlineTracker },
            history: analystHistory,
            currentUserInput: user_input,
            traceCtx: { interviewId: interview.id, environment: 'prod' },
          })
        }
      }
    } catch (err) {
      console.error('[analyst] background run error:', err)
    }
  })

  return stream.toTextStreamResponse()
}
