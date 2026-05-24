import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAdminFrom } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: mockAdminFrom }),
}))

import {
  computeMissingMandatorySlots,
  MANDATORY_SLOTS,
  buildTools,
  type StepEntry,
} from './interviewAgent'

function makeStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return {
    title: 'Rechnungseingang buchen',
    role: null,
    status: 'exploring',
    slots: {
      frequency_per_month: null,
      duration_minutes: null,
      rule_based: null,
      data_sources: null,
      error_rate_percent: null,
      media_breaks: null,
    },
    ...overrides,
  }
}

function makeFilledStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return makeStep({
    slots: {
      frequency_per_month: { value: 20, quote: 'etwa 20 mal im Monat' },
      duration_minutes: { value: 15, quote: 'dauert so 15 Minuten' },
      rule_based: { value: true, quote: 'immer gleich, ja' },
      data_sources: null,
      error_rate_percent: null,
      media_breaks: null,
    },
    ...overrides,
  })
}

// ─── computeMissingMandatorySlots ─────────────────────────────────────────────

describe('computeMissingMandatorySlots', () => {
  it('returns all 3 mandatory slots when step has no filled slots', () => {
    const steps: StepEntry[] = [makeStep()]
    const missing = computeMissingMandatorySlots(steps)
    expect(missing).toHaveLength(3)
    expect(missing.map((m) => m.slot)).toEqual(expect.arrayContaining([...MANDATORY_SLOTS]))
    expect(missing.every((m) => m.step_title === 'Rechnungseingang buchen')).toBe(true)
  })

  it('returns empty array when all mandatory slots are filled', () => {
    const steps: StepEntry[] = [makeFilledStep()]
    const missing = computeMissingMandatorySlots(steps)
    expect(missing).toHaveLength(0)
  })

  it('returns only missing mandatory slots (not optional)', () => {
    const steps: StepEntry[] = [
      makeStep({
        slots: {
          frequency_per_month: { value: 10, quote: 'zehnmal' },
          duration_minutes: null,
          rule_based: { value: false, quote: 'unterschiedlich' },
          data_sources: null,
          error_rate_percent: null,
          media_breaks: null,
        },
      }),
    ]
    const missing = computeMissingMandatorySlots(steps)
    expect(missing).toHaveLength(1)
    expect(missing[0].slot).toBe('duration_minutes')
  })

  it('aggregates missing slots across multiple steps', () => {
    const steps: StepEntry[] = [
      makeStep({ title: 'Schritt A' }),
      makeFilledStep({ title: 'Schritt B' }),
    ]
    const missing = computeMissingMandatorySlots(steps)
    expect(missing).toHaveLength(3)
    expect(missing.every((m) => m.step_title === 'Schritt A')).toBe(true)
  })

  it('returns empty array for empty step_tracker', () => {
    expect(computeMissingMandatorySlots([])).toHaveLength(0)
  })
})

// ─── Tool Handlers ────────────────────────────────────────────────────────────

