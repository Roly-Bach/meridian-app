import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StepEntry } from '@/services/interviewSemantic'

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

vi.mock('@/services/embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}))

// PROJ-43: the route now applies SlotCard answers against interview_state.step_tracker
// via the shared TurnStore abstraction (same path production/eval use) instead of
// reading/writing process_steps directly — mock the TurnStore boundary rather than
// the raw supabase chain, and exercise the REAL applyClarificationSlotAnswers logic
// against a controllable in-memory tracker snapshot.
const { mockOpenTurn, mockStage, mockCommit } = vi.hoisted(() => ({
  mockOpenTurn: vi.fn(),
  mockStage: vi.fn().mockReturnValue({ status: 'accepted' }),
  mockCommit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/services/turnStore/supabaseTurnStore', () => ({
  createSupabaseTurnStore: () => ({ openTurn: mockOpenTurn }),
}))

// ─── Import after mocks ───────────────────────────────────────────────────────

import { POST } from './route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const INTERVIEW_ID = '11111111-2222-3333-4444-555555555555'
const WORKSPACE_ID = 'wwwwwwww-xxxx-yyyy-zzzz-aaaaaaaaaaaa'

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

const emptyPotenzial: StepEntry['potenzial'] = {
  frequency: null,
  duration: null,
  error_rate_percent: null,
  media_breaks: null,
}
const emptySlots: StepEntry['slots'] = {
  entscheidungslogik: null,
  tazite_cues: null,
  ausnahmen: null,
  inputs: null,
  outputs: null,
  hilfsmittel: null,
  reibungspunkte: null,
  ausloeser: null,
  aufgabentyp: null,
  risiko_schwere: null,
  standardisierungsgrad: null,
  informationsdichte: null,
}

function makeStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return {
    id: 'S001',
    title: 'Rechnungsprüfung',
    reihenfolge: 1,
    abhaengigkeiten: null,
    status: 'walkthrough',
    potenzial: emptyPotenzial,
    slots: emptySlots,
    ...overrides,
  }
}

/** Configures mockOpenTurn to hand out a session over the given tracker, capturing the staged intent. */
function stubSession(tracker: StepEntry[]) {
  mockOpenTurn.mockResolvedValue({
    snapshot: () => ({ stepTracker: tracker }),
    stage: mockStage,
    commit: mockCommit,
  })
}

function stagedTracker(): StepEntry[] {
  const call = mockStage.mock.calls.find((c) => c[0]?.kind === 'register_step')
  return call?.[0]?.tracker ?? []
}

