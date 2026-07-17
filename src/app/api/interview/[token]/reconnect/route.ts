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
// PROJ-44/ADR-021 D6: the LLM path is deleted without replacement (was already
// unreachable in practice — KI-22, see below). Always returns a static
// re-engagement line — no LLM call, no interview_state read needed.
//
// KI-22 (2026-07-11): turns are persisted as atomic (user_input, agent_response)
// pairs (store.insertTurn writes both together, only after the agent has
// responded), so the agent is always mid-question on reconnect — there is no
// history shape where the LLM path would ever have fired a different reply.
// Previously this always went through the LLM anyway with a synthetic "Ich bin
// wieder da, können wir weitermachen?" nudge — the model's natural response was
// to re-pose the still-open question, which rendered as a near-verbatim
// duplicate of the already-visible last chat bubble (reproduced live, manual UI
// test 2026-07-07 — "Du hast vorhin 180 Rechnungen..." shown twice in a row).
// The pending question is already fully visible in the rendered history, so no
// LLM call is needed (also saves a cost+latency hit on every page reload, since
// the frontend fires /reconnect on every mount).

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

  return new Response('Willkommen zurück — lass uns da weitermachen, wo wir aufgehört haben.')
}
