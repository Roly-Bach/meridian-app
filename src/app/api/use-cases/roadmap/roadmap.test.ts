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
      single: vi.fn().mockResolvedValue({ data: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, error: null }),
    }),
  }),
}))

import { GET } from './route'

const SAMPLE_UCS = [
  { id: 'uc-1', type: 'automation', title: 'Quick Win', roi_eur_per_year: 10000, score: 10000, quarter: 'Q1' },
  { id: 'uc-2', type: 'rag', title: 'Medium', roi_eur_per_year: 3000, score: 1500, quarter: 'Q2' },
  { id: 'uc-3', type: 'llm_extraction', title: 'Long Term', roi_eur_per_year: 500, score: 250, quarter: 'Q3' },
]

function makeRequest(ws?: string) {
  const url = ws
    ? `http://localhost/api/use-cases/roadmap?workspace_id=${ws}`
    : 'http://localhost/api/use-cases/roadmap'
  return new Request(url)
}

describe('GET /api/use-cases/roadmap', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as never)
    const res = await GET(makeRequest('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when workspace_id missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
  })

  it('returns 403 when workspace not owned', async () => {
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as never)
    const res = await GET(makeRequest('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))
    expect(res.status).toBe(403)
  })

  it('groups use_cases by quarter correctly', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: SAMPLE_UCS, error: null }),
    })

    const res = await GET(makeRequest('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.Q1).toHaveLength(1)
    expect(json.Q1[0].id).toBe('uc-1')
    expect(json.Q2).toHaveLength(1)
    expect(json.Q2[0].id).toBe('uc-2')
    expect(json.Q3).toHaveLength(1)
    expect(json.Q3[0].id).toBe('uc-3')
  })

  it('calculates per-quarter ROI correctly', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: SAMPLE_UCS, error: null }),
    })

    const res = await GET(makeRequest('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))
    const json = await res.json()

    expect(json.roi_Q1).toBe(10000)
    expect(json.roi_Q2).toBe(3000)
    expect(json.roi_Q3).toBe(500)
    expect(json.total_roi_eur).toBe(13500)
  })

  it('returns empty quarters when no use_cases', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })

    const res = await GET(makeRequest('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))
    const json = await res.json()
    expect(json.Q1).toEqual([])
    expect(json.Q2).toEqual([])
    expect(json.Q3).toEqual([])
    expect(json.total_roi_eur).toBe(0)
  })
})
