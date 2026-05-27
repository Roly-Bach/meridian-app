import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: mockFrom }),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn().mockReturnValue(vi.fn().mockReturnValue('mock-model')),
}))

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('./embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1024).fill(0)),
}))

import { enrichProcessSteps, applyGroundingGuard, createProcessStepsFromTracker } from './processEnrichment'
import { generateText } from 'ai'
import { generateEmbedding } from './embeddings'

// ─── applyGroundingGuard (pure function) ──────────────────────────────────────

describe('applyGroundingGuard', () => {
  it('returns null when evidence_quote is null', () => {
    expect(applyGroundingGuard({ value: 4, evidence_quote: null })).toBeNull()
  })

  it('returns null when evidence_quote is empty string', () => {
    expect(applyGroundingGuard({ value: 4, evidence_quote: '' })).toBeNull()
  })

  it('returns null when evidence_quote is whitespace only', () => {
    expect(applyGroundingGuard({ value: 4, evidence_quote: '   ' })).toBeNull()
  })

  it('returns value when evidence_quote is present', () => {
    expect(applyGroundingGuard({ value: 4, evidence_quote: 'jeden Montag' })).toBe(4)
  })

  it('returns false when value is false and evidence present', () => {
    expect(applyGroundingGuard({ value: false, evidence_quote: 'immer gleich' })).toBe(false)
  })

  it('returns 0 when value is 0 and evidence present', () => {
    expect(applyGroundingGuard({ value: 0, evidence_quote: 'keine Fehler' })).toBe(0)
  })

  it('returns null when attr is null/undefined', () => {
    expect(applyGroundingGuard(null as never)).toBeNull()
  })

  it('returns string[] when value is array and evidence present', () => {
    expect(applyGroundingGuard({ value: ['SAP', 'Excel'], evidence_quote: 'wir nutzen SAP und Excel' }))
      .toEqual(['SAP', 'Excel'])
  })
})

// ─── enrichProcessSteps ───────────────────────────────────────────────────────

const INTERVIEW_ID = 'iv-uuid-1'
const WORKSPACE_ID = 'ws-uuid-1'

const MOCK_KNOWLEDGE_OBJECTS = [
  {
    id: 'ko-1',
    content: { title: 'Rechnungen prüfen', description: 'Täglich eingehende Rechnungen prüfen', role: 'Buchhalter' },
    source_quote: 'Ich prüfe jeden Morgen die eingehenden Rechnungen in SAP',
  },
]

const MOCK_TURNS = [
  { turn_number: 1, user_input: 'Ich prüfe jeden Morgen die eingehenden Rechnungen in SAP. Das dauert etwa 30 Minuten.', agent_response: 'Wie oft machen Sie das?' },
]

const VALID_LLM_RESPONSE = [
  {
    knowledge_object_id: 'ko-1',
    title: 'Rechnungen prüfen',
    description: 'Täglich eingehende Rechnungen prüfen',
    role: 'Buchhalter',
    source_quote: 'Ich prüfe jeden Morgen die eingehenden Rechnungen in SAP',
    attributes: {
      frequency_per_month: { value: 22, evidence_quote: 'jeden Morgen' },
      duration_minutes: { value: 30, evidence_quote: 'dauert etwa 30 Minuten' },
      data_sources: { value: ['SAP'], evidence_quote: 'eingehenden Rechnungen in SAP' },
      rule_based: { value: null, evidence_quote: null },
      error_rate_percent: { value: null, evidence_quote: null },
      media_breaks: { value: null, evidence_quote: null },
    },
  },
]

// Creates a chainable Supabase mock that resolves to the given value
function makeChain(resolved: unknown) {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockResolvedValue(resolved)
  chain.single = vi.fn().mockResolvedValue(resolved)
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved)
  chain.delete = vi.fn().mockResolvedValue(resolved)
  chain.update = vi.fn().mockResolvedValue(resolved)
  // Make the chain itself thenable (awaitable)
  chain.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolved).then(onFulfilled)
  chain.catch = (onRejected: (e: unknown) => unknown) => Promise.resolve(resolved).catch(onRejected)
  chain.finally = (onFinally: () => void) => Promise.resolve(resolved).finally(onFinally)
  void self
  return chain
}

