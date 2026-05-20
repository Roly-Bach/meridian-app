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
      single: vi.fn().mockResolvedValue({ data: { id: 'ws-1' }, error: null }),
    }),
  }),
}))

import { GET } from './route'

const WORKSPACE_ID = 'ws-1'
const SAMPLE_UCS = [
  { id: 'uc-1', type: 'automation', title: 'Test', roi_eur_per_year: 10000, score: 10000, quarter: 'Q1' },
  { id: 'uc-2', type: 'rag', title: 'RAG', roi_eur_per_year: 2000, score: 1000, quarter: 'Q2' },
]

function makeRequest(ws?: string) {
  const url = ws
    ? `http://localhost/api/use-cases?workspace_id=${ws}`
    : 'http://localhost/api/use-cases'
  return new Request(url)
}

describe('GET /api/use-cases', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as never)
    const res = await GET(makeRequest(WORKSPACE_ID))
    expect(res.status).toBe(401)
  })

  it('returns 400 when workspace_id missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
  })

  it('returns use_cases and total_roi_eur', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: SAMPLE_UCS, error: null }),
    })
    const res = await GET(makeRequest(WORKSPACE_ID))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.use_cases).toHaveLength(2)
    expect(json.total_roi_eur).toBe(12000)
  })

  it('returns empty array when no use_cases', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
    const res = await GET(makeRequest(WORKSPACE_ID))
    const json = await res.json()
    expect(json.use_cases).toEqual([])
    expect(json.total_roi_eur).toBe(0)
  })
})
