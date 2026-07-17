import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_TOKEN = '22222222-2222-2222-2222-222222222222'
const FUTURE_EXPIRY = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
const PAST_EXPIRY = new Date(Date.now() - 1000).toISOString()

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) }
}

function makePOSTRequest(token: string) {
  return new Request(`http://localhost/api/interview/${token}/reconnect`, {
    method: 'POST',
  })
}

function mockInterviewFetch(data: object | null, error: Error | null = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
}

function mockTurnsFetch(data: object[] | null, error: Error | null = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error }),
  }
}

// ─── POST /api/interview/[token]/reconnect ────────────────────────────────────
// PROJ-44/ADR-021 D6: the LLM path is deleted without replacement — the route
// always returns a static re-engagement line once past the guards (no
// interview_state read, no createTalkerStream/createInterviewStream call).

describe('POST /api/interview/[token]/reconnect', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for unknown token', async () => {
    mockAdminFrom.mockReturnValue(mockInterviewFetch(null, new Error('Not found')))

    const res = await POST(makePOSTRequest('bad-token'), makeParams('bad-token'))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Interview not found')
  })

  it('returns 410 for expired token', async () => {
    mockAdminFrom.mockReturnValue(
      mockInterviewFetch({ id: 'iv-1', status: 'active', token_expires_at: PAST_EXPIRY })
    )

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(410)
    const json = await res.json()
    expect(json.error).toContain('nicht mehr gültig')
  })

  it('returns 409 for cold-start (no turns) — must use /start', async () => {
    mockAdminFrom
      .mockReturnValueOnce(mockInterviewFetch({ id: 'iv-new', status: 'created', token_expires_at: FUTURE_EXPIRY }))
      .mockReturnValueOnce(mockTurnsFetch([]))

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('/start')
  })

  it('returns 500 when the turns DB query fails', async () => {
    mockAdminFrom
      .mockReturnValueOnce(mockInterviewFetch({ id: 'iv-dberr', status: 'active', token_expires_at: FUTURE_EXPIRY }))
      .mockReturnValueOnce(mockTurnsFetch(null, new Error('DB unreachable')))

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBeTruthy()
  })

  it('returns 429 with German error message and Retry-After header when rate limit exceeded', async () => {
    const rateLimitResponse = NextResponse.json(
      { error: 'Sie haben zu viele Nachrichten gesendet. Bitte warten Sie einen Moment.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
    mockCheckTokenEndpointLimits.mockResolvedValueOnce(rateLimitResponse)

    mockAdminFrom.mockReturnValue(
      mockInterviewFetch({ id: 'iv-1', status: 'active', token_expires_at: FUTURE_EXPIRY })
    )

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    const json = await res.json()
    expect(json.error).toBe('Sie haben zu viele Nachrichten gesendet. Bitte warten Sie einen Moment.')
  })

  it('returns 409 when interview is already completed', async () => {
    mockAdminFrom.mockReturnValue(
      mockInterviewFetch({ id: 'iv-1', status: 'completed', token_expires_at: FUTURE_EXPIRY })
    )

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe('Interview is already completed')
  })

  // KI-22 (2026-07-11) / PROJ-44 (2026-07-16): turns are always persisted as
  // atomic (user_input, agent_response) pairs, so a returning employee always
  // finds the agent mid-question — this is the ONLY case that occurs in
  // practice, which is exactly why ADR-021 D6 deletes the LLM path rather than
  // keeping it as dead code. The route now always returns the static
  // re-engagement line for an active interview with existing turns.
  it('returns a static re-engagement line without any LLM call', async () => {
    mockAdminFrom
      .mockReturnValueOnce(mockInterviewFetch({ id: 'iv-active', status: 'active', token_expires_at: FUTURE_EXPIRY }))
      .mockReturnValueOnce(mockTurnsFetch([{ turn_number: 1 }]))

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))

    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe('Willkommen zurück — lass uns da weitermachen, wo wir aufgehört haben.')
  })
})
