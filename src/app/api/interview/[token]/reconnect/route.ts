import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { createInterviewStream, type Phase, type TurnMessage } from '@/services/interviewAgent'
import type { Database } from '@/lib/database.types'

type InterviewRow = Database['public']['Tables']['interviews']['Row']
type StateRow = Database['public']['Tables']['interview_state']['Row']
type TurnRow = Database['public']['Tables']['turns']['Row']

// ─── POST /api/interview/[token]/reconnect ────────────────────────────────────
// Public endpoint — authenticated via token only.
// Called when a returning employee opens an active interview.
// Streams an adaptive greeting. NOT saved as a turn in the DB.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = getSupabaseAdmin()

  const { data: rawInterview, error: fetchError } = await supabase
    .from('interviews')
    .select('id, employee_name, employee_role, department, focus_topics, status, token_expires_at, max_duration_minutes')
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

  const [{ data: rawState }, { data: rawTurns }] = await Promise.all([
    supabase
      .from('interview_state')
      .select('phase, timer_minutes, topics_covered, topics_open')
      .eq('interview_id', interview.id)
      .maybeSingle(),
    supabase
      .from('turns')
      .select('turn_number, user_input, agent_response, created_at')
      .eq('interview_id', interview.id)
      .order('turn_number', { ascending: true }),
  ])

  const state = rawState as Partial<StateRow> | null
  const existingTurns = (rawTurns as TurnRow[]) ?? []

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
      employeeName: interview.employee_name,
      employeeRole: interview.employee_role,
      department: interview.department,
      focusTopics: interview.focus_topics,
      phase: (state?.phase ?? 'intro') as Phase,
      timerMinutes,
      topicsCovered: state?.topics_covered ?? [],
      topicsOpen: state?.topics_open ?? [],
      maxDurationMinutes: interview.max_duration_minutes ?? 30,
    },
    history,
    isReconnect: true,
    // Reconnect greeting is not saved as a turn
  })

  return stream.toTextStreamResponse()
}
