import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockAdminFrom } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: mockAdminFrom }),
}))

vi.mock('@/services/interviewAgent', () => ({
  createInterviewStream: vi.fn().mockReturnValue({
    toDataStreamResponse: vi.fn().mockReturnValue(new Response('stream', { status: 200 })),
  }),
}))

import { GET } from './route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'valid-token-abc'
const FUTURE_EXPIRY = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
const PAST_EXPIRY = new Date(Date.now() - 1000).toISOString()

function makeGETRequest(token: string) {
  return new Request(`http://localhost/api/interview/${token}`)
}

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) }
}

// ─── GET /api/interview/[token] ───────────────────────────────────────────────

describe('GET /api/interview/[token]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for unknown token', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
    })

    const res = await GET(makeGETRequest('bad-token'), makeParams('bad-token'))
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

    const res = await GET(makeGETRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(410)
    const json = await res.json()
    expect(json.error).toContain('nicht mehr gültig')
  })

  it('returns 200 with interview data and turns for valid token', async () => {
    const interview = {
      id: 'iv-123',
      employee_name: 'Hans',
      employee_role: 'Schichtleiter',
      department: 'Fertigung',
      focus_topics: null,
      status: 'active',
      token_expires_at: FUTURE_EXPIRY,
    }
    const state = { phase: 'exploration', timer_minutes: 10, topics_covered: [], topics_open: [] }
    const turns = [
      {
        id: 't1',
        turn_number: 1,
        user_input: 'Hallo',
        agent_response: 'Willkommen',
        created_at: new Date().toISOString(),
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
        single: vi.fn().mockResolvedValue({ data: state, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: turns, error: null }),
      })

    const res = await GET(makeGETRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.interview.id).toBe('iv-123')
    expect(json.turns).toHaveLength(1)
    expect(json.state.phase).toBe('exploration')
  })
})
