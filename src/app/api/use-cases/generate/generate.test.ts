import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAdminFrom } = vi.hoisted(() => ({ mockAdminFrom: vi.fn() }))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: mockAdminFrom }),
}))

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'ws-1', hourly_rate: 45 }, error: null }),
    }),
  }),
}))

vi.mock('@/services/useCaseEngine', () => ({
  runHeuristicEngine: vi.fn().mockReturnValue([
    {
      process_step_id: 'step-1',
      workspace_id: 'ws-1',
      type: 'automation',
      title: 'Test Use Case',
      description: 'desc',
      reasoning: 'reason',
      effort: 'low',
      roi_hours_per_year: 100,
      roi_eur_per_year: 4500,
      score: 4500,
      priority: 'medium',
      quarter: 'Q2',
    },
  ]),
}))

import { POST } from './route'

const WORKSPACE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/use-cases/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/use-cases/generate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as never)
    const res = await POST(makeRequest({ workspace_id: WORKSPACE_ID }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid UUID', async () => {
    const res = await POST(makeRequest({ workspace_id: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing body', async () => {
    const res = await POST(new Request('http://localhost/api/use-cases/generate', { method: 'POST', body: 'bad' }))
    expect(res.status).toBe(400)
  })

  it('returns 403 when workspace not owned by user', async () => {
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as never)
    const res = await POST(makeRequest({ workspace_id: WORKSPACE_ID }))
    expect(res.status).toBe(403)
  })

  it('returns empty when no process_steps exist', async () => {
    mockAdminFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      })
    const res = await POST(makeRequest({ workspace_id: WORKSPACE_ID }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.use_cases).toEqual([])
    expect(json.total_roi_eur).toBe(0)
  })

  it('inserts new use_cases then deletes old ones (safe order)', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const deleteMock = vi.fn().mockReturnThis()
    const deleteInMock = vi.fn().mockResolvedValue({ error: null })

    mockAdminFrom
      // process_steps fetch
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ id: 'step-1', workspace_id: 'ws-1', title: 'Test', description: null, frequency_per_month: 22, duration_minutes: 60, data_sources: [], rule_based: true, error_rate_percent: 5, media_breaks: 0 }],
          error: null,
        }),
      })
      // fetch existing IDs
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [{ id: 'old-uc-1' }], error: null }),
      })
      // insert new
      .mockReturnValueOnce({ insert: insertMock })
      // delete old by IDs
      .mockReturnValueOnce({ delete: deleteMock, in: deleteInMock })
      // fetch back
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [{ id: 'uc-1', roi_eur_per_year: 4500, quarter: 'Q2' }], error: null }),
      })

    const res = await POST(makeRequest({ workspace_id: WORKSPACE_ID }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.use_cases).toHaveLength(1)
    expect(insertMock).toHaveBeenCalled()
    expect(deleteMock).toHaveBeenCalled()
  })
})