describe('POST /api/interview/[token]/clarification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStage.mockReturnValue({ status: 'accepted' })
    mockCommit.mockResolvedValue(undefined)
    stubSession([]) // default: empty tracker, overridden per test as needed
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
      makeRequest({ answers: [{ process_step_id: 's1', slot_key: 'frequency', answer: 'Täglich' }] }),
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
      makeRequest({ answers: [{ process_step_id: 's1', slot_key: 'frequency', answer: 'Täglich' }] }),
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
      makeRequest({ answers: [{ process_step_id: 's1', slot_key: 'frequency', answer: 'Täglich' }] }),
      makeParams()
    )
    expect(res.status).toBe(409)
    const body = await res.json() as { success: boolean }
    expect(body.success).toBe(true)
  })

  it('processes SlotCard bucket-label answers and completes interview — happy path', async () => {
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
        return { update: updateSpy }
      }
      return buildChain()
    })

    stubSession([makeStep()])

    const res = await POST(
      makeRequest({
        answers: [
          { process_step_id: 'S001', slot_key: 'frequency', answer: 'Täglich' },
          { process_step_id: 'S001', slot_key: 'duration', answer: '5–15 Min' },
        ],
      }),
      makeParams()
    )

    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean }
    expect(body.success).toBe(true)

    expect(mockCommit).toHaveBeenCalled()
    const [updated] = stagedTracker()
    expect(updated.potenzial.frequency?.value).toBe(22)
    expect(updated.potenzial.duration?.value).toBe(10)
    expect(updated.status).toBe('walkthrough')
  })

  it('AC3(a): free numeric input is accepted equally to a bucket label', async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'interviews') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: INTERVIEW_ID, workspace_id: WORKSPACE_ID, status: 'active', token_expires_at: new Date(Date.now() + 86400000).toISOString() },
            error: null,
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      return buildChain()
    })

    stubSession([makeStep()])

    const res = await POST(
      makeRequest({ answers: [{ process_step_id: 'S001', slot_key: 'frequency', answer: '12' }] }),
      makeParams()
    )

    expect(res.status).toBe(200)
    const [updated] = stagedTracker()
    expect(updated.potenzial.frequency?.value).toBe(12)
  })

  it('AC2: bucket label resolves against the direction captured live (richtung=niedrig)', async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'interviews') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: INTERVIEW_ID, workspace_id: WORKSPACE_ID, status: 'active', token_expires_at: new Date(Date.now() + 86400000).toISOString() },
            error: null,
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      return buildChain()
    })

    const step = makeStep({
      potenzial: { ...emptyPotenzial, frequency: { value: null, quote: 'eher selten', nicht_befund_typ: null, richtung: 'niedrig' } },
    })
    stubSession([step])

    const res = await POST(
      makeRequest({ answers: [{ process_step_id: 'S001', slot_key: 'frequency', answer: 'Seltener' }] }),
      makeParams()
    )

    expect(res.status).toBe(200)
    const [updated] = stagedTracker()
    expect(updated.potenzial.frequency?.value).toBe(0.05)
  })

  it('AC4: "Weiß ich nicht" answer resolves the slot as nicht_befund_typ="unbekannt" (not a silent skip)', async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'interviews') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: INTERVIEW_ID, workspace_id: WORKSPACE_ID, status: 'active', token_expires_at: new Date(Date.now() + 86400000).toISOString() },
            error: null,
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      return buildChain()
    })

    stubSession([makeStep({ title: 'Step A' })])

    await POST(
      makeRequest({
        answers: [{ process_step_id: 'Step A', slot_key: 'frequency', answer: 'Weiß ich nicht' }],
      }),
      makeParams()
    )

    const [updated] = stagedTracker()
    expect(updated.potenzial.frequency?.value).toBeNull()
    expect(updated.potenzial.frequency?.nicht_befund_typ).toBe('unbekannt')
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

  it('OpenItem "Ja" inserts process_step with embedding for clustering', async () => {
    const processStepsInsertSpy = vi.fn().mockResolvedValue({ error: null })
    let callCount = 0

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'interviews') {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: INTERVIEW_ID, workspace_id: WORKSPACE_ID, status: 'active', token_expires_at: new Date(Date.now() + 86400000).toISOString() },
              error: null,
            }),
          }
        }
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
      }
      if (table === 'knowledge_objects') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      if (table === 'process_steps') {
        return {
          // First call: count check → returns 0 (not existing)
          select: vi.fn().mockReturnValue({
            count: 0,
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
          insert: processStepsInsertSpy,
        }
      }
      return buildChain()
    })

    await POST(
      makeRequest({ answers: [{ process_step_id: 'Mahnwesen', slot_key: 'open_item', answer: 'Ja' }] }),
      makeParams()
    )

    expect(processStepsInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        interview_id: INTERVIEW_ID,
        workspace_id: WORKSPACE_ID,
        title: 'Mahnwesen',
        schritt_daten: null,
        step_type: 'action',
      })
    )
  })

  it('OpenItem "Ja" skips process_step insert if title already exists', async () => {
    const processStepsInsertSpy = vi.fn()
    let callCount = 0

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'interviews') {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: INTERVIEW_ID, workspace_id: WORKSPACE_ID, status: 'active', token_expires_at: new Date(Date.now() + 86400000).toISOString() },
              error: null,
            }),
          }
        }
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
      }
      if (table === 'knowledge_objects') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      if (table === 'process_steps') {
        return {
          // Count check → returns 1 (already exists)
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
            }),
          }),
          insert: processStepsInsertSpy,
        }
      }
      return buildChain()
    })

    await POST(
      makeRequest({ answers: [{ process_step_id: 'Mahnwesen', slot_key: 'open_item', answer: 'Ja' }] }),
      makeParams()
    )

    expect(processStepsInsertSpy).not.toHaveBeenCalled()
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
