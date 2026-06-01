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
    process_steps: [],
    friction_points: [],
    friction_tools: [],
    pain_point_primary: null,
    ...overrides,
  }
}

function makeFilledStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return makeStep({
    slots: {
      frequency_per_month: { value: 20, quote: 'etwa 20 mal im Monat' },
      duration_minutes: { value: 15, quote: 'dauert so 15 Minuten' },
      rule_based: { value: true, quote: 'immer gleich, ja' },
      data_sources: { value: ['SAP'], quote: 'SAP nutze ich dabei' },
      error_rate_percent: null,
      media_breaks: null,
    },
    ...overrides,
  })
}

// ─── computeMissingMandatorySlots ─────────────────────────────────────────────

describe('computeMissingMandatorySlots', () => {
  it('returns all 4 mandatory slots when step has no filled slots', () => {
    const steps: StepEntry[] = [makeStep()]
    const missing = computeMissingMandatorySlots(steps)
    expect(missing).toHaveLength(4)
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
    expect(missing).toHaveLength(2)
    expect(missing.map((m) => m.slot)).toEqual(expect.arrayContaining(['duration_minutes', 'data_sources']))
  })

  it('aggregates missing slots across multiple steps', () => {
    const steps: StepEntry[] = [
      makeStep({ title: 'Schritt A' }),
      makeFilledStep({ title: 'Schritt B' }),
    ]
    const missing = computeMissingMandatorySlots(steps)
    expect(missing).toHaveLength(4)
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

    it('initializes walkthrough fields as empty arrays and null', async () => {
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
      expect(result.step_tracker[0].process_steps).toEqual([])
      expect(result.step_tracker[0].friction_points).toEqual([])
      expect(result.step_tracker[0].friction_tools).toEqual([])
      expect(result.step_tracker[0].pain_point_primary).toBeNull()
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

    it('deduplicates via German process suffix normalization (Mahnwesen vs Mahnprozess)', async () => {
      // "Mahnwesen" → strip "wesen" → "mahn"
      // "Mahnprozess" → strip "prozess" → "mahn"
      // Both normalize to same root → dedup fires
      const existing = [makeStep({ title: 'Mahnwesen' })]
      mockAdminFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: existing }, error: null }),
      })

      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.register_step as any).execute({ title: 'Mahnprozess', role: undefined })

      expect(result.success).toBe(true)
      expect(result.deduplicated).toBe(true)
    })

    it('does NOT deduplicate when normalized roots differ (≥4 chars)', async () => {
      // "Rechnungsprüfung" → strip nothing matching → stays "rechnungsprüfung"
      // "Monatsabschluss" → strip "abschluss" → "monats" — different root
      const existing = [makeStep({ title: 'Rechnungsprüfung' })]
      mockAdminFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: existing }, error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })

      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.register_step as any).execute({ title: 'Monatsabschluss', role: undefined })

      expect(result.success).toBe(true)
      // Non-duplicate path does not set deduplicated — step is added to tracker
      expect(result.deduplicated).toBeUndefined()
      expect(result.step_tracker).toHaveLength(2)
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
            rule_based: { value: true, quote: 'immer gleich, ja' },
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
        slot: 'data_sources',
        value: ['SAP'],
        evidence_quote: 'SAP nutze ich dabei',
      })

      const updated = (capturedUpdate as { step_tracker: StepEntry[] }).step_tracker
      expect(updated[0].status).toBe('done')
    })

    it('does not set status to done when data_sources (mandatory) is still missing', async () => {
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
      expect(updated[0].status).not.toBe('done')
    })

    it('rejects string value for rule_based (must be boolean)', async () => {
      const tools = buildTools('iv-1', 'ws-1')
      const result = await (tools.record_slot as any).execute({
        step_title: 'Rechnungseingang',
        slot: 'rule_based',
        value: 'Zweitfreigabe ab 5.000 EUR',
        evidence_quote: 'Zweitfreigabe wenn Betrag über 5.000 EUR',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('boolean')
    })

    it('rejects string value for media_breaks (must be number)', async () => {
      const tools = buildTools('iv-1', 'ws-1')
      const result = await (tools.record_slot as any).execute({
        step_title: 'Rechnungseingang',
        slot: 'media_breaks',
        value: 'sehr selten',
        evidence_quote: 'kommt sehr selten vor',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('ganze Zahl')
    })

    it('rejects string value for frequency_per_month (must be number)', async () => {
      const tools = buildTools('iv-1', 'ws-1')
      const result = await (tools.record_slot as any).execute({
        step_title: 'Rechnungseingang',
        slot: 'frequency_per_month',
        value: 'monatlich',
        evidence_quote: 'das mache ich monatlich',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Zahl')
    })

    it('rejects non-array for data_sources', async () => {
      const tools = buildTools('iv-1', 'ws-1')
      const result = await (tools.record_slot as any).execute({
        step_title: 'Rechnungseingang',
        slot: 'data_sources',
        value: 'SAP und Excel',
        evidence_quote: 'SAP und Excel nutze ich dabei',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Array')
    })
  })

  // enter_coverage_check removed in Iteration 2 (PROJ-22) — Orchestrator handles phase transitions.
  // Coverage check logic is tested in interviewOrchestrator.test.ts.

  // ── update_walkthrough_data ─────────────────────────────────────────────────

  describe('update_walkthrough_data', () => {
    it('replaces process_steps on a second call (no additive duplication)', async () => {
      const tracker = [
        makeStep({
          title: 'Rechnungseingang',
          process_steps: ['Rechnung öffnen', 'Datum prüfen'],
          friction_points: [],
          friction_tools: [],
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
      const result = await (tools.update_walkthrough_data as any).execute({
        step_title: 'Rechnungseingang',
        process_steps: ['Betrag kontrollieren'],
      })

      expect(result.success).toBe(true)
      const updated = (capturedUpdate as { step_tracker: StepEntry[] }).step_tracker
      expect(updated[0].process_steps).toEqual([
        'Betrag kontrollieren',
      ])
    })

    it('returns success false when step is not found', async () => {
      mockAdminFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: [] }, error: null }),
      })

      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.update_walkthrough_data as any).execute({
        step_title: 'Nicht vorhanden',
        process_steps: ['Irgendwas'],
      })

      expect(result.success).toBe(false)
    })

    it("transitions status from 'exploring' to 'walkthrough' on first call", async () => {
      const tracker = [makeStep({ title: 'Rechnungseingang', status: 'exploring' })]

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
      await (tools.update_walkthrough_data as any).execute({
        step_title: 'Rechnungseingang',
        friction_points: ['Langer Genehmigungsprozess'],
      })

      const updated = (capturedUpdate as { step_tracker: StepEntry[] }).step_tracker
      expect(updated[0].status).toBe('walkthrough')
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
