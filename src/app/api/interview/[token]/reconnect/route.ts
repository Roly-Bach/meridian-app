import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkTokenEndpointLimits, extractIP } from '@/lib/ratelimit'
import type { Database } from '@/lib/database.types'

const TOKEN_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type InterviewRow = Database['public']['Tables']['interviews']['Row']

// ─── POST /api/interview/[token]/reconnect ────────────────────────────────────
// Public endpoint — authenticated via token only.
// Called when a returning employee opens an active interview. NOT saved as a turn.
//
// PROJ-46/ADR-023 D6: validation-only — no assistant text returned at all (not
// even a static line). The endpoint's job is now purely to confirm the token is
// valid/not-expired/not-completed/has-turns; the frontend renders the
// persisted history and does not inject a greeting bubble on reconnect.
//
// KI-22 (2026-07-11): turns are persisted as atomic (user_input, agent_response)
// pairs (store.insertTurn writes both together, only after the agent has
// responded), so the agent is always mid-question on reconnect — the pending
// question is already fully visible in the rendered history. PROJ-44/ADR-021 D6
// first deleted the LLM path in favor of a static re-engagement line (avoiding a
// near-verbatim duplicate of the last chat bubble — reproduced live, manual UI
// test 2026-07-07); PROJ-46 goes one step further and drops the static line too,
// since the rendered history already shows the open question without it.

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
    .select('id, status, token_expires_at')
    .eq('access_token', token)
    .single()

  const interview = rawInterview as Pick<InterviewRow, 'id' | 'status' | 'token_expires_at'> | null

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

  const { data: turnsData, error: turnsError } = await supabase
    .from('turns')
    .select('turn_number')
    .eq('interview_id', interview.id)
    .limit(1)

  if (turnsError) {
    return NextResponse.json({ error: 'Interner Fehler beim Laden des Gesprächs.' }, { status: 500 })
  }

  if (!turnsData || turnsData.length === 0) {
    return NextResponse.json(
      { error: 'Kein bisheriges Gespräch — bitte /start für den ersten Aufruf verwenden.' },
      { status: 409 }
    )
  }

  // Empty 200 (not 204): useInterviewStream.ts's streamRequest reads
  // res.body.getReader() unconditionally — a 204's null body would throw
  // "Keine Antwort vom Server" there. An empty string body yields a valid,
  // immediately-closed stream instead.
  return new Response('', { status: 200 })
}
