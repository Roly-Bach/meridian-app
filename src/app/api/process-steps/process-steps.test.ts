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

const WORKSPACE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function makeRequest(workspaceId?: string) {
  const url = workspaceId
    ? `http://localhost/api/process-steps?workspace_id=${workspaceId}`
    : 'http://localhost/api/process-steps'
  return new Request(url)
}

describe('GET /api/process-steps', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as never)

    const res = await GET(makeRequest(WORKSPACE_ID))
    expect(res.status).toBe(401)
  })

  it('returns 400 when workspace_id param missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
  })

  it('returns 403 when workspace not owned by user', async () => {
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
      }),
    } as never)

    const res = await GET(makeRequest(WORKSPACE_ID))
    expect(res.status).toBe(403)
  })

  it('returns process_steps for authorized workspace', async () => {
    const mockSteps = [
      { id: 'step-1', title: 'Rechnungen prüfen', workspace_id: WORKSPACE_ID },
      { id: 'step-2', title: 'Bestellung erfassen', workspace_id: WORKSPACE_ID },
    ]

    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockSteps, error: null }),
    })

    const res = await GET(makeRequest(WORKSPACE_ID))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.process_steps).toHaveLength(2)
    expect(json.process_steps[0].title).toBe('Rechnungen prüfen')
  })

  it('returns empty array when no process steps', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })

    const res = await GET(makeRequest(WORKSPACE_ID))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.process_steps).toEqual([])
  })
})
