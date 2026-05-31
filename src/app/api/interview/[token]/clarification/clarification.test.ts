import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockAdminFrom } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: mockAdminFrom }),
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    after: vi.fn().mockImplementation(() => {}),
  }
})

vi.mock('@/services/processEnrichment', () => ({
  createProcessStepsFromTracker: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/services/processClustering', () => ({
  clusterProcessSteps: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/services/extraction', () => ({
  deduplicateKnowledgeObjects: vi.fn().mockResolvedValue(undefined),
}))

// ─── Import after mocks ───────────────────────────────────────────────────────

import { POST } from './route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const INTERVIEW_ID = '11111111-2222-3333-4444-555555555555'
const WORKSPACE_ID = 'wwwwwwww-xxxx-yyyy-zzzz-aaaaaaaaaaaa'
const STEP_UUID = 'cccccccc-dddd-eeee-ffff-000000000000'

function makeParams(token = VALID_TOKEN) {
  return { params: Promise.resolve({ token }) }
}

function makeRequest(body: unknown, token = VALID_TOKEN) {
  return new Request(`http://localhost/api/interview/${token}/clarification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

type MockChain = {
  select: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
}

function buildChain(overrides: Partial<MockChain> = {}): MockChain {
  const chain: MockChain = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    ...overrides,
  }
  chain.select.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.single.mockReturnValue(chain)
  return chain
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/interview/[token]/clarification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 for invalid token format', async () => {
    const res = await POST(makeRequest({ answers: [] }, 'not-a-uuid'), makeParams('not-a-uuid'))
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid body (empty answers)', async () => {
    const chain = buildChain()
    chain.single.mockResolvedValue({
      data: {
        id: INTERVIEW_ID,
        workspace_id: WORKSPACE_ID,
        status: 'active',
        token_expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      error: null,
    })
    mockAdminFrom.mockReturnValue(chain)

    const res = await POST(makeRequest({ answers: [] }), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 404 when interview not found', async () => {
    const chain = buildChain()
    chain.single.mockResolvedValue({ data: null, error: { message: 'not found' } })
    mockAdminFrom.mockReturnValue(chain)

    const res = await POST(
      makeRequest({ answers: [{ process_step_id: 's1', slot_key: 'frequency_per_month', answer: 'Täglich' }] }),
      makeParams()
    )
    expect(res.status).toBe(404)
  })

  it('returns 410 for expired token', async () => {
    const chain = buildChain()
    chain.single.mockResolvedValue({
      data: {
        id: INTERVIEW_ID,
        workspace_id: WORKSPACE_ID,
        status: 'active',
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      },
      error: null,
    })
    mockAdminFrom.mockReturnValue(chain)

    const res = await POST(
      makeRequest({ answers: [{ process_step_id: 's1', slot_key: 'frequency_per_month', answer: 'Täglich' }] }),
      makeParams()
    )
    expect(res.status).toBe(410)
  })

  it('returns 409 (idempotent) when interview already completed', async () => {
    const chain = buildChain()
    chain.single.mockResolvedValue({
      data: {
        id: INTERVIEW_ID,
        workspace_id: WORKSPACE_ID,
        status: 'completed',
        token_expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      error: null,
    })
    mockAdminFrom.mockReturnValue(chain)

    const res = await POST(
      makeRequest({ answers: [{ process_step_id: 's1', slot_key: 'frequency_per_month', answer: 'Täglich' }] }),
      makeParams()
    )
    expect(res.status).toBe(409)
    const body = await res.json() as { success: boolean }
    expect(body.success).toBe(true)
  })

  it('processes SlotCard answers and completes interview — happy path', async () => {
    const updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    let callCount = 0
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'interviews') {
        callCount++
        if (callCount === 1) {
          // Initial fetch
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: INTERVIEW_ID,
                workspace_id: WORKSPACE_ID,
                status: 'active',
                token_expires_at: new Date(Date.now() + 86400000).toISOString(),
              },
              error: null,
            }),
          }
        }
        // Subsequent updates (clarification_answers + completed status)
        return {
          update: updateSpy,
        }
      }
      if (table === 'process_steps') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }
      }
      return buildChain()
    })

    const res = await POST(
      makeRequest({
        answers: [
          { process_step_id: STEP_UUID, slot_key: 'frequency_per_month', answer: 'Täglich' },
          { process_step_id: STEP_UUID, slot_key: 'duration_minutes', answer: '5–15 Min' },
        ],
      }),
      makeParams()
    )

    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean }
    expect(body.success).toBe(true)
  })

  it('"Weiß ich nicht" answer skips slot update', async () => {
    const processStepsUpdateSpy = vi.fn()

    let callCount = 0
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'interviews') {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: INTERVIEW_ID,
                workspace_id: WORKSPACE_ID,
                status: 'active',
                token_expires_at: new Date(Date.now() + 86400000).toISOString(),
              },
              error: null,
            }),
          }
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      if (table === 'process_steps') {
        return { update: processStepsUpdateSpy }
      }
      return buildChain()
    })

    await POST(
      makeRequest({
        answers: [{ process_step_id: 'Step A', slot_key: 'frequency_per_month', answer: 'Weiß ich nicht' }],
      }),
      makeParams()
    )

    expect(processStepsUpdateSpy).not.toHaveBeenCalled()
  })

  it('OpenItem "Ja" inserts knowledge_object row', async () => {
    const insertSpy = vi.fn().mockResolvedValue({ error: null })

    let callCount = 0
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'interviews') {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: INTERVIEW_ID,
                workspace_id: WORKSPACE_ID,
                status: 'active',
                token_expires_at: new Date(Date.now() + 86400000).toISOString(),
              },
              error: null,
            }),
          }
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      if (table === 'knowledge_objects') {
        return { insert: insertSpy }
      }
      return buildChain()
    })

    await POST(
      makeRequest({
        answers: [{ process_step_id: 'Fehlender Schritt', slot_key: 'open_item', answer: 'Ja' }],
      }),
      makeParams()
    )

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        interview_id: INTERVIEW_ID,
        workspace_id: WORKSPACE_ID,
        type: 'process_step',
      })
    )
  })

  it('OpenItem "Nein" does not insert knowledge_object', async () => {
    const insertSpy = vi.fn()

    let callCount = 0
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'interviews') {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: INTERVIEW_ID,
                workspace_id: WORKSPACE_ID,
                status: 'active',
                token_expires_at: new Date(Date.now() + 86400000).toISOString(),
              },
              error: null,
            }),
          }
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      if (table === 'knowledge_objects') {
        return { insert: insertSpy }
      }
      return buildChain()
    })

    await POST(
      makeRequest({
        answers: [{ process_step_id: 'Fehlender Schritt', slot_key: 'open_item', answer: 'Nein' }],
      }),
      makeParams()
    )

    expect(insertSpy).not.toHaveBeenCalled()
  })
})
