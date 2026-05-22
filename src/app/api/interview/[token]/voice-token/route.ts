import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkTokenEndpointLimits, extractIP } from '@/lib/ratelimit'

const TOKEN_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── POST /api/interview/[token]/voice-token ──────────────────────────────────
// Public endpoint — authenticated via interview access token only.
// Returns a short-lived ElevenLabs Scribe v2 Realtime session token.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!TOKEN_UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }
  const supabase = getSupabaseAdmin()

  // ── Load interview ──────────────────────────────────────────────────────────
  const { data: interview, error: fetchError } = await supabase
    .from('interviews')
    .select('id, token_expires_at, status')
    .eq('access_token', token)
    .single()

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

  // ── Fetch ElevenLabs session token ──────────────────────────────────────────
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    console.error('[voice-token] ELEVENLABS_API_KEY not configured')
    return NextResponse.json({ error: 'Voice feature not configured' }, { status: 503 })
  }

  let data: Record<string, unknown>
  try {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
        },
      }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error('[voice-token] ElevenLabs error:', response.status, text)
      return NextResponse.json(
        { error: 'Sprachaufnahme konnte nicht gestartet werden' },
        { status: 502 }
      )
    }

    data = (await response.json()) as Record<string, unknown>
  } catch (err) {
    console.error('[voice-token] fetch failed:', err)
    return NextResponse.json(
      { error: 'Sprachaufnahme konnte nicht gestartet werden' },
      { status: 502 }
    )
  }

  // ElevenLabs returns { token: "..." } for single-use tokens.
  // signed_url is a documented fallback for WebSocket-URL style responses.
  const sessionToken =
    (data.token as string | undefined) ??
    (data.signed_url as string | undefined)

  if (!sessionToken) {
    console.error('[voice-token] Unexpected response shape:', JSON.stringify(data))
    return NextResponse.json(
      { error: 'Sprachaufnahme konnte nicht gestartet werden' },
      { status: 502 }
    )
  }

  return NextResponse.json({ sessionToken })
}