describe('Tool Handlers', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── register_step ───────────────────────────────────────────────────────────

  describe('register_step', () => {
    it('adds new step to empty step_tracker', async () => {
      mockAdminFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: [] }, error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })

      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.register_step as any).execute({ title: 'Rechnungseingang', role: undefined })

      expect(result.success).toBe(true)
      expect(result.step_tracker).toHaveLength(1)
      expect(result.step_tracker[0].title).toBe('Rechnungseingang')
      expect(result.step_tracker[0].status).toBe('exploring')
      expect(result.step_tracker[0].slots.frequency_per_month).toBeNull()
    })

    it('deduplicates case-insensitively and returns deduplicated flag', async () => {
      const existing = [makeStep({ title: 'Rechnungseingang buchen' })]
      mockAdminFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: existing }, error: null }),
      })

      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.register_step as any).execute({ title: 'RECHNUNGSEINGANG BUCHEN', role: undefined })

      expect(result.success).toBe(true)
      expect(result.deduplicated).toBe(true)
    })
  })

  // ── record_slot ─────────────────────────────────────────────────────────────

  describe('record_slot', () => {
    it('fills slot with value and evidence_quote', async () => {
      const tracker = [makeStep({ title: 'Rechnungseingang' })]
      mockAdminFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: tracker }, error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })

      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.record_slot as any).execute({
        step_title: 'Rechnungseingang',
        slot: 'frequency_per_month',
        value: 20,
        evidence_quote: 'etwa 20 mal im Monat',
      })

      expect(result.success).toBe(true)
      expect(result.slot).toBe('frequency_per_month')
      expect(result.value).toBe(20)
    })

    it('rejects short evidence_quote (Grounding Guard)', async () => {
      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.record_slot as any).execute({
        step_title: 'Rechnungseingang',
        slot: 'frequency_per_month',
        value: 20,
        evidence_quote: 'ab',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('evidence_quote')
    })

    it('auto-sets status to done when all mandatory slots are filled', async () => {
      const tracker = [
        makeStep({
          title: 'Rechnungseingang',
          slots: {
            frequency_per_month: { value: 20, quote: 'etwa 20 mal' },
            duration_minutes: { value: 15, quote: '15 Minuten' },
            rule_based: null,
            data_sources: null,
            error_rate_percent: null,
            media_breaks: null,
          },
        }),
      ]

      let capturedUpdate: unknown
      mockAdminFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: tracker }, error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockImplementation((data: unknown) => {
            capturedUpdate = data
            return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
          }),
        })

      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tools.record_slot as any).execute({
        step_title: 'Rechnungseingang',
        slot: 'rule_based',
        value: true,
        evidence_quote: 'immer gleich, ja',
      })

      const updated = (capturedUpdate as { step_tracker: StepEntry[] }).step_tracker
      expect(updated[0].status).toBe('done')
    })
  })

  // ── enter_coverage_check ────────────────────────────────────────────────────

  describe('enter_coverage_check', () => {
    it('transitions phase to coverage_check and returns missing mandatory slots', async () => {
      const tracker = [makeStep({ title: 'Schritt A' })]
      mockAdminFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: tracker }, error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })

      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.enter_coverage_check as any).execute({})

      expect(result.success).toBe(true)
      expect(result.phase).toBe('coverage_check')
      expect(result.missing_mandatory_slots).toHaveLength(3)
      expect(result.all_covered).toBe(false)
    })

    it('reports all_covered true when all mandatory slots are filled', async () => {
      const tracker = [makeFilledStep({ title: 'Schritt A' })]
      mockAdminFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: tracker }, error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })

      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.enter_coverage_check as any).execute({})

      expect(result.success).toBe(true)
      expect(result.all_covered).toBe(true)
      expect(result.missing_mandatory_slots).toHaveLength(0)
    })
  })

  // ── link_bottleneck ─────────────────────────────────────────────────────────

  describe('link_bottleneck', () => {
    it('creates knowledge_object with step_ref in content and updates extractions_log', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
      let capturedLogUpdate: unknown

      mockAdminFrom
        // knowledge_objects insert
        .mockReturnValueOnce({ insert: insertMock })
        // interview_state select (extractions_log)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { extractions_log: [] }, error: null }),
        })
        // interview_state update
        .mockReturnValueOnce({
          update: vi.fn().mockImplementation((data: unknown) => {
            capturedLogUpdate = data
            return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
          }),
        })

      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.link_bottleneck as any).execute({
        step_title: 'Rechnungseingang',
        description: 'Manuelles Kopieren aus SAP dauert 30 Minuten',
        severity: 'high',
      })

      expect(result.success).toBe(true)
      expect(result.step_title).toBe('Rechnungseingang')

      // knowledge_object has step_ref in content-jsonb
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pain_point',
          content: expect.objectContaining({ step_ref: 'Rechnungseingang', severity: 'high' }),
        })
      )

      // extractions_log updated with the new pain point
      const logUpdate = capturedLogUpdate as { extractions_log: unknown[] }
      expect(logUpdate.extractions_log).toHaveLength(1)
      expect(logUpdate.extractions_log[0]).toMatchObject({
        type: 'pain_point',
        content: expect.objectContaining({ step_ref: 'Rechnungseingang' }),
      })
    })
  })
})
