import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockAdminFrom } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: mockAdminFrom }),
}))

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(),
  }),
}))

import { GET } from './route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'test-token-abc'
const INTERVIEW_ID = 'interview-uuid-1'
const WORKSPACE_ID = 'workspace-uuid-1'

const SAMPLE_OBJECTS = [
  {
    id: 'obj-1',
    type: 'process_step',
    content: { title: 'Rechnungen prüfen', description: 'Prüft eingehende Rechnungen', role: 'Buchhalter' },
    source_quote: 'Ich prüfe täglich die eingehenden Rechnungen',
    turn_id: 'turn-1',
    created_at: new Date().toISOString(),
  },
  {
    id: 'obj-2',
    type: 'tool',
    content: { name: 'SAP', purpose: 'Buchhaltungssystem' },
    source_quote: 'Wir nutzen SAP für alles',
    turn_id: 'turn-1',
    created_at: new Date().toISOString(),
  },
]

function makeGETRequest(token: string) {
  return new Request(`http://localhost/api/interview/${token}/objects`)
}

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) }
}

// ─── GET /api/interview/[token]/objects ───────────────────────────────────────

describe('GET /api/interview/[token]/objects', () => {
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

  it('returns 401 when no session', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: INTERVIEW_ID, workspace_id: WORKSPACE_ID },
        error: null,
      }),
    })
    // no session (user = null already default in mock)

    const res = await GET(makeGETRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns objects for authenticated user who owns workspace', async () => {
    const USER_ID = 'user-uuid-1'

    // Override createClient mock for this test — user is authenticated
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: WORKSPACE_ID }, error: null }),
      }),
    } as never)

    mockAdminFrom
      // Interview lookup
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: INTERVIEW_ID, workspace_id: WORKSPACE_ID },
          error: null,
        }),
      })
      // knowledge_objects fetch
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: SAMPLE_OBJECTS, error: null }),
      })

    const res = await GET(makeGETRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.count).toBe(2)
    expect(json.objects).toHaveLength(2)
    expect(json.objects[0].type).toBe('process_step')
    expect(json.objects[1].type).toBe('tool')
  })

  it('returns empty array when no objects extracted yet', async () => {
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: WORKSPACE_ID }, error: null }),
      }),
    } as never)

    mockAdminFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: INTERVIEW_ID, workspace_id: WORKSPACE_ID },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

    const res = await GET(makeGETRequest(VALID_TOKEN), makeParams(VALID_TOKEN))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.count).toBe(0)
    expect(json.objects).toEqual([])
  })
})
