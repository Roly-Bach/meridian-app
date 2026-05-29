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
import { decideNextPhase, checkLifecycle, type OrchestratorContext } from '@/services/interviewOrchestrator'
import { createTalkerStream } from '@/services/interviewTalker'
import { runAnalyst, runAnalystCatchup } from '@/services/interviewAnalyst'
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
      .select('phase, timer_minutes, topics_covered, topics_open, extractions_log, step_tracker')
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
  const stepTracker: StepEntry[] = (state?.step_tracker as StepEntry[] | null) ?? []
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
  history.push({ role: 'user', content: user_input })

  // ── Read Analyst briefing from previous turn ────────────────────────────────
  const analystStatus = interview.analyst_status ?? 'idle'
  const analystBriefing: AnalystBriefing | null = (interview.next_briefing as AnalystBriefing | null) ?? null

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
  const nextPhaseDecision = decideNextPhase(orchestratorCtx, analystBriefing)
  // 'completed' means lifecycle.shouldComplete should have caught it above; treat as wrap_up for safety
  const orchestratedPhase: Phase = nextPhaseDecision === 'completed' ? 'wrap_up' : (nextPhaseDecision as Phase)

  // Update phase in DB if changed
  if (orchestratedPhase !== currentPhase) {
    await supabase
      .from('interview_state')
      .update({ phase: orchestratedPhase, updated_at: new Date().toISOString() })
      .eq('interview_id', interview.id)
  }

  // ── Compute missing slots for slot_completion / coverage_check ──────────────
  const missingSlotsForCoverageCheck =
    orchestratedPhase === 'coverage_check' || orchestratedPhase === 'slot_completion'
      ? computeMissingMandatorySlots(stepTracker)
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
      stepTracker,
      missingSlotsForCoverageCheck,
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

      if (needsCatchup && existingTurns.length >= 2) {
        // Catch-up: previous analyst failed, process two turns at once
        const prevUserInput = existingTurns[existingTurns.length - 1]?.user_input ?? ''
        await runAnalystCatchup({
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
            stepTracker,
          },
          history: analystHistory,
          previousUserInput: prevUserInput,
          traceCtx: { interviewId: interview.id, environment: 'prod' },
        })
      } else {
        await runAnalyst({
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
            stepTracker,
          },
          history: analystHistory,
          traceCtx: { interviewId: interview.id, environment: 'prod' },
        })
      }
    } catch (err) {
      // runAnalyst already writes analyst_status='failed' on error
      console.error('[analyst] background run error:', err)
    }
  })

  return stream.toTextStreamResponse()
}
