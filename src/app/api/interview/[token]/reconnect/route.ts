import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const TOKEN_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
import { createInterviewStream } from '@/services/interviewAgent'
import type { Phase, StepEntry } from '@/services/interviewSemantic'
import type { TurnMessage } from '@/services/interviewTypes'
import { checkTokenEndpointLimits, extractIP } from '@/lib/ratelimit'
import type { Database } from '@/lib/database.types'
import type { RawExtraction } from '@/services/extraction'

type InterviewRow = Database['public']['Tables']['interviews']['Row']
type StateRow = Database['public']['Tables']['interview_state']['Row']
type TurnRow = Database['public']['Tables']['turns']['Row']

// ─── POST /api/interview/[token]/reconnect ────────────────────────────────────
// Public endpoint — authenticated via token only.
// Called when a returning employee opens an active interview.
// Streams an adaptive greeting. NOT saved as a turn in the DB.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!TOKEN_UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }
  const supabase = getSupabaseAdmin()

  const { data: rawInterview, error: fetchError } = await supabase
    .from('interviews')
    .select('id, workspace_id, employee_name, employee_role, department, focus_topics, status, token_expires_at, max_duration_minutes')
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
    return NextResponse.json({ error: 'Interview is already completed' }, { status: 409 })
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const ip = extractIP(req)
  const rateLimitResponse = await checkTokenEndpointLimits(token, ip)
  if (rateLimitResponse) return rateLimitResponse

  const [{ data: rawState }, { data: rawTurns, error: turnsError }] = await Promise.all([
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

  if (turnsError) {
    return NextResponse.json({ error: 'Interner Fehler beim Laden des Gesprächs.' }, { status: 500 })
  }

  const state = rawState as (Partial<StateRow> & { step_tracker?: unknown }) | null
  const existingTurns = (rawTurns as TurnRow[]) ?? []
  const stepTracker: StepEntry[] = (state?.step_tracker as StepEntry[] | null) ?? []

  if (existingTurns.length === 0) {
    return NextResponse.json(
      { error: 'Kein bisheriges Gespräch — bitte /start für den ersten Aufruf verwenden.' },
      { status: 409 }
    )
  }

  let timerMinutes = 0
  if (existingTurns.length > 0) {
    const firstTurnTime = new Date(existingTurns[0].created_at).getTime()
    timerMinutes = Math.floor((Date.now() - firstTurnTime) / 60000)
  }

  const history: TurnMessage[] = existingTurns.flatMap((t) => [
    { role: 'user' as const, content: t.user_input },
    { role: 'assistant' as const, content: t.agent_response },
  ])

  const stream = createInterviewStream({
    context: {
      interviewId: interview.id,
      workspaceId: interview.workspace_id,
      employeeName: interview.employee_name,
      employeeRole: interview.employee_role,
      department: interview.department,
      focusTopics: interview.focus_topics,
      phase: (state?.phase ?? 'intro') as Phase,
      timerMinutes,
      topicsCovered: state?.topics_covered ?? [],
      topicsOpen: state?.topics_open ?? [],
      extractionsLog: (state?.extractions_log as RawExtraction[] | null) ?? [],
      maxDurationMinutes: interview.max_duration_minutes ?? 30,
      stepTracker,
    },
    history,
    isReconnect: true,
    // Reconnect greeting is not saved as a turn
  })

  return stream.toTextStreamResponse()
}
