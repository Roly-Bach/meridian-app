import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { Database } from '@/lib/database.types'

type InterviewRow = Database['public']['Tables']['interviews']['Row']
type StateRow = Database['public']['Tables']['interview_state']['Row']
type TurnRow = Database['public']['Tables']['turns']['Row']

// ─── GET /api/interview/[token] ───────────────────────────────────────────────
// Public endpoint — no auth required.
// Returns interview metadata + all turns so the frontend can render history
// and detect reconnect scenarios.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = getSupabaseAdmin()

  const { data: rawInterview, error } = await supabase
    .from('interviews')
    .select('id, employee_name, employee_role, department, focus_topics, status, token_expires_at, max_duration_minutes')
    .eq('access_token', token)
    .single()

  const interview = rawInterview as InterviewRow | null

  if (error || !interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }

  if (new Date(interview.token_expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'Dieser Interview-Link ist nicht mehr gültig' },
      { status: 410 }
    )
  }

  const { data: rawState } = await supabase
    .from('interview_state')
    .select('phase, timer_minutes, topics_covered, topics_open')
    .eq('interview_id', interview.id)
    .single()

  const { data: rawTurns } = await supabase
    .from('turns')
    .select('id, turn_number, user_input, agent_response, created_at')
    .eq('interview_id', interview.id)
    .order('turn_number', { ascending: true })

  return NextResponse.json({
    interview,
    state: (rawState as Partial<StateRow> | null) ?? null,
    turns: (rawTurns as TurnRow[]) ?? [],
  })
}
