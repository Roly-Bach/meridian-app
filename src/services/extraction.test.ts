import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockInsert, mockUpdatePayload, mockUpdateEq, mockDelete, dedupSelectResultsByType } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdatePayload: vi.fn(),
  mockUpdateEq: vi.fn().mockResolvedValue({ error: null }),
  mockDelete: vi.fn().mockResolvedValue({ error: null }),
  dedupSelectResultsByType: {} as Record<string, { data: unknown[] | null; error: { message: string } | null }>,
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: mockInsert,
      // Dedup select chain: .select().eq('workspace_id', ..).eq('type', type).not().order()
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((_col: string, type: string) => ({
            not: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue(
                dedupSelectResultsByType[type] ?? { data: [], error: null },
              ),
            }),
          })),
        }),
      }),
      // Dedup update/delete chains
      update: vi.fn().mockImplementation((payload: unknown) => {
        mockUpdatePayload(payload)
        return { eq: mockUpdateEq }
      }),
      delete: vi.fn().mockReturnValue({ in: mockDelete }),
    }),
  }),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn().mockReturnValue(vi.fn().mockReturnValue('mock-model')),
}))

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('./embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}))

import { extractAndEmbed, levenshtein, deduplicateKnowledgeObjects } from './extraction'
import { generateText } from 'ai'
import { generateEmbedding } from './embeddings'

const MOCK_TRANSCRIPT = [
  { user_input: 'Ich verarbeite täglich Rechnungen in SAP.', agent_response: 'Wie lange dauert das?' },
]

// ─── extractAndEmbed ──────────────────────────────────────────────────────────

describe('extractAndEmbed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
  })

  it('returns early for empty transcript', async () => {
    await extractAndEmbed({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      turnId: 'turn-1',
      transcript: [],
    })
    expect(generateText).not.toHaveBeenCalled()
  })

  it('calls LLM with system prompt and transcript', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: '[]' } as never)

    await extractAndEmbed({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      turnId: 'turn-1',
      transcript: MOCK_TRANSCRIPT,
    })

    expect(generateText).toHaveBeenCalledOnce()
    const call = vi.mocked(generateText).mock.calls[0][0]
    expect(call.system).toContain('Extraktions-Agent')
    expect(call.prompt).toContain('Rechnungen in SAP')
  })

  it('inserts valid extractions with embeddings — process_step filtered (K2)', async () => {
    const mockObjects = [
      {
        type: 'process_step',
        content: { title: 'Rechnungen prüfen', description: 'Täglich in SAP', role: 'Buchhalter' },
        source_quote: 'Ich verarbeite täglich Rechnungen in SAP.',
      },
      {
        type: 'tool',
        content: { name: 'SAP', purpose: 'Rechnungsverarbeitung' },
        source_quote: 'Rechnungen in SAP',
      },
    ]

    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(mockObjects) } as never)

    await extractAndEmbed({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      turnId: 'turn-1',
      transcript: MOCK_TRANSCRIPT,
    })

    // process_step is no longer in ALLOWED_TYPES — only tool inserted
    expect(generateEmbedding).toHaveBeenCalledTimes(1)
    expect(mockInsert).toHaveBeenCalledTimes(1)

    const firstInsert = mockInsert.mock.calls[0][0]
    expect(firstInsert.type).toBe('tool')
    expect(firstInsert.source_quote).toBe('Rechnungen in SAP')
    expect(firstInsert.interview_id).toBe('iv-1')
    expect(firstInsert.workspace_id).toBe('ws-1')
    expect(firstInsert.turn_id).toBe('turn-1')
  })

  it('handles LLM returning empty array — no DB inserts', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: '[]' } as never)

    await extractAndEmbed({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      turnId: 'turn-1',
      transcript: MOCK_TRANSCRIPT,
    })

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('logs error and returns when LLM returns invalid JSON', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(generateText).mockResolvedValue({ text: 'not-valid-json' } as never)

    await expect(
      extractAndEmbed({
        interviewId: 'iv-1',
        workspaceId: 'ws-1',
        turnId: 'turn-1',
        transcript: MOCK_TRANSCRIPT,
      })
    ).resolves.toEqual([])

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[extraction]'),
      expect.anything()
    )
    expect(mockInsert).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('logs error and returns when LLM returns non-array JSON', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(generateText).mockResolvedValue({ text: '{"type": "process_step"}' } as never)

    await extractAndEmbed({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      turnId: 'turn-1',
      transcript: MOCK_TRANSCRIPT,
    })

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[extraction]'),
      expect.anything()
    )
    expect(mockInsert).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('skips objects with invalid type not in allowlist', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const objects = [
      { type: 'unknown_type', content: { foo: 'bar' }, source_quote: 'some quote' },
      { type: 'tool', content: { name: 'SAP', purpose: 'ERP' }, source_quote: 'wir nutzen SAP' },
    ]
    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(objects) } as never)

    await extractAndEmbed({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      turnId: 'turn-1',
      transcript: MOCK_TRANSCRIPT,
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith('[extraction] Invalid type, skipping:', 'unknown_type')
    errorSpy.mockRestore()
  })

  it('skips malformed objects missing required fields', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const partialObjects = [
      { type: 'tool', content: { name: 'SAP' } },
      { type: 'tool', content: { name: 'Excel', purpose: 'Tabellen' }, source_quote: 'wir nutzen Excel' },
    ]
    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(partialObjects) } as never)

    await extractAndEmbed({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      turnId: 'turn-1',
      transcript: MOCK_TRANSCRIPT,
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[extraction] Skipping malformed object'),
      expect.anything()
    )
    errorSpy.mockRestore()
  })

  it('continues inserting remaining objects when one DB insert fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const objects = [
      { type: 'tool', content: { name: 'SAP', purpose: 'ERP' }, source_quote: 'SAP nutzen wir' },
      { type: 'tool', content: { name: 'Excel', purpose: 'Tabellen' }, source_quote: 'Excel nutzen wir' },
    ]
    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(objects) } as never)
    mockInsert
      .mockResolvedValueOnce({ error: new Error('DB error') })
      .mockResolvedValueOnce({ error: null })

    await extractAndEmbed({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      turnId: 'turn-1',
      transcript: MOCK_TRANSCRIPT,
    })

    expect(mockInsert).toHaveBeenCalledTimes(2)
    expect(errorSpy).toHaveBeenCalledWith('[extraction] DB insert failed:', 'DB error')
    errorSpy.mockRestore()
  })

  it('strips ```json markdown wrapper from LLM response', async () => {
    const objects = [
      { type: 'tool', content: { name: 'SAP FI', purpose: 'Buchungen' }, source_quote: 'Ich nutze SAP FI' },
    ]
    vi.mocked(generateText).mockResolvedValue({
      text: '```json\n' + JSON.stringify(objects) + '\n```',
    } as never)

    await extractAndEmbed({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      turnId: 'turn-1',
      transcript: MOCK_TRANSCRIPT,
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockInsert.mock.calls[0][0].type).toBe('tool')
  })

  it('rejects `role` type — removed from allowlist in Bug-3 fix', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const objects = [
      { type: 'role', content: { title: 'Buchhalter', responsibilities: 'Rechnungen prüfen' }, source_quote: 'ich bin Buchhalter' },
    ]
    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(objects) } as never)

    await extractAndEmbed({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      turnId: 'turn-1',
      transcript: MOCK_TRANSCRIPT,
    })

    expect(mockInsert).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith('[extraction] Invalid type, skipping:', 'role')
    errorSpy.mockRestore()
  })

  it('rejects `process_step` type — removed from allowlist in K2 (ADR-013)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const objects = [
      { type: 'process_step', content: { title: 'Rechnung prüfen' }, source_quote: 'täglich prüfe ich' },
    ]
    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(objects) } as never)

    await extractAndEmbed({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      turnId: 'turn-1',
      transcript: MOCK_TRANSCRIPT,
    })

    expect(mockInsert).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith('[extraction] Invalid type, skipping:', 'process_step')
    errorSpy.mockRestore()
  })

  it('calls generateEmbedding even when Jina returns null — still inserts object', async () => {
    vi.mocked(generateEmbedding).mockResolvedValue(null)
    const objects = [
      { type: 'pain_point', content: { description: 'Viel Handarbeit' }, source_quote: 'alles von Hand' },
    ]
    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(objects) } as never)

    await extractAndEmbed({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      turnId: 'turn-1',
      transcript: MOCK_TRANSCRIPT,
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertCall = mockInsert.mock.calls[0][0]
    expect(insertCall.embedding).toBeNull()
  })
})

