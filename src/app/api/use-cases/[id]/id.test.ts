import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAdminFrom, WS_ID } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  WS_ID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
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

import { GET } from './route'

const UC_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const STEP_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

const SAMPLE_UC = {
  id: UC_ID,
  workspace_id: WS_ID,
  process_step_id: STEP_ID,
  cluster_id: null,
  type: 'automation',
  title: 'Test UC',
  reasoning: 'reason',
  priority: 'high',
  roi_eur_per_year: 10000,
  roi_breakdown: { freq: 20, duration: 60, hourly_rate: 45, reduction_rate: 0.85, participant_count: 1, total_eur: 10000 },
  llm_insights: null,
  score: 10000,
  quarter: 'Q1',
}

function makeRequest(id: string) {
  return new Request(`http://localhost/api/use-cases/${id}`)
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

describe('GET /api/use-cases/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as never)
    const res = await GET(makeRequest(UC_ID), makeParams(UC_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when use case not found', async () => {
    mockAdminFrom.mockReturnValue(makeUCFetch(null, { message: 'Not found' }))
    const res = await GET(makeRequest(UC_ID), makeParams(UC_ID))
    expect(res.status).toBe(404)
  })

  it('returns 404 when user not in any workspace that owns the UC', async () => {
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as never)
    // .in(['']) → no match → null
    mockAdminFrom.mockReturnValue(makeUCFetch(null, { message: 'Not found' }))

    const res = await GET(makeRequest(UC_ID), makeParams(UC_ID))
    expect(res.status).toBe(404)
  })

  it('returns 200 with use_case, process_step, interview for individual UC', async () => {
    const step = { title: 'Rechnungen prüfen', description: 'desc', source_quote: 'quote', frequency: 20, duration: 60, error_rate_percent: 5, rule_based: true, data_sources: [], interview_id: 'iv-1' }
    const iv = { employee_name: 'Max', employee_role: 'Buchhalter', created_at: '2026-01-01' }

    mockAdminFrom
      .mockReturnValueOnce(makeUCFetch(SAMPLE_UC))
      .mockReturnValueOnce(makeSimpleFetch(step))
      .mockReturnValueOnce(makeSimpleFetch(iv))

    const res = await GET(makeRequest(UC_ID), makeParams(UC_ID))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.use_case.id).toBe(UC_ID)
    expect(json.process_step.title).toBe('Rechnungen prüfen')
    expect(json.interview.employee_name).toBe('Max')
    expect(json.cluster).toBeNull()
  })

  it('returns cluster sub_use_cases for cluster UC', async () => {
    const clusterUC = {
      ...SAMPLE_UC,
      process_step_id: null,
      cluster_id: 'cluster-1',
      type: 'automation_at_scale',
      roi_breakdown: { freq: 15, duration: 45, hourly_rate: 45, reduction_rate: 0.85, participant_count: 2, total_eur: 8000 },
    }
    const clusterRow = {
      canonical_title: 'Rechnungsverarbeitung',
      canonical_description: 'Zwei Mitarbeiter verarbeiten Rechnungen.',
      participant_count: 2,
      participants: [
        { interview_id: 'iv-1', employee_name: 'Max', employee_role: 'Buchhalter', process_step_id: 'step-a' },
        { interview_id: 'iv-2', employee_name: 'Anna', employee_role: 'Assistenz', process_step_id: 'step-b' },
      ],
    }
    const makeSchrittDaten = (freq: number, duration: number, errorRate: number | null) => ({
      title: 'Step',
      reihenfolge: 1,
      abhaengigkeiten: null,
      status: 'done',
      potenzial: {
        frequency: { value: freq, quote: 'q', nicht_befund_typ: null },
        duration: { value: duration, quote: 'q', nicht_befund_typ: null },
        error_rate_percent: errorRate == null ? null : { value: errorRate, quote: 'q', nicht_befund_typ: null },
        media_breaks: null,
      },
      slots: {
        entscheidungslogik: null, tazite_cues: null, ausnahmen: null, inputs: null, outputs: null,
        hilfsmittel: null, reibungspunkte: null, ausloeser: null, aufgabentyp: null, risiko_schwere: null,
        standardisierungsgrad: null, informationsdichte: null,
      },
    })
    const stepA = { id: 'step-a', title: 'Step A', source_quote: 'q', schritt_daten: makeSchrittDaten(20, 60, 5) }
    const stepB = { id: 'step-b', title: 'Step B', source_quote: null, schritt_daten: makeSchrittDaten(10, 30, null) }

    mockAdminFrom
      .mockReturnValueOnce(makeUCFetch(clusterUC))
      .mockReturnValueOnce(makeSimpleFetch(clusterRow))
      .mockReturnValueOnce(makeSimpleFetch(stepA))
      .mockReturnValueOnce(makeSimpleFetch(stepB))

    const res = await GET(makeRequest(UC_ID), makeParams(UC_ID))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.process_step).toBeNull()
    expect(json.interview).toBeNull()
    expect(json.cluster.participant_count).toBe(2)
    expect(json.cluster.sub_use_cases).toHaveLength(2)
    expect(json.cluster.sub_use_cases[0].employee_name).toBe('Max')
    expect(json.cluster.sub_use_cases[0].roi_eur).toBeTypeOf('number')
  })
})