describe('enrichProcessSteps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReset()
  })

  it('returns early when process_steps already exist (idempotency)', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ count: 2, data: null, error: null }))

    await enrichProcessSteps({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })
    expect(generateText).not.toHaveBeenCalled()
  })

  it('returns early when no process_step knowledge objects exist', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: [], error: null }))

    await enrichProcessSteps({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })
    expect(generateText).not.toHaveBeenCalled()
  })

  it('logs error and returns when LLM throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: MOCK_KNOWLEDGE_OBJECTS, error: null }))
      .mockReturnValueOnce(makeChain({ data: MOCK_TURNS, error: null }))

    vi.mocked(generateText).mockRejectedValue(new Error('LLM timeout'))

    await enrichProcessSteps({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[processEnrichment] LLM enrichment failed:'),
      expect.anything()
    )
    errorSpy.mockRestore()
  })

  it('logs error when LLM returns non-array JSON', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: MOCK_KNOWLEDGE_OBJECTS, error: null }))
      .mockReturnValueOnce(makeChain({ data: MOCK_TURNS, error: null }))

    vi.mocked(generateText).mockResolvedValue({ text: '{"not": "an array"}' } as never)

    await enrichProcessSteps({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[processEnrichment] LLM enrichment failed:'),
      expect.anything()
    )
    errorSpy.mockRestore()
  })

  it('applies grounding guard — null evidence_quote → attribute not stored', async () => {
    const insertChain = makeChain({ error: null })

    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: MOCK_KNOWLEDGE_OBJECTS, error: null }))
      .mockReturnValueOnce(makeChain({ data: MOCK_TURNS, error: null }))
      .mockReturnValueOnce(insertChain)

    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify(VALID_LLM_RESPONSE),
    } as never)

    await enrichProcessSteps({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(insertChain.insert).toHaveBeenCalledOnce()
    const insertArg = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]

    // With evidence → stored
    expect(insertArg.frequency_per_month).toBe(22)
    expect(insertArg.duration_minutes).toBe(30)
    expect(insertArg.data_sources).toEqual(['SAP'])

    // Without evidence → null / defaults
    expect(insertArg.rule_based).toBe(false)
    expect(insertArg.error_rate_percent).toBeNull()
    expect(insertArg.media_breaks).toBe(0)
  })

  it('skips steps without title', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const llmResponse = [
      { ...VALID_LLM_RESPONSE[0], title: '' },
      { ...VALID_LLM_RESPONSE[0], title: 'Valid Step' },
    ]

    const insertChain = makeChain({ error: null })

    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: MOCK_KNOWLEDGE_OBJECTS, error: null }))
      .mockReturnValueOnce(makeChain({ data: MOCK_TURNS, error: null }))
      .mockReturnValueOnce(insertChain)

    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(llmResponse) } as never)

    await enrichProcessSteps({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(insertChain.insert).toHaveBeenCalledTimes(1)
    expect((insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0].title).toBe('Valid Step')
    errorSpy.mockRestore()
  })
})

// ─── createProcessStepsFromTracker ───────────────────────────────────────────

const MOCK_STEP_WALKTHROUGH = {
  title: 'Angebotserstellung',
  role: 'Account Manager',
  status: 'walkthrough' as const,
  slots: {
    frequency_per_month: { value: 50, quote: '50 passt ganz gut', confidence: 'confirmed' as const },
    duration_minutes: { value: 50, quote: 'so eine Stunde', confidence: 'estimate' as const },
    rule_based: { value: true, quote: 'feste Vorlage', confidence: 'confirmed' as const },
    data_sources: { value: ['Salesforce', 'Excel'], quote: 'Salesforce und Excel', confidence: 'confirmed' as const },
    error_rate_percent: null,
    media_breaks: null,
  },
  process_steps: [],
  friction_points: ['Templates müssen angepasst werden'],
  friction_tools: ['Salesforce'],
  pain_point_primary: 'Kein Zugriff auf Konditionen',
}

const MOCK_STEP_EXPLORING = {
  ...MOCK_STEP_WALKTHROUGH,
  title: 'Unbekannter Schritt',
  status: 'exploring' as const,
}

const MOCK_LLM_DESCRIPTION_RESPONSE = [
  {
    step_title: 'Angebotserstellung',
    description: 'Kundenanfragen per E-Mail oder Anruf entgegennehmen.',
    source_quote: 'Ich bekomme Anfragen per Mail',
    step_type: 'action',
    condition_text: null,
  },
]

