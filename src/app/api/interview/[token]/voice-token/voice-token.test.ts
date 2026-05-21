import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockAdminFrom, mockCheckTokenEndpointLimits } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  mockCheckTokenEndpointLimits: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: mockAdminFrom }),
}))

vi.mock('@/lib/ratelimit', () => ({
  checkTokenEndpointLimits: mockCheckTokenEndpointLimits,
  extractIP: vi.fn().mockReturnValue('1.2.3.4'),
}))

import { POST } from './route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_TOKEN = '11111111-1111-1111-1111-111111111111'
const FUTURE_EXPIRY = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
const PAST_EXPIRY = new Date(Date.now() - 1000).toISOString()

function makePOSTRequest(token: string) {
  return new Request(`http://localhost/api/interview/${token}/voice-token`, {
    method: 'POST',
  })
}

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) }
}

function mockInterview(overrides: Partial<{ token_expires_at: string; status: string }> = {}) {
  const interview = {
    id: 'interview-id-1',
    token_expires_at: FUTURE_EXPIRY,
    status: 'active',
    ...overrides,
  }
  mockAdminFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: interview, error: null }),
  })
}

function mockInterviewNotFound() {
  mockAdminFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/interview/[token]/voice-token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns 404 for malformed (non-UUID) token', async () => {
    const res = await POST(makePOSTRequest('not-a-uuid'), makeParams('not-a-uuid'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when interview is not found in DB', async () => {
    mockInterviewNotFound()
    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(404)
  })

  it('returns 410 when interview token is expired', async () => {
    mockInterview({ token_expires_at: PAST_EXPIRY })
    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(410)
  })

  it('returns 409 when interview is already completed', async () => {
    mockInterview({ status: 'completed' })
    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(409)
  })

  it('returns 503 when ELEVENLABS_API_KEY is not configured', async () => {
    mockInterview()
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(503)
  })

  it('returns 502 when ElevenLabs API returns an error', async () => {
    mockInterview()
    vi.stubEnv('ELEVENLABS_API_KEY', 'sk_test_key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      })
    )
    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(502)
  })

  it('returns 502 when ElevenLabs response has unknown shape', async () => {
    mockInterview()
    vi.stubEnv('ELEVENLABS_API_KEY', 'sk_test_key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ unexpected_field: 'value' }),
      })
    )
    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(502)
  })

  it('returns 200 with sessionToken when ElevenLabs responds with signed_url field (fallback)', async () => {
    mockInterview()
    vi.stubEnv('ELEVENLABS_API_KEY', 'sk_test_key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ signed_url: 'wss://api.elevenlabs.io/...?token=xyz' }),
      })
    )
    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(200)
    const body = await res.json() as { sessionToken: string }
    expect(body.sessionToken).toBe('wss://api.elevenlabs.io/...?token=xyz')
  })

  it('returns 200 with sessionToken when ElevenLabs responds with token field', async () => {
    mockInterview()
    vi.stubEnv('ELEVENLABS_API_KEY', 'sk_test_key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'el-session-token-abc' }),
      })
    )
    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(200)
    const body = await res.json() as { sessionToken: string }
    expect(body.sessionToken).toBe('el-session-token-abc')
  })

  it('does not expose ELEVENLABS_API_KEY in the response', async () => {
    mockInterview()
    vi.stubEnv('ELEVENLABS_API_KEY', 'sk_secret_key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'el-session-token-abc' }),
      })
    )
    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    const body = JSON.stringify(await res.json())
    expect(body).not.toContain('sk_secret_key')
  })

  it('applies rate limiting before calling ElevenLabs', async () => {
    mockInterview()
    const rateLimitResponse = new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })
    mockCheckTokenEndpointLimits.mockResolvedValueOnce(rateLimitResponse)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(429)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