// ─── levenshtein (dedup title-distance gate) ──────────────────────────────────

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('rechnung prüfen', 'rechnung prüfen')).toBe(0)
  })

  it('returns 0 for two empty strings', () => {
    expect(levenshtein('', '')).toBe(0)
  })

  it('equals length of the other string when one side is empty (fallback case)', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
  })

  it('returns 1 for a single-character substitution', () => {
    expect(levenshtein('cat', 'bat')).toBe(1)
  })

  it('returns 1 for a single-character insertion', () => {
    expect(levenshtein('cat', 'cats')).toBe(1)
  })

  it('returns 1 for a single-character deletion', () => {
    expect(levenshtein('cats', 'cat')).toBe(1)
  })

  it('is symmetric', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(levenshtein('sitting', 'kitten'))
  })

  it('matches the classic kitten/sitting distance of 3', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
  })

  // Dedup gate: distance <= 8 -> merge ALLOWED
  it('near-duplicate process step titles have distance <= 8 (merge allowed)', () => {
    expect(levenshtein('rechnung prüfen', 'rechnungen prüfen')).toBeLessThanOrEqual(8)
    expect(levenshtein('bestellung erfassen', 'bestellung erfasst')).toBeLessThanOrEqual(8)
  })

  // Dedup gate: distance > 8 -> merge BLOCKED
  it('semantically different titles have distance > 8 (merge blocked)', () => {
    expect(levenshtein('rechnung prüfen', 'urlaubsantrag genehmigen')).toBeGreaterThan(8)
  })

  it('honours the > 8 boundary exactly used by the dedup gate', () => {
    // exactly 8 substitutions -> NOT > 8 -> allowed
    expect(levenshtein('aaaaaaaa', 'bbbbbbbb')).toBe(8)
    // 9 substitutions -> > 8 -> blocked
    expect(levenshtein('aaaaaaaaa', 'bbbbbbbbb')).toBe(9)
  })
})

