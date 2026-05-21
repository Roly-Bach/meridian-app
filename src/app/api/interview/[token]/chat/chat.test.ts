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

vi.mock('@/services/interviewAgent', () => ({
  createInterviewStream: vi.fn().mockReturnValue({
    toTextStreamResponse: vi.fn().mockReturnValue(new Response('stream', { status: 200 })),
  }),
}))

vi.mock('@/services/extraction', () => ({
  extractAndEmbed: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/ratelimit', () => ({
  checkTokenEndpointLimits: mockCheckTokenEndpointLimits,
  extractIP: vi.fn().mockReturnValue('1.2.3.4'),
}))

import { POST } from './route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'valid-token-xyz'
const FUTURE_EXPIRY = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
const PAST_EXPIRY = new Date(Date.now() - 1000).toISOString()

function makePOSTRequest(token: string, body: unknown = { user_input: 'Hallo' }) {
  return new Request(`http://localhost/api/interview/${token}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) }
}

// ─── POST /api/interview/[token]/chat ─────────────────────────────────────────

describe('POST /api/interview/[token]/chat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 for invalid JSON', async () => {
    const req = new Request(`http://localhost/api/interview/${VALID_TOKEN}/chat`, {
      method: 'POST',
      body: 'not-json',
    })
    const res = await POST(req, makeParams(VALID_TOKEN))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid JSON')
  })

  it('returns 400 for empty user_input', async () => {
    const res = await POST(makePOSTRequest(VALID_TOKEN, { user_input: '' }), makeParams(VALID_TOKEN))
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown token', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
    })

    const res = await POST(makePOSTRequest('bad-token'), makeParams('bad-token'))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Interview not found')
  })

  it('returns 410 for expired token', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'iv-1', status: 'active', token_expires_at: PAST_EXPIRY },
        error: null,
      }),
    })

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(410)
    const json = await res.json()
    expect(json.error).toContain('nicht mehr gültig')
  })

  it('returns 429 with German error message and Retry-After header when rate limit exceeded', async () => {
    const rateLimitResponse = NextResponse.json(
      { error: 'Sie haben zu viele Nachrichten gesendet. Bitte warten Sie einen Moment.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
    mockCheckTokenEndpointLimits.mockResolvedValueOnce(rateLimitResponse)

    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'iv-1', status: 'active', token_expires_at: FUTURE_EXPIRY },
        error: null,
      }),
    })

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    const json = await res.json()
    expect(json.error).toBe('Sie haben zu viele Nachrichten gesendet. Bitte warten Sie einen Moment.')
  })

  it('returns 409 when interview is already completed', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'iv-completed',
          employee_name: 'Anna',
          employee_role: null,
          department: 'QA',
          focus_topics: null,
          status: 'completed',
          token_expires_at: FUTURE_EXPIRY,
          created_at: new Date().toISOString(),
        },
        error: null,
      }),
    })

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('abgeschlossen')
  })

  it('activates interview from created to active on first message', async () => {
    const updateMock = vi.fn().mockReturnThis()
    const eqUpdateMock = vi.fn().mockResolvedValue({ data: null, error: null })

    mockAdminFrom
      // Interview fetch
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'iv-new',
            employee_name: 'Klaus',
            employee_role: null,
            department: 'IT',
            focus_topics: null,
            status: 'created',
            token_expires_at: FUTURE_EXPIRY,
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      })
      // Status update: created → active
      .mockReturnValueOnce({
        update: updateMock,
        eq: eqUpdateMock,
      })
      // interview_state fetch (parallel)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { phase: 'intro', timer_minutes: 0, topics_covered: [], topics_open: [] },
          error: null,
        }),
      })
      // turns fetch (parallel)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(200)
    // Verify the activation update was called
    expect(updateMock).toHaveBeenCalledWith({ status: 'active' })
  })
})
