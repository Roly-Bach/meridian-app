import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { AnalystBriefing } from '@/services/interviewTypes'
import { checkTokenEndpointLimits, extractIP } from '@/lib/ratelimit'
import { runInterviewTurn } from '@/services/runInterviewTurn'
import type { Database } from '@/lib/database.types'

type InterviewRow = Database['public']['Tables']['interviews']['Row']
type TurnRow = Database['public']['Tables']['turns']['Row']

const ChatInputSchema = z.object({
  user_input: z.string().min(1, 'Nachricht darf nicht leer sein').max(10000),
})

const TOKEN_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── POST /api/interview/[token]/chat ─────────────────────────────────────────
// Prod adapter around runInterviewTurn (PROJ-33 / ADR-016).
// Responsibilities of this route:
//   - Validate HTTP input + UUID format
//   - Load interview by access_token (HTTP concern — not interviewId)
//   - 404 / 410 / 409 guards
//   - Rate limiting
//   - created → active activation
//   - timerMinutes calculation from first turn timestamp
//   - Delegate full turn logic to runInterviewTurn (Analyst now runs synchronously inside it — PROJ-44/ADR-021)
//   - Schedule post-response finalize (extractAndEmbed + onCompleted) via after()
//   - Return stream response

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

  // ── Load interview by access_token (HTTP concern — access_token is URL-based) ─
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

  // ── timerMinutes: HTTP concern — computed from first turn timestamp ──────────
  // runInterviewTurn receives timerMinutes as an input so it stays testable
  // without time-mocking. The route owns this computation.
  const { data: turnsForTimer } = await supabase
    .from('turns')
    .select('created_at')
    .eq('interview_id', interview.id)
    .order('turn_number', { ascending: true })
    .limit(1)

  const firstTurns = (turnsForTimer as Pick<TurnRow, 'created_at'>[] | null) ?? []
  const timerMinutes = firstTurns.length > 0
    ? Math.floor((Date.now() - new Date(firstTurns[0].created_at).getTime()) / 60000)
    : 0

  // ── Delegate to deep module ─────────────────────────────────────────────────
  const turn = await runInterviewTurn({
    interviewId: interview.id,
    userInput: user_input,
    timerMinutes,
    traceCtx: { interviewId: interview.id, environment: 'prod' },
  })

  after(() => turn.finalize())

  return turn.stream.toTextStreamResponse()
}
