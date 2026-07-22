import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseUser, mockAdminFrom } = vi.hoisted(() => ({
  mockSupabaseUser: vi.fn(),
  mockAdminFrom: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockSupabaseUser },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'member-1' }, error: null }),
    }),
  }),
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: mockAdminFrom }),
}))

vi.mock('@/services/reportGenerator', () => ({
  generateReportData: vi.fn(),
}))

vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-mock')),
  DocumentProps: {},
}))

// Must mock InterviewReport before importing route
vi.mock('@/components/pdf/InterviewReport', () => ({
  InterviewReport: vi.fn(() => null),
}))

import { GET } from './route'
import { generateReportData } from '@/services/reportGenerator'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INTERVIEW_ID = 'iv-abc-123'
const WORKSPACE_ID = 'ws-abc-123'
const USER_ID = 'user-abc-123'

function makeGETRequest(id: string) {
  return new Request(`http://localhost/api/interviews/${id}/pdf`)
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function mockCompletedInterview() {
  mockAdminFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: INTERVIEW_ID,
        workspace_id: WORKSPACE_ID,
        status: 'completed',
        employee_name: 'Anna Schmidt',
      },
      error: null,
    }),
  })
}

function mockFullReportData() {
  vi.mocked(generateReportData).mockResolvedValue({
    interview: {
      employee_name: 'Anna Schmidt',
      employee_role: 'Teamleiterin',
      department: 'Qualität',
      created_at: new Date().toISOString(),
    },
    executiveSummary: 'Test summary.',
    processSteps: [{ id: 'ps-1', title: 'Angebot prüfen', description: null, frequency: 10, duration: 30, data_sources: [], rule_based: false }],
    painPoints: [],
    tools: [],
    useCases: [],
    generatedAt: new Date().toISOString(),
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/interviews/[id]/pdf', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockSupabaseUser.mockResolvedValue({ data: { user: null }, error: new Error('no session') })

    const res = await GET(makeGETRequest(INTERVIEW_ID), makeParams(INTERVIEW_ID))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 404 when interview not found', async () => {
    mockSupabaseUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockAdminFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error('not found') }),
    })

    const res = await GET(makeGETRequest(INTERVIEW_ID), makeParams(INTERVIEW_ID))
    expect(res.status).toBe(404)
  })

  it('returns 404 when interview is not completed', async () => {
    mockSupabaseUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockAdminFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: INTERVIEW_ID, workspace_id: WORKSPACE_ID, status: 'active', employee_name: 'Anna' },
        error: null,
      }),
    })

    const res = await GET(makeGETRequest(INTERVIEW_ID), makeParams(INTERVIEW_ID))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toContain('abgeschlossen')
  })

  it('returns 403 when not a workspace member', async () => {
    mockSupabaseUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockCompletedInterview()

    // Override the createClient mock to return no membership
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as never)

    const res = await GET(makeGETRequest(INTERVIEW_ID), makeParams(INTERVIEW_ID))
    expect(res.status).toBe(403)
  })

  it('returns 422 when no extractable data exists', async () => {
    mockSupabaseUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockCompletedInterview()
    vi.mocked(generateReportData).mockResolvedValue({
      interview: { employee_name: 'Anna', employee_role: null, department: 'IT', created_at: new Date().toISOString() },
      executiveSummary: 'Kein Inhalt.',
      processSteps: [],
      painPoints: [],
      tools: [],
      useCases: [],
      generatedAt: new Date().toISOString(),
    })

    const res = await GET(makeGETRequest(INTERVIEW_ID), makeParams(INTERVIEW_ID))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error).toContain('Keine Daten')
  })

  it('returns PDF binary for valid completed interview', async () => {
    mockSupabaseUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockCompletedInterview()
    mockFullReportData()

    const res = await GET(makeGETRequest(INTERVIEW_ID), makeParams(INTERVIEW_ID))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('anna-schmidt')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
  })
})
