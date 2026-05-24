import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  createInterviewStream,
  computeMissingMandatorySlots,
  type Phase,
  type TurnMessage,
  type StepEntry,
} from '@/services/interviewAgent'
import { extractAndEmbed, type RawExtraction } from '@/services/extraction'
import { enrichProcessSteps } from '@/services/processEnrichment'
import { checkTokenEndpointLimits, extractIP } from '@/lib/ratelimit'
import type { Database } from '@/lib/database.types'

type InterviewRow = Database['public']['Tables']['interviews']['Row']
type StateRow = Database['public']['Tables']['interview_state']['Row']
type TurnRow = Database['public']['Tables']['turns']['Row']

const ChatInputSchema = z.object({
  user_input: z.string().min(1, 'Nachricht darf nicht leer sein').max(10000),
})

const TOKEN_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── POST /api/interview/[token]/chat ─────────────────────────────────────────
// Public endpoint — authenticated via token only.
// Streams the agent response as a text stream.

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
    .select('id, workspace_id, employee_name, employee_role, department, focus_topics, status, token_expires_at, max_duration_minutes, created_at')
    .eq('access_token', token)
    .single()

  const interview = rawInterview as InterviewRow | null

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

  // ── Compute missing slots for coverage_check phase ──────────────────────────
  const missingSlotsForCoverageCheck =
    currentPhase === 'coverage_check'
      ? computeMissingMandatorySlots(stepTracker)
      : undefined

  // ── Build conversation history ──────────────────────────────────────────────
  const history: TurnMessage[] = existingTurns.flatMap((t) => [
    { role: 'user' as const, content: t.user_input },
    { role: 'assistant' as const, content: t.agent_response },
  ])
  history.push({ role: 'user', content: user_input })

  // ── Stream agent response ───────────────────────────────────────────────────
  const stream = createInterviewStream({
    context: {
      interviewId: interview.id,
      workspaceId: interview.workspace_id,
      employeeName: interview.employee_name,
      employeeRole: interview.employee_role,
      department: interview.department,
      focusTopics: interview.focus_topics,
      phase: currentPhase,
      timerMinutes,
      topicsCovered: state?.topics_covered ?? [],
      topicsOpen: state?.topics_open ?? [],
      extractionsLog: (state?.extractions_log as RawExtraction[] | null) ?? [],
      maxDurationMinutes: interview.max_duration_minutes ?? 30,
      stepTracker,
      missingSlotsForCoverageCheck,
    },
    history,
    onFinish: async (agentText) => {
      if (!agentText) return

      const { data: newTurn, error: turnError } = await supabase.from('turns').insert({
        interview_id: interview.id,
        turn_number: nextTurnNumber,
        user_input,
        agent_response: agentText,
      }).select('id').single()
      if (turnError) console.error('[onFinish] turns insert failed:', turnError.message)

      // Await extraction so knowledge_objects are in DB before potential enrichment
      let newExtractions: RawExtraction[] = []
      if (newTurn?.id) {
        const transcript = [
          ...existingTurns.map(t => ({ user_input: t.user_input, agent_response: t.agent_response })),
          { user_input, agent_response: agentText },
        ]
        newExtractions = await extractAndEmbed({
          interviewId: interview.id,
          workspaceId: interview.workspace_id,
          turnId: newTurn.id,
          transcript,
        })
      }

      const currentLog = (state?.extractions_log as RawExtraction[] | null) ?? []
      const updatedLog = [...currentLog, ...newExtractions]

      const { error: stateError } = await supabase
        .from('interview_state')
        .update({
          timer_minutes: timerMinutes,
          updated_at: new Date().toISOString(),
          extractions_log: updatedLog as unknown as import('@/lib/database.types').Json,
        })
        .eq('interview_id', interview.id)
      if (stateError) console.error('[onFinish] state update failed:', stateError.message)

      // If the interview was completed this turn, enrich process steps now that
      // all knowledge_objects for this turn are committed to the DB
      const { data: currentInterview } = await supabase
        .from('interviews')
        .select('status')
        .eq('id', interview.id)
        .single()

      if (currentInterview?.status === 'completed') {
        await enrichProcessSteps({
          interviewId: interview.id,
          workspaceId: interview.workspace_id,
        })
      }
    },
  })

  return stream.toTextStreamResponse()
}
