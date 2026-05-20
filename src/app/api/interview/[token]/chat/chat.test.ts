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
    toTextStreamResponse: vi.fn().mockReturnValue(new Response('stream', { status: 200 })),
  }),
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
})
