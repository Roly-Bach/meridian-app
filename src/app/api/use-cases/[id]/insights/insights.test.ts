import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAdminFrom, mockCheckUserLimitInsights, MOCK_INSIGHTS, WS_ID } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  mockCheckUserLimitInsights: vi.fn().mockResolvedValue(null),
  WS_ID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  MOCK_INSIGHTS: {
    business_case: 'Guter Business Case.',
    implementation_approach: 'RPA mit UiPath.',
    next_steps: ['Schritt 1', 'Schritt 2', 'Schritt 3'],
    risk_notes: 'Abhängig von SAP-Version.',
    complexity: 'mittel' as const,
  },
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: mockAdminFrom }),
}))

// Default: authenticated user with membership in WS_ID
vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [{ workspace_id: WS_ID }], error: null }),
    }),
  }),
}))

vi.mock('@/lib/ratelimit', () => ({
  checkUserLimitInsights: mockCheckUserLimitInsights,
}))

vi.mock('@/services/useCaseInsights', () => ({
  generateUseCaseInsights: vi.fn().mockResolvedValue(MOCK_INSIGHTS),
}))

import { POST } from './route'

const UC_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const BASE_UC = {
  id: UC_ID,
  workspace_id: WS_ID,
  type: 'automation',
  title: 'Test UC',
  reasoning: 'reason',
  priority: 'high',
  roi_eur_per_year: 10000,
  roi_breakdown: null,
  cluster_id: null,
  process_step_id: 'step-1',
  llm_insights: null,
}

function makeRequest(id: string) {
  return new Request(`http://localhost/api/use-cases/${id}/insights`, { method: 'POST' })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// Helper: admin mock chain for UC fetch (includes .in() for workspace filter)
function makeUCFetch(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
}

// Helper: admin mock chain for simple fetch (no .in())
function makeSimpleFetch(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
}

describe('POST /api/use-cases/[id]/insights', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as never)
    const res = await POST(makeRequest(UC_ID), makeParams(UC_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when use case not found', async () => {
    mockAdminFrom.mockReturnValue(makeUCFetch(null, { message: 'Not found' }))
    const res = await POST(makeRequest(UC_ID), makeParams(UC_ID))
    expect(res.status).toBe(404)
  })

  it('returns cached insights without LLM call when llm_insights already set', async () => {
    const cachedInsights = { ...MOCK_INSIGHTS }
    mockAdminFrom.mockReturnValueOnce(makeUCFetch({ ...BASE_UC, llm_insights: cachedInsights }))

    const res = await POST(makeRequest(UC_ID), makeParams(UC_ID))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.cached).toBe(true)
    expect(json.insights).toEqual(cachedInsights)
  })

  it('generates insights, persists to DB, and returns result', async () => {
    const updateMock = vi.fn().mockReturnThis()
    const updateEqMock = vi.fn().mockResolvedValue({ error: null })

    mockAdminFrom
      .mockReturnValueOnce(makeUCFetch(BASE_UC))
      .mockReturnValueOnce(makeSimpleFetch({
        title: 'Step',
        description: null,
        source_quote: null,
        frequency: 20,
        duration: 60,
        error_rate_percent: 5,
        rule_based: true,
        interview_id: 'iv-1',
      }))
      .mockReturnValueOnce(makeSimpleFetch({ employee_name: 'Max', employee_role: 'Buchhalter' }))
      .mockReturnValueOnce({ update: updateMock, eq: updateEqMock })

    const res = await POST(makeRequest(UC_ID), makeParams(UC_ID))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.cached).toBe(false)
    expect(json.insights.business_case).toBe('Guter Business Case.')
    expect(json.insights.complexity).toBe('mittel')
  })

  it('returns 429 when rate limit exceeded', async () => {
    const rateLimitResponse = new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { 'Retry-After': '60' } }
    )
    mockAdminFrom.mockReturnValueOnce(makeUCFetch(BASE_UC))
    mockCheckUserLimitInsights.mockResolvedValueOnce(rateLimitResponse)

    const res = await POST(makeRequest(UC_ID), makeParams(UC_ID))
    expect(res.status).toBe(429)
  })
})
