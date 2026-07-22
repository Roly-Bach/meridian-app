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
  generateObject: vi.fn(),
}))

vi.mock('./embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1024).fill(0)),
}))

import { applyGroundingGuard, createProcessStepsFromTracker } from './processEnrichment'
import { generateObject } from 'ai'
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

// Creates a chainable Supabase mock that resolves to the given value
function makeChain(resolved: unknown) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockResolvedValue(resolved)
  chain.single = vi.fn().mockResolvedValue(resolved)
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved)
  chain.delete = vi.fn().mockResolvedValue(resolved)
  chain.update = vi.fn().mockResolvedValue(resolved)
  chain.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolved).then(onFulfilled)
  chain.catch = (onRejected: (e: unknown) => unknown) => Promise.resolve(resolved).catch(onRejected)
  chain.finally = (onFinally: () => void) => Promise.resolve(resolved).finally(onFinally)
  return chain
}

const INTERVIEW_ID = 'iv-uuid-1'
const WORKSPACE_ID = 'ws-uuid-1'

// ─── createProcessStepsFromTracker ───────────────────────────────────────────

const MOCK_STEP_WALKTHROUGH = {
  title: 'Angebotserstellung',
  reihenfolge: 1,
  abhaengigkeiten: null,
  status: 'walkthrough' as const,
  potenzial: {
    frequency: { value: 50, quote: '50 passt ganz gut', confidence: 'confirmed' as const, nicht_befund_typ: null },
    duration: { value: 50, quote: 'so eine Stunde', confidence: 'estimate' as const, nicht_befund_typ: null },
    error_rate_percent: null,
    media_breaks: null,
  },
  slots: {
    entscheidungslogik: { value: 'feste Vorlage', quote: 'feste Vorlage', nicht_befund_typ: null },
    tazite_cues: null,
    ausnahmen: null,
    inputs: null,
    outputs: null,
    hilfsmittel: { value: ['Salesforce', 'Excel'], quote: 'Salesforce und Excel', nicht_befund_typ: null },
    reibungspunkte: { value: ['Templates müssen angepasst werden'], quote: 'Templates müssen angepasst werden', nicht_befund_typ: null },
    ausloeser: null,
    aufgabentyp: null,
    risiko_schwere: null,
    standardisierungsgrad: null,
    informationsdichte: null,
  },
  teilschritte: [],
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

    expect(generateObject).not.toHaveBeenCalled()
    expect(generateEmbedding).not.toHaveBeenCalled()
  })

  it('returns early when all steps have status exploring', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { step_tracker: [MOCK_STEP_EXPLORING] }, error: null }))

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(generateObject).not.toHaveBeenCalled()
  })

  it('returns early when step_tracker is empty', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { step_tracker: [] }, error: null }))

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(generateObject).not.toHaveBeenCalled()
  })

  it('inserts process_step with slot values from tracker (no LLM rounding)', async () => {
    const insertChain = makeChain({ error: null })

    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { step_tracker: [MOCK_STEP_WALKTHROUGH] }, error: null }))
      .mockReturnValueOnce(makeChain({ data: [{ turn_number: 1, user_input: 'Test', agent_response: 'Test' }], error: null }))
      .mockReturnValueOnce(insertChain)

    vi.mocked(generateObject).mockResolvedValue({ object: { steps: MOCK_LLM_DESCRIPTION_RESPONSE } } as never)

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(insertChain.insert).toHaveBeenCalledOnce()
    const arg = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]

    // PROJ-45 (ADR-025 D1): schritt_daten carries the tracker entry verbatim — no
    // flat frequency/duration/rule_based/data_sources columns anymore.
    expect(arg.schritt_daten.potenzial.frequency.value).toBe(50)
    expect(arg.schritt_daten.potenzial.duration.value).toBe(50)
    expect(arg.schritt_daten.slots.entscheidungslogik.value).toBe('feste Vorlage')
    expect(arg.schritt_daten.slots.hilfsmittel.value).toEqual(['Salesforce', 'Excel'])
    expect(arg.schritt_daten.potenzial.error_rate_percent).toBeNull()
    expect(arg.schritt_daten.potenzial.media_breaks).toBeNull()
    expect(arg.title).toBe('Angebotserstellung')
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

    vi.mocked(generateObject).mockRejectedValue(new Error('LLM timeout'))

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
    expect(arg.schritt_daten.potenzial.frequency.value).toBe(50)

    errorSpy.mockRestore()
  })

  it('fallback to null description when generateObject throws (schema/network error)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const insertChain = makeChain({ error: null })

    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { step_tracker: [MOCK_STEP_WALKTHROUGH] }, error: null }))
      .mockReturnValueOnce(makeChain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)

    vi.mocked(generateObject).mockRejectedValue(new Error('schema validation failed'))

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[createProcessStepsFromTracker] LLM call failed:'),
      expect.anything()
    )
    expect(insertChain.insert).toHaveBeenCalledOnce()
    const arg = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.description).toBeNull()

    errorSpy.mockRestore()
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

    vi.mocked(generateObject).mockResolvedValue({ object: { steps: MOCK_LLM_DESCRIPTION_RESPONSE } } as never)

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    // Only the walkthrough step inserted, not the exploring one
    expect(insertChain.insert).toHaveBeenCalledTimes(1)
    expect((insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0].title).toBe('Angebotserstellung')
  })

  it('matches by index even when LLM returns different step_title (paraphrase)', async () => {
    const insertChain = makeChain({ error: null })
    const paraphrasedResponse = [
      {
        step_title: 'Angebotserstellung (paraphrasiert vom LLM)',
        description: 'Beschreibung trotzdem korrekt.',
        source_quote: 'Ich bekomme Anfragen per Mail',
        step_type: 'action',
        condition_text: null,
      },
    ]

    mockFrom
      .mockReturnValueOnce(makeChain({ count: 0, data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { step_tracker: [MOCK_STEP_WALKTHROUGH] }, error: null }))
      .mockReturnValueOnce(makeChain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)

    vi.mocked(generateObject).mockResolvedValue({ object: { steps: paraphrasedResponse } } as never)

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    const arg = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.title).toBe('Angebotserstellung')
    expect(arg.description).toBe('Beschreibung trotzdem korrekt.')
    expect(arg.source_quote).toBe('Ich bekomme Anfragen per Mail')
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

    vi.mocked(generateObject).mockResolvedValue({ object: { steps: decisionResponse } } as never)

    await createProcessStepsFromTracker({ interviewId: INTERVIEW_ID, workspaceId: WORKSPACE_ID })

    const arg = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.step_type).toBe('decision')
    expect(arg.condition_text).toBe('Wenn Stammkunde → Rabatt, sonst Standardpreis')
  })
})
