import { describe, it, expect, vi, beforeEach } from 'vitest'

// buildTools() (interviewAgent.ts) reaches the prod Supabase admin client via a
// dynamic import in its module graph; stub it so jsdom doesn't trip 'server-only'.
// These tests drive the in-memory MemoryTurnStore, so the stub is never exercised.
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: vi.fn() }))

// quick-extract's restricted toolset is built on the same buildTools() the full
// Analyst uses; only generateText needs mocking to control what the "model" does.
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, generateText: vi.fn() }
})

vi.mock('@/lib/llm-provider', () => ({
  resolveModel: vi.fn().mockReturnValue('mock-model'),
}))

import { generateText, asSchema } from 'ai'
import { runQuickExtract, isAlreadyFilledPotenzialSlot } from './interviewQuickExtract'
import { buildTools } from './interviewAgent'
import { createMemoryTurnStore } from './turnStore/memoryTurnStore'
import type { StepEntry } from './interviewSemantic'

function makeStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return {
    title: 'Rechnungseingang buchen',
    reihenfolge: 1,
    governance: null,
    abhaengigkeiten: null,
    status: 'walkthrough',
    potenzial: {
      frequency_per_month: null,
      duration_minutes: null,
      error_rate_percent: null,
      media_breaks: null,
    },
    slots: {
      entscheidungslogik: null,
      tazite_cues: null,
      ausnahmen: null,
      inputs: null,
      outputs: null,
      hilfsmittel: null,
    },
    process_steps: [],
    friction_points: [],
    friction_tools: [],
    pain_point_primary: null,
    ...overrides,
  }
}

const FILLED_BY_ANALYST = { value: 350, quote: 'irgendwas', writeSource: 'analyst_online' as const }

// ─── isAlreadyFilledPotenzialSlot (pure guard) ─────────────────────────────────

describe('isAlreadyFilledPotenzialSlot', () => {
  it('true when potenzial slot already has a value', () => {
    const tracker = [makeStep({ potenzial: { frequency_per_month: FILLED_BY_ANALYST, duration_minutes: null, error_rate_percent: null, media_breaks: null } })]
    expect(isAlreadyFilledPotenzialSlot(tracker, { step_title: 'Rechnungseingang buchen', slot: 'frequency_per_month' })).toBe(true)
  })

  it('false when potenzial slot is still null', () => {
    const tracker = [makeStep()]
    expect(isAlreadyFilledPotenzialSlot(tracker, { step_title: 'Rechnungseingang buchen', slot: 'frequency_per_month' })).toBe(false)
  })

  it('false for tazite slots even when filled — only potenzial slots are priority-gated', () => {
    const tracker = [makeStep({ slots: { entscheidungslogik: { value: 'x', quote: 'q', nicht_befund_typ: null }, tazite_cues: null, ausnahmen: null, inputs: null, outputs: null, hilfsmittel: null } })]
    expect(isAlreadyFilledPotenzialSlot(tracker, { step_title: 'Rechnungseingang buchen', slot: 'entscheidungslogik' })).toBe(false)
  })

  it('false when is_correction=true — explicit corrections bypass the guard', () => {
    const tracker = [makeStep({ potenzial: { frequency_per_month: FILLED_BY_ANALYST, duration_minutes: null, error_rate_percent: null, media_breaks: null } })]
    expect(
      isAlreadyFilledPotenzialSlot(tracker, { step_title: 'Rechnungseingang buchen', slot: 'frequency_per_month', is_correction: true }),
    ).toBe(false)
  })

  it('false when step not found', () => {
    const tracker = [makeStep()]
    expect(isAlreadyFilledPotenzialSlot(tracker, { step_title: 'Unbekannter Schritt', slot: 'frequency_per_month' })).toBe(false)
  })

  it('resolves by step_id when given', () => {
    const tracker = [makeStep({ id: 'S001', potenzial: { frequency_per_month: FILLED_BY_ANALYST, duration_minutes: null, error_rate_percent: null, media_breaks: null } })]
    expect(isAlreadyFilledPotenzialSlot(tracker, { step_id: 'S001', step_title: 'irrelevant', slot: 'frequency_per_month' })).toBe(true)
  })
})

// ─── runQuickExtract — guard wired into the restricted record_slot tool ───────

