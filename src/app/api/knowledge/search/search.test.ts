import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/services/embeddings', () => ({
  generateEmbedding: vi.fn(),
}))

vi.mock('@/lib/ratelimit', () => ({
  checkUserLimitProcessSteps: vi.fn(),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase-server'
import { generateEmbedding } from '@/services/embeddings'
import { checkUserLimitProcessSteps } from '@/lib/ratelimit'
import { NextResponse } from 'next/server'

const WORKSPACE_ID = '123e4567-e89b-42d3-a456-426614174000'
const USER_ID = 'user-1'

// Builds a mocked supabase server client.
// opts.user           -> the user returned by auth.getUser
// opts.membership      -> row returned by the workspace_members lookup (null = non-member)
// opts.rpcResult       -> { data, error } returned by supabase.rpc
function makeSupabase(opts: {
  user?: { id: string } | null
  membership?: unknown
  rpcResult?: { data: unknown; error: unknown }
} = {}) {
  const { user = { id: USER_ID }, membership = { workspace_id: WORKSPACE_ID }, rpcResult = { data: [], error: null } } = opts
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: membership, error: membership ? null : new Error('not found') }),
    }),
    rpc: vi.fn().mockResolvedValue(rpcResult),
  }
}

function makeRequest(params: Record<string, string | undefined> = {}) {
  const url = new URL('http://localhost/api/knowledge/search')
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v)
  }
  return new Request(url.toString())
}

describe('GET /api/knowledge/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(makeSupabase() as never)
    vi.mocked(generateEmbedding).mockResolvedValue([0.1, 0.2, 0.3] as never)
    vi.mocked(checkUserLimitProcessSteps).mockResolvedValue(null)
  })

  it('returns 401 when no auth session', async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ user: null }) as never)
    const res = await GET(makeRequest({ workspace_id: WORKSPACE_ID, q: 'rechnung' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when workspace_id is missing', async () => {
    const res = await GET(makeRequest({ q: 'rechnung' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when q is missing', async () => {
    const res = await GET(makeRequest({ workspace_id: WORKSPACE_ID }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when q exceeds 500 chars', async () => {
    const res = await GET(makeRequest({ workspace_id: WORKSPACE_ID, q: 'x'.repeat(501) }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid workspace_id UUID', async () => {
    const res = await GET(makeRequest({ workspace_id: 'not-a-uuid', q: 'rechnung' }))
    expect(res.status).toBe(400)
  })

  it('returns 403 when user is not a member of the workspace', async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ membership: null }) as never)
    const res = await GET(makeRequest({ workspace_id: WORKSPACE_ID, q: 'rechnung' }))
    expect(res.status).toBe(403)
  })

  it('returns 503 when embedding generation fails', async () => {
    vi.mocked(generateEmbedding).mockResolvedValue(null as never)
    const res = await GET(makeRequest({ workspace_id: WORKSPACE_ID, q: 'rechnung' }))
    expect(res.status).toBe(503)
  })

  it('returns the rate-limit response when the limit is triggered', async () => {
    const limited = NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    vi.mocked(checkUserLimitProcessSteps).mockResolvedValue(limited)
    const res = await GET(makeRequest({ workspace_id: WORKSPACE_ID, q: 'rechnung' }))
    expect(res.status).toBe(429)
    // embedding must not be generated once rate limited
    expect(generateEmbedding).not.toHaveBeenCalled()
  })

  it('returns { results: [], count: 0 } for a valid request with no matches', async () => {
    const res = await GET(makeRequest({ workspace_id: WORKSPACE_ID, q: 'rechnung' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ results: [], count: 0 })
  })

  it('returns matches with correct count for a valid request', async () => {
    const rows = [
      { id: 'ko-1', type: 'process_step', content: { title: 'Rechnung prüfen' }, similarity: 0.91 },
    ]
    vi.mocked(createClient).mockResolvedValue(
      makeSupabase({ rpcResult: { data: rows, error: null } }) as never
    )
    const res = await GET(makeRequest({ workspace_id: WORKSPACE_ID, q: 'rechnung' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.count).toBe(1)
    expect(json.results).toHaveLength(1)
  })

  it('returns 500 when the rpc call errors', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabase({ rpcResult: { data: null, error: new Error('rpc boom') } }) as never
    )
    const res = await GET(makeRequest({ workspace_id: WORKSPACE_ID, q: 'rechnung' }))
    expect(res.status).toBe(500)
  })
})