describe('createProcessStepsFromTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReset()
  })

  it('returns early when process_steps already exist (idempotency)', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ count: 1, data: null, error: null }))

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(generateText).not.toHaveBeenCalled()
    expect(generateEmbedding).not.toHaveBeenCalled()
  })

  it('returns early when all steps have status exploring', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { step_tracker: [MOCK_STEP_EXPLORING] }, error: null }))

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(generateText).not.toHaveBeenCalled()
  })

  it('returns early when step_tracker is empty', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { step_tracker: [] }, error: null }))

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(generateText).not.toHaveBeenCalled()
  })

  it('inserts process_step with slot values from tracker (no LLM rounding)', async () => {
    const insertChain = makeChain({ error: null })

    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { step_tracker: [MOCK_STEP_WALKTHROUGH] }, error: null }))
      .mockReturnValueOnce(makeChain({ data: [{ turn_number: 1, user_input: 'Test', agent_response: 'Test' }], error: null }))
      .mockReturnValueOnce(insertChain)

    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(MOCK_LLM_DESCRIPTION_RESPONSE) } as never)

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(insertChain.insert).toHaveBeenCalledOnce()
    const arg = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]

    expect(arg.frequency_per_month).toBe(50)
    expect(arg.duration_minutes).toBe(50)
    expect(arg.rule_based).toBe(true)
    expect(arg.data_sources).toEqual(['Salesforce', 'Excel'])
    expect(arg.error_rate_percent).toBeNull()
    expect(arg.media_breaks).toBe(0)
    expect(arg.title).toBe('Angebotserstellung')
    expect(arg.role).toBe('Account Manager')
    expect(arg.description).toBe('Kundenanfragen per E-Mail oder Anruf entgegennehmen.')
    expect(arg.source_quote).toBe('Ich bekomme Anfragen per Mail')
  })

  it('fallback to null description when LLM throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const insertChain = makeChain({ error: null })

    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { step_tracker: [MOCK_STEP_WALKTHROUGH] }, error: null }))
      .mockReturnValueOnce(makeChain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)

    vi.mocked(generateText).mockRejectedValue(new Error('LLM timeout'))

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[createProcessStepsFromTracker] LLM call failed:'),
      expect.anything()
    )
    // Fallback: still inserts with null description but correct slot values
    expect(insertChain.insert).toHaveBeenCalledOnce()
    const arg = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.description).toBeNull()
    expect(arg.source_quote).toBeNull()
    expect(arg.frequency_per_month).toBe(50)

    errorSpy.mockRestore()
  })

  it('fallback when LLM returns non-array', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const insertChain = makeChain({ error: null })

    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { step_tracker: [MOCK_STEP_WALKTHROUGH] }, error: null }))
      .mockReturnValueOnce(makeChain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)

    vi.mocked(generateText).mockResolvedValue({ text: '{"not": "an array"}' } as never)

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(errorSpy).toHaveBeenCalled()
    expect(insertChain.insert).toHaveBeenCalledOnce()

    errorSpy.mockRestore()
  })

  it('strips markdown code fences from LLM response', async () => {
    const insertChain = makeChain({ error: null })

    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { step_tracker: [MOCK_STEP_WALKTHROUGH] }, error: null }))
      .mockReturnValueOnce(makeChain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)

    vi.mocked(generateText).mockResolvedValue({
      text: '```json\n' + JSON.stringify(MOCK_LLM_DESCRIPTION_RESPONSE) + '\n```',
    } as never)

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(insertChain.insert).toHaveBeenCalledOnce()
    const arg = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.description).toBe('Kundenanfragen per E-Mail oder Anruf entgegennehmen.')
  })

  it('filters out exploring steps, only inserts walkthrough/done steps', async () => {
    const insertChain = makeChain({ error: null })

    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({
        data: { step_tracker: [MOCK_STEP_WALKTHROUGH, MOCK_STEP_EXPLORING] },
        error: null,
      }))
      .mockReturnValueOnce(makeChain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)

    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(MOCK_LLM_DESCRIPTION_RESPONSE) } as never)

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    // Only the walkthrough step inserted, not the exploring one
    expect(insertChain.insert).toHaveBeenCalledTimes(1)
    expect((insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0].title).toBe('Angebotserstellung')
  })

  it('sets step_type=decision and condition_text when LLM returns decision', async () => {
    const insertChain = makeChain({ error: null })
    const decisionResponse = [
      {
        step_title: 'Angebotserstellung',
        description: 'Prüft Sonderkonditionen.',
        source_quote: 'wenn Sonderkunde',
        step_type: 'decision',
        condition_text: 'Wenn Stammkunde → Rabatt, sonst Standardpreis',
      },
    ]

    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { step_tracker: [MOCK_STEP_WALKTHROUGH] }, error: null }))
      .mockReturnValueOnce(makeChain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)

    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(decisionResponse) } as never)

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    const arg = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.step_type).toBe('decision')
    expect(arg.condition_text).toBe('Wenn Stammkunde → Rabatt, sonst Standardpreis')
  })
})