describe('runQuickExtract record_slot guard (KI-17)', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset()
  })

  it('short-circuits before staging when the model attempts to overwrite an already-filled potenzial slot', async () => {
    const stepTracker = [makeStep({ potenzial: { frequency_per_month: FILLED_BY_ANALYST, duration_minutes: null, error_rate_percent: null, media_breaks: null } })]
    const { store } = createMemoryTurnStore({ stepTracker })

    let toolResult: unknown
    vi.mocked(generateText).mockImplementation(async (opts) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tools = (opts as any).tools
      toolResult = await tools.record_slot.execute(
        { step_title: 'Rechnungseingang buchen', slot: 'frequency_per_month', value: 999, evidence_span: '999', source_turn: 5 },
        {},
      )
      return { steps: [{ toolCalls: [{ toolName: 'record_slot' }] }] } as never
    })

    const result = await runQuickExtract({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      userInput: 'Das sind ungefähr 999 Vorgänge im Monat, deutlich mehr als sonst.',
      stepTracker,
      currentTurnNumber: 5,
      store,
    })

    expect(toolResult).toMatchObject({ success: true, skipped: true })
    // the slot must be untouched — the guard fires before session.stage ever runs
    expect(result?.[0]?.potenzial.frequency_per_month).toEqual(FILLED_BY_ANALYST)
  })

  it('lets the write through when the targeted slot is still null', async () => {
    const stepTracker = [makeStep()]
    const { store } = createMemoryTurnStore({ stepTracker })

    vi.mocked(generateText).mockImplementation(async (opts) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tools = (opts as any).tools
      await tools.record_slot.execute(
        { step_title: 'Rechnungseingang buchen', slot: 'frequency_per_month', value: 42, evidence_span: '42 Vorgänge', source_turn: 1 },
        {},
      )
      return { steps: [{ toolCalls: [{ toolName: 'record_slot' }] }] } as never
    })

    const result = await runQuickExtract({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      userInput: 'Wir bearbeiten 42 Vorgänge im Monat.',
      stepTracker,
      currentTurnNumber: 1,
      store,
    })

    expect(result?.[0]?.potenzial.frequency_per_month?.value).toBe(42)
  })

  it('lets an explicit is_correction=true overwrite through despite the guard', async () => {
    const stepTracker = [makeStep({ potenzial: { frequency_per_month: FILLED_BY_ANALYST, duration_minutes: null, error_rate_percent: null, media_breaks: null } })]
    const { store } = createMemoryTurnStore({ stepTracker })

    vi.mocked(generateText).mockImplementation(async (opts) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tools = (opts as any).tools
      await tools.record_slot.execute(
        {
          step_title: 'Rechnungseingang buchen',
          slot: 'frequency_per_month',
          value: 12,
          evidence_span: 'eigentlich nur 12',
          source_turn: 6,
          is_correction: true,
        },
        {},
      )
      return { steps: [{ toolCalls: [{ toolName: 'record_slot' }] }] } as never
    })

    const result = await runQuickExtract({
      interviewId: 'iv-1',
      workspaceId: 'ws-1',
      userInput: 'Korrektur: eigentlich nur 12 im Monat, ich hatte mich vorhin vertan.',
      stepTracker,
      currentTurnNumber: 6,
      store,
    })

    expect(result?.[0]?.potenzial.frequency_per_month?.value).toBe(12)
  })
})

// ─── record_slot execute-signature compatibility (#12, 2026-07-14) ────────────
// interviewQuickExtract.ts's execute override casts its hand-written arg type to the
// base tool's execute `as any` (no structural check from the compiler). This test
// pins the override's arg shape (step_id?, step_title, slot, is_correction?, plus
// the base fields it forwards) against interviewAgent.ts's real record_slot.inputSchema
// (Zod) — it goes red if a future change to the base schema drops/renames a field the
// override or the priority-guard (isAlreadyFilledPotenzialSlot) relies on.

describe('record_slot execute-signature compatibility (#12)', () => {
  it('the quick-extract override payload shape validates against the real record_slot.inputSchema', async () => {
    const stepTracker = [makeStep()]
    const { store } = createMemoryTurnStore({ stepTracker })
    const session = await store.openTurn('iv-1', 'ws-1')
    const knowledgeTools = buildTools(session, 'irrelevant user input', { source: 'quick' })

    const representativePayload = {
      step_id: 'S001',
      step_title: 'Rechnungseingang buchen',
      slot: 'frequency_per_month',
      value: 42,
      evidence_span: '42 Vorgänge',
      source_turn: 1,
      is_correction: false,
    }

    const result = await asSchema(knowledgeTools.record_slot.inputSchema).validate!(representativePayload)
    expect(result.success).toBe(true)
  })
})
