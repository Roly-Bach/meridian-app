import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockInsert } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: mockInsert,
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

import { extractAndEmbed } from './extraction'
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

  it('inserts valid extractions with embeddings', async () => {
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

    expect(generateEmbedding).toHaveBeenCalledTimes(2)
    expect(mockInsert).toHaveBeenCalledTimes(2)

    const firstInsert = mockInsert.mock.calls[0][0]
    expect(firstInsert.type).toBe('process_step')
    expect(firstInsert.source_quote).toBe('Ich verarbeite täglich Rechnungen in SAP.')
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
    ).resolves.toBeUndefined()

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
      { type: 'role', content: { title: 'Buchhalter', responsibilities: 'Rechnungen' }, source_quote: 'Ich bin Buchhalter' },
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
    expect(mockInsert.mock.calls[0][0].type).toBe('role')
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
