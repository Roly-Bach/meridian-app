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

vi.mock('@/services/processEnrichment', () => ({
  enrichProcessSteps: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from './route'
import { enrichProcessSteps } from '@/services/processEnrichment'

const INTERVIEW_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5'
const WORKSPACE_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/process-steps/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/process-steps/generate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as never)

    const res = await POST(makeRequest({ interview_id: INTERVIEW_ID }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(
      new Request('http://localhost/api/process-steps/generate', {
        method: 'POST',
        body: 'not-json',
      })
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid UUID', async () => {
    const res = await POST(makeRequest({ interview_id: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when interview not found', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
    })

    const res = await POST(makeRequest({ interview_id: INTERVIEW_ID }))
    expect(res.status).toBe(404)
  })

  it('calls enrichProcessSteps and returns process_steps on success', async () => {
    const mockSteps = [
      { id: 'step-1', title: 'Rechnungen prüfen', interview_id: INTERVIEW_ID, workspace_id: WORKSPACE_ID },
    ]

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
      // process_steps fetch after enrichment
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockSteps, error: null }),
      })

    const res = await POST(makeRequest({ interview_id: INTERVIEW_ID }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.count).toBe(1)
    expect(json.process_steps[0].title).toBe('Rechnungen prüfen')
    expect(enrichProcessSteps).toHaveBeenCalledWith({
      interviewId: INTERVIEW_ID,
      workspaceId: WORKSPACE_ID,
    })
  })
})
