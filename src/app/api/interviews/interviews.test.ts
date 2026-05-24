import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock is hoisted, so variables used in factories must be declared via vi.hoisted

const { mockGetUser, mockFrom, mockAdminFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockAdminFrom: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: mockAdminFrom }),
}))

import { GET, POST } from './route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws-111'
const authedUser = {
  id: 'user-abc',
  user_metadata: {},
}

function mockWorkspaceMembership() {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { workspace_id: WORKSPACE_ID }, error: null }),
  })
}

function makeRequest(body?: unknown) {
  return new Request('http://localhost/api/interviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── GET /api/interviews ──────────────────────────────────────────────────────

describe('GET /api/interviews', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('No session') })

    const res = await GET()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns interview list for authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null })
    mockWorkspaceMembership()

    const interviews = [{ id: '1', employee_name: 'Max', status: 'created' }]
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: interviews, error: null }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.interviews).toEqual(interviews)
  })
})

// ─── POST /api/interviews ─────────────────────────────────────────────────────

describe('POST /api/interviews', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('No session') })

    const res = await POST(makeRequest({ employee_name: 'Anna', department: 'HR' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing required fields', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null })

    const res = await POST(makeRequest({ employee_name: 'Anna' })) // missing department
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 400 for empty employee_name', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null })

    const res = await POST(makeRequest({ employee_name: '', department: 'HR' }))
    expect(res.status).toBe(400)
  })

  it('creates interview and returns 201 with access_token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null })
    mockWorkspaceMembership()

    const createdInterview = {
      id: 'iv-123',
      employee_name: 'Anna',
      department: 'HR',
      status: 'created',
      access_token: 'tok-abc',
    }

    mockAdminFrom
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createdInterview, error: null }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

    const res = await POST(makeRequest({ employee_name: 'Anna', employee_role: 'QA Ingenieurin', department: 'HR' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.interview.access_token).toBe('tok-abc')
  })
})
