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
import { createInterviewStream } from '@/services/interviewAgent'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_TOKEN = '33333333-3333-3333-3333-333333333333'
const FUTURE_EXPIRY = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
const PAST_EXPIRY = new Date(Date.now() - 1000).toISOString()

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) }
}

function makePOSTRequest(token: string) {
  return new Request(`http://localhost/api/interview/${token}/start`, {
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

function mockStateFetch(data: object | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  }
}

function mockTurnsFetch(turns: object[]) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: turns, error: null }),
  }
}

// ─── POST /api/interview/[token]/start ───────────────────────────────────────

describe('POST /api/interview/[token]/start', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for invalid token format', async () => {
    const res = await POST(makePOSTRequest('bad-token'), makeParams('bad-token'))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Interview not found')
  })

  it('returns 404 for unknown token', async () => {
    mockAdminFrom.mockReturnValue(mockInterviewFetch(null, new Error('Not found')))

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
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

  it('returns 409 when interview is already completed', async () => {
    mockAdminFrom.mockReturnValue(
      mockInterviewFetch({ id: 'iv-1', status: 'completed', token_expires_at: FUTURE_EXPIRY })
    )

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe('Interview is already completed')
  })

  it('returns 429 when rate limit exceeded', async () => {
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
  })

  it('returns 409 when turns already exist (use /reconnect)', async () => {
    const interview = {
      id: 'iv-active',
      employee_name: 'Anna',
      employee_role: 'Teamleiterin',
      department: 'Qualität',
      focus_topics: null,
      status: 'active',
      token_expires_at: FUTURE_EXPIRY,
    }
    const existingTurn = {
      turn_number: 1,
      user_input: 'Hallo',
      agent_response: 'Willkommen',
      created_at: new Date().toISOString(),
    }

    mockAdminFrom
      .mockReturnValueOnce(mockInterviewFetch(interview))
      .mockReturnValueOnce(mockStateFetch({ phase: 'intro' }))
      .mockReturnValueOnce(mockTurnsFetch([existingTurn]))

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('/reconnect')
  })

  it('streams personalized greeting for cold start (no turns)', async () => {
    const interview = {
      id: 'iv-new',
      workspace_id: 'ws-1',
      employee_name: 'Hans Müller',
      employee_role: 'Schichtleiter',
      department: 'Fertigung',
      focus_topics: 'Rüstzeiten',
      status: 'created',
      token_expires_at: FUTURE_EXPIRY,
      max_duration_minutes: 30,
    }

    mockAdminFrom
      .mockReturnValueOnce(mockInterviewFetch(interview))
      .mockReturnValueOnce(mockStateFetch(null))
      .mockReturnValueOnce(mockTurnsFetch([]))

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(200)
    expect(createInterviewStream).toHaveBeenCalledWith(
      expect.objectContaining({ isStart: true })
    )
  })

  it('passes employee_name, role, and focus_topics to createInterviewStream', async () => {
    const interview = {
      id: 'iv-new',
      workspace_id: 'ws-1',
      employee_name: 'Lena Braun',
      employee_role: 'Controllerin',
      department: 'Finanzen',
      focus_topics: 'Monatsabschluss',
      status: 'created',
      token_expires_at: FUTURE_EXPIRY,
      max_duration_minutes: 30,
    }

    mockAdminFrom
      .mockReturnValueOnce(mockInterviewFetch(interview))
      .mockReturnValueOnce(mockStateFetch(null))
      .mockReturnValueOnce(mockTurnsFetch([]))

    await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))

    expect(createInterviewStream).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          employeeName: 'Lena Braun',
          employeeRole: 'Controllerin',
          focusTopics: 'Monatsabschluss',
        }),
      })
    )
  })

  it('handles null employee_role and focus_topics without injecting placeholder strings', async () => {
    const interview = {
      id: 'iv-minimal',
      workspace_id: 'ws-1',
      employee_name: 'Max',
      employee_role: null,
      department: 'Unbekannt',
      focus_topics: null,
      status: 'created',
      token_expires_at: FUTURE_EXPIRY,
      max_duration_minutes: 30,
    }

    mockAdminFrom
      .mockReturnValueOnce(mockInterviewFetch(interview))
      .mockReturnValueOnce(mockStateFetch(null))
      .mockReturnValueOnce(mockTurnsFetch([]))

    const res = await POST(makePOSTRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(200)
    expect(createInterviewStream).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          employeeRole: null,
          focusTopics: null,
        }),
      })
    )
  })
})
