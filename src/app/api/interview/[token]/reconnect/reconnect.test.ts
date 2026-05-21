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

vi.mock('@/lib/ratelimit', () => ({
  checkTokenEndpointLimits: mockCheckTokenEndpointLimits,
  extractIP: vi.fn().mockReturnValue('1.2.3.4'),
}))

import { POST } from './route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'reconnect-token-xyz'
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

// ─── POST /api/interview/[token]/reconnect ────────────────────────────────────

describe('POST /api/interview/[token]/reconnect', () => {
  beforeEach(() => vi.clearAllMocks())

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

  it('accepts status: created (initial greeting)', async () => {
    const interview = {
      id: 'iv-new',
      employee_name: 'Anna',
      employee_role: 'Teamleiterin',
      department: 'Qualität',
      focus_topics: null,
      status: 'created',
      token_expires_at: FUTURE_EXPIRY,
    }
    mockAdminFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: interview, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { phase: 'intro', timer_minutes: 0, topics_covered: [], topics_open: [] }, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(200)
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
        data: { id: 'iv-1', status: 'completed', token_expires_at: FUTURE_EXPIRY },
        error: null,
      }),
    })

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe('Interview is already completed')
  })

  it('streams adaptive greeting for active interview with prior turns', async () => {
    const interview = {
      id: 'iv-active',
      employee_name: 'Hans',
      employee_role: 'Schichtleiter',
      department: 'Fertigung',
      focus_topics: null,
      status: 'active',
      token_expires_at: FUTURE_EXPIRY,
    }
    const state = { phase: 'exploration', timer_minutes: 15, topics_covered: ['Tagesablauf'], topics_open: [] }
    const turns = [
      {
        turn_number: 1,
        user_input: 'Hallo',
        agent_response: 'Willkommen',
        created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
    ]

    mockAdminFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: interview, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: state, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: turns, error: null }),
      })

    const { createInterviewStream } = await import('@/services/interviewAgent')
    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))

    expect(res.status).toBe(200)
    expect(createInterviewStream).toHaveBeenCalledWith(
      expect.objectContaining({ isReconnect: true })
    )
  })
})
