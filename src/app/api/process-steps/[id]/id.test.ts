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

import { PATCH } from './route'

const STEP_ID = 'step-uuid-1'
const WORKSPACE_ID = 'ws-1'

function makeRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/process-steps/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('PATCH /api/process-steps/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as never)

    const res = await PATCH(makeRequest(STEP_ID, { frequency: 4 }), makeParams(STEP_ID))
    expect(res.status).toBe(401)
  })

  it('returns 400 for negative frequency', async () => {
    const res = await PATCH(makeRequest(STEP_ID, { frequency: -1 }), makeParams(STEP_ID))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(JSON.stringify(json.error)).toContain('≥ 0')
  })

  it('returns 400 for error_rate_percent > 100', async () => {
    const res = await PATCH(makeRequest(STEP_ID, { error_rate_percent: 150 }), makeParams(STEP_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 for unknown fields (strict schema)', async () => {
    const res = await PATCH(makeRequest(STEP_ID, { unknown_field: 'foo' }), makeParams(STEP_ID))
    expect(res.status).toBe(400)
  })

  it('returns 404 when step not found', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
    })

    const res = await PATCH(makeRequest(STEP_ID, { frequency: 4 }), makeParams(STEP_ID))
    expect(res.status).toBe(404)
  })

  it('updates and returns the process step', async () => {
    const updatedStep = {
      id: STEP_ID,
      title: 'Rechnungen prüfen',
      frequency: 22,
      workspace_id: WORKSPACE_ID,
    }

    mockAdminFrom
      // Step lookup
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: STEP_ID, workspace_id: WORKSPACE_ID },
          error: null,
        }),
      })
      // Update
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedStep, error: null }),
      })

    const res = await PATCH(
      makeRequest(STEP_ID, { frequency: 22 }),
      makeParams(STEP_ID)
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.process_step.frequency).toBe(22)
  })

  it('returns 403 when step belongs to different workspace', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: STEP_ID, workspace_id: 'other-workspace' },
        error: null,
      }),
    })

    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as never)

    const res = await PATCH(makeRequest(STEP_ID, { frequency: 4 }), makeParams(STEP_ID))
    expect(res.status).toBe(403)
  })
})