// ─── deduplicateKnowledgeObjects (KI-2: tool-type dedup) ───────────────────────

describe('deduplicateKnowledgeObjects', () => {
  beforeEach(() => {
    for (const key of Object.keys(dedupSelectResultsByType)) delete dedupSelectResultsByType[key]
    mockUpdatePayload.mockClear()
    mockUpdateEq.mockClear().mockResolvedValue({ error: null })
    mockDelete.mockClear().mockResolvedValue({ error: null })
  })

  it('merges near-duplicate tool-type knowledge objects (KI-2 regression)', async () => {
    dedupSelectResultsByType['tool'] = {
      data: [
        { id: 'tool-a', content: { name: 'E-Mail', purpose: 'Empfang von Rechnungen' }, embedding: [1, 0, 0], existing_count: 1 },
        { id: 'tool-b', content: { name: 'Email', purpose: 'Empfang neuer Rechnungen' }, embedding: [1, 0, 0], existing_count: 1 },
      ],
      error: null,
    }
    dedupSelectResultsByType['pain_point'] = { data: [], error: null }

    await deduplicateKnowledgeObjects('ws-1')

    expect(mockUpdatePayload).toHaveBeenCalledWith(
      expect.objectContaining({ existing_count: 2 }),
    )
    expect(mockDelete).toHaveBeenCalledWith('id', ['tool-b'])
  })

  it('does not merge tool-type objects with different names even at high cosine similarity', async () => {
    dedupSelectResultsByType['tool'] = {
      data: [
        { id: 'tool-a', content: { name: 'Buchhaltungssoftware DATEV', purpose: 'Buchung' }, embedding: [1, 0, 0], existing_count: 1 },
        { id: 'tool-b', content: { name: 'E-Mail-Postfach Outlook', purpose: 'Empfang' }, embedding: [1, 0, 0], existing_count: 1 },
      ],
      error: null,
    }
    dedupSelectResultsByType['pain_point'] = { data: [], error: null }

    await deduplicateKnowledgeObjects('ws-1')

    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('still dedupes pain_point objects via content.description (pre-existing behaviour preserved)', async () => {
    dedupSelectResultsByType['pain_point'] = {
      data: [
        { id: 'pp-a', content: { description: 'Rechnungen kommen verspätet an' }, embedding: [1, 0, 0], existing_count: 1 },
        { id: 'pp-b', content: { description: 'Rechnungen kommen verspätet an.' }, embedding: [1, 0, 0], existing_count: 1 },
      ],
      error: null,
    }
    dedupSelectResultsByType['tool'] = { data: [], error: null }

    await deduplicateKnowledgeObjects('ws-1')

    expect(mockDelete).toHaveBeenCalledWith('id', ['pp-b'])
  })
})
