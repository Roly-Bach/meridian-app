import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAdminFrom, mockAdminRpc } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  mockAdminRpc: vi.fn().mockResolvedValue({ data: null, error: null }),
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({ from: mockAdminFrom, rpc: mockAdminRpc }),
}))

import {
  computeMissingMandatorySlots,
  computeWalkthroughSlotTarget,
  POTENZIAL_SLOT_NAMES,
  TAZITE_SLOT_NAMES,
  buildTools,
  extractNumericTokens,
  detectNumberAnchoring,
  detectDrillStops,
  detectPersonaRefuse,
  detectFillerPhrases,
  type StepEntry,
} from './interviewAgent'

function makeStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return {
    title: 'Rechnungseingang buchen',
    reihenfolge: 1,
    governance: null,
    abhaengigkeiten: null,
    status: 'exploring',
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

// All 10 slots filled (4 potenzial + 6 tazite) — used for "all done" assertions.
function makeFilledStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return makeStep({
    potenzial: {
      frequency_per_month: { value: 20, quote: 'etwa 20 mal im Monat' },
      duration_minutes: { value: 15, quote: 'dauert so 15 Minuten' },
      error_rate_percent: { value: 5, quote: 'ca. 5% Fehlerrate' },
      media_breaks: { value: 2, quote: '2 Medienbrüche' },
    },
    slots: {
      entscheidungslogik: { value: 'Regelbasiert nach Betrag', quote: 'immer nach Betrag', nicht_befund_typ: null },
      tazite_cues: { value: ['SAP-Kenntnisse nötig'], quote: 'SAP Kenntnisse', nicht_befund_typ: null },
      ausnahmen: { value: ['Storno'], quote: 'Storno ist Ausnahme', nicht_befund_typ: null },
      inputs: { value: ['Eingangsrechnung'], quote: 'Rechnung kommt an', nicht_befund_typ: null },
      outputs: { value: ['Gebuchte Rechnung'], quote: 'dann gebucht', nicht_befund_typ: null },
      hilfsmittel: { value: ['SAP'], quote: 'SAP nutze ich dabei', nicht_befund_typ: null },
    },
    ...overrides,
  })
}

// ─── extractNumericTokens + detectNumberAnchoring (Pt7) ──────────────────────

describe('extractNumericTokens', () => {
  it('extracts standalone integers', () => {
    expect(extractNumericTokens('Wie oft? Etwa 20 mal pro Monat.')).toEqual(['20'])
  })

  it('extracts decimal numbers with dot', () => {
    expect(extractNumericTokens('ca. 1.5 Stunden')).toContain('1.5')
  })

  it('extracts decimal numbers with comma (German locale)', () => {
    expect(extractNumericTokens('ca. 1,5 Stunden')).toContain('1,5')
  })

  it('deduplicates repeated numbers', () => {
    const result = extractNumericTokens('20 Rechnungen oder 20 Vorgänge')
    expect(result.filter(n => n === '20').length).toBe(1)
  })

  it('returns empty array for text without numbers', () => {
    expect(extractNumericTokens('Wie oft passiert das?')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(extractNumericTokens('')).toEqual([])
  })
})

describe('detectNumberAnchoring', () => {
  it('detects when Talker re-quotes a briefing number in a question', () => {
    const talker = 'Du hast vorhin den Prozess beschrieben. Passiert das etwa 20 mal pro Monat?'
    const briefing = 'Frage nach Häufigkeit — ca. 20 mal pro Monat'
    expect(detectNumberAnchoring(talker, briefing)).toContain('20')
  })

  it('does NOT flag number that appears only in a statement, not a question', () => {
    const talker = 'Du hast 20 Vorgänge erwähnt. Wie oft passiert das genau?'
    const briefing = 'Häufigkeit: ca. 20 mal'
    // "20" appears in a non-question sentence
    expect(detectNumberAnchoring(talker, briefing)).toEqual([])
  })

  it('returns empty array when briefing has no numbers', () => {
    const talker = 'Wie oft machst du das pro Monat?'
    expect(detectNumberAnchoring(talker, 'Frage nach Häufigkeit des Prozesses')).toEqual([])
  })

  it('returns empty array when Talker does not re-quote the number', () => {
    const talker = 'Wie oft passiert das ungefähr?'
    expect(detectNumberAnchoring(talker, 'ca. 15 mal pro Woche')).toEqual([])
  })

  it('does NOT flag when Talker asks open question without number', () => {
    const talker = 'Wie lange dauert dieser Schritt in der Regel?'
    expect(detectNumberAnchoring(talker, 'Dauer ca. 30 Minuten')).toEqual([])
  })
})

// ─── computeMissingMandatorySlots ─────────────────────────────────────────────

describe('computeMissingMandatorySlots', () => {
  it('returns all 10 mandatory slots (4 potenzial + 6 tazite) when step has no filled slots', () => {
    const steps: StepEntry[] = [makeStep()]
    const missing = computeMissingMandatorySlots(steps)
    expect(missing).toHaveLength(10)
    expect(missing.map((m) => m.slot)).toEqual(
      expect.arrayContaining([...POTENZIAL_SLOT_NAMES, ...TAZITE_SLOT_NAMES])
    )
    expect(missing.every((m) => m.step_title === 'Rechnungseingang buchen')).toBe(true)
  })

  it('returns empty array when all mandatory slots are filled', () => {
    const steps: StepEntry[] = [makeFilledStep()]
    const missing = computeMissingMandatorySlots(steps)
    expect(missing).toHaveLength(0)
  })

  it('returns only the missing slots when some potenzial + tazite are already filled', () => {
    const steps: StepEntry[] = [
      makeStep({
        potenzial: {
          frequency_per_month: { value: 10, quote: 'zehnmal' },
          duration_minutes: { value: 15, quote: '15 min' },
          error_rate_percent: null,
          media_breaks: null,
        },
        slots: {
          entscheidungslogik: { value: 'regelbasiert', quote: 'immer gleich', nicht_befund_typ: null },
          tazite_cues: { value: ['SAP-Wissen'], quote: 'SAP', nicht_befund_typ: null },
          ausnahmen: null,
          inputs: null,
          outputs: null,
          hilfsmittel: null,
        },
      }),
    ]
    const missing = computeMissingMandatorySlots(steps)
    // 2 potenzial missing + 4 tazite missing = 6
    expect(missing).toHaveLength(6)
    expect(missing.map((m) => m.slot)).toEqual(
      expect.arrayContaining(['error_rate_percent', 'media_breaks', 'ausnahmen', 'inputs', 'outputs', 'hilfsmittel'])
    )
  })

  it('aggregates missing slots across multiple steps', () => {
    const steps: StepEntry[] = [
      makeStep({ title: 'Schritt A' }),
      makeFilledStep({ title: 'Schritt B' }),
    ]
    const missing = computeMissingMandatorySlots(steps)
    expect(missing).toHaveLength(10)
    expect(missing.every((m) => m.step_title === 'Schritt A')).toBe(true)
  })

  it('returns empty array for empty step_tracker', () => {
    expect(computeMissingMandatorySlots([])).toHaveLength(0)
  })
})

// ─── computeWalkthroughSlotTarget (L1) ────────────────────────────────────────

describe('computeWalkthroughSlotTarget', () => {
  it('returns null when no active step', () => {
    const steps: StepEntry[] = [makeFilledStep({ status: 'done' })]
    expect(computeWalkthroughSlotTarget(steps)).toBeNull()
  })

  it('returns null when tracker empty', () => {
    expect(computeWalkthroughSlotTarget([])).toBeNull()
  })

  it('returns null when active step has all mandatory slots filled', () => {
    const steps: StepEntry[] = [makeFilledStep({ status: 'walkthrough' })]
    expect(computeWalkthroughSlotTarget(steps)).toBeNull()
  })

  it('prefers walkthrough over exploring as active step', () => {
    const steps: StepEntry[] = [
      makeStep({ title: 'Explorier-Step', status: 'exploring' }),
      makeStep({ title: 'Walkthrough-Step', status: 'walkthrough' }),
    ]
    const target = computeWalkthroughSlotTarget(steps)
    expect(target?.step_title).toBe('Walkthrough-Step')
  })

  it('picks potenzial slots before tazite (canonical order)', () => {
    const steps: StepEntry[] = [
      makeStep({
        status: 'walkthrough',
        potenzial: {
          frequency_per_month: { value: 5, quote: 'fünfmal' },
          duration_minutes: null,
          error_rate_percent: null,
          media_breaks: null,
        },
      }),
    ]
    const target = computeWalkthroughSlotTarget(steps)
    expect(target?.slot).toBe('duration_minutes')
  })

  it('returns target for exploring step when no walkthrough step exists', () => {
    const steps: StepEntry[] = [makeStep({ status: 'exploring' })]
    const target = computeWalkthroughSlotTarget(steps)
    expect(target?.slot).toBe('frequency_per_month')
  })

  it('ignores done steps when picking active', () => {
    const steps: StepEntry[] = [
      makeFilledStep({ title: 'Done', status: 'done' }),
      makeStep({ title: 'Live', status: 'walkthrough' }),
    ]
    expect(computeWalkthroughSlotTarget(steps)?.step_title).toBe('Live')
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
      const result = await (tools.register_step as any).execute({ title: 'Rechnungseingang' })

      expect(result.success).toBe(true)
      expect(result.step_tracker).toHaveLength(1)
      expect(result.step_tracker[0].title).toBe('Rechnungseingang')
      expect(result.step_tracker[0].status).toBe('exploring')
      expect(result.step_tracker[0].potenzial.frequency_per_month).toBeNull()
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
      const result = await (tools.register_step as any).execute({ title: 'Rechnungseingang' })

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
      const result = await (tools.register_step as any).execute({ title: 'RECHNUNGSEINGANG BUCHEN' })

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
      const result = await (tools.register_step as any).execute({ title: 'Mahnprozess' })

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
      const result = await (tools.register_step as any).execute({ title: 'Monatsabschluss' })

      expect(result.success).toBe(true)
      // Non-duplicate path does not set deduplicated — step is added to tracker
      expect(result.deduplicated).toBeUndefined()
      expect(result.step_tracker).toHaveLength(2)
    })
  })

  // ── record_slot ─────────────────────────────────────────────────────────────

  describe('record_slot', () => {
    it('fills potenzial slot with value and evidence_quote', async () => {
      const tracker = [makeStep({ title: 'Rechnungseingang' })]
      mockAdminFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: tracker }, error: null }),
      })
      // record_slot uses rpc() for atomic writes (PROJ-27/BL-E1.5)
      mockAdminRpc.mockResolvedValue({ data: null, error: null })

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
      // verify atomic rpc write was called with correct path
      expect(mockAdminRpc).toHaveBeenCalledWith('patch_interview_step_field', expect.objectContaining({
        p_sub_path: ['potenzial', 'frequency_per_month'],
      }))
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

    it('auto-sets status to done when all 10 mandatory slots are filled', async () => {
      // Tracker: all potenzial filled (4/4), 5 tazite filled — missing only ausnahmen
      const tracker = [
        makeStep({
          title: 'Rechnungseingang',
          potenzial: {
            frequency_per_month: { value: 20, quote: 'etwa 20 mal' },
            duration_minutes: { value: 15, quote: '15 Minuten' },
            error_rate_percent: { value: 5, quote: 'ca. 5%' },
            media_breaks: { value: 2, quote: '2 Brüche' },
          },
          slots: {
            entscheidungslogik: { value: 'regelbasiert', quote: 'immer gleich', nicht_befund_typ: null },
            tazite_cues: { value: ['SAP'], quote: 'SAP', nicht_befund_typ: null },
            ausnahmen: null,
            inputs: { value: ['Rechnung'], quote: 'Rechnung', nicht_befund_typ: null },
            outputs: { value: ['Buchung'], quote: 'Buchung', nicht_befund_typ: null },
            hilfsmittel: { value: ['SAP FI'], quote: 'SAP FI', nicht_befund_typ: null },
          },
        }),
      ]

      mockAdminFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: tracker }, error: null }),
      })
      mockAdminRpc.mockResolvedValue({ data: null, error: null })

      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tools.record_slot as any).execute({
        step_title: 'Rechnungseingang',
        slot: 'ausnahmen',
        value: ['Storno'],
        evidence_quote: 'Storno ist eine Ausnahme',
      })

      // PROJ-27: 'done' status written via separate rpc call (may precede by 'walkthrough' call)
      const doneStatusCall = mockAdminRpc.mock.calls.find(
        (call: unknown[]) => {
          const p = call[1] as Record<string, unknown>
          return Array.isArray(p?.p_sub_path) && (p.p_sub_path as string[]).join('.') === 'status' && p.p_value === JSON.stringify('done')
        }
      )
      expect(doneStatusCall).toBeDefined()
    })

    it('does not set status to done when multiple tazite slots are still missing', async () => {
      const tracker = [
        makeStep({
          title: 'Rechnungseingang',
          potenzial: {
            frequency_per_month: null,
            duration_minutes: null,
            error_rate_percent: null,
            media_breaks: null,
          },
        }),
      ]

      mockAdminFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: tracker }, error: null }),
      })
      mockAdminRpc.mockResolvedValue({ data: null, error: null })

      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tools.record_slot as any).execute({
        step_title: 'Rechnungseingang',
        slot: 'frequency_per_month',
        value: 20,
        evidence_quote: 'etwa 20 mal im Monat',
      })

      // PROJ-27: no 'done' status rpc call should have been made
      const doneCall = mockAdminRpc.mock.calls.find(
        (call: unknown[]) => {
          const p = call[1] as Record<string, unknown>
          const sub = p?.p_sub_path
          return Array.isArray(sub) && (sub as string[]).join('.') === 'status' && (p?.p_value as string)?.includes('done')
        }
      )
      expect(doneCall).toBeUndefined()
    })

    it('rejects non-string value for entscheidungslogik (must be string)', async () => {
      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.record_slot as any).execute({
        step_title: 'Rechnungseingang',
        slot: 'entscheidungslogik',
        value: true,
        evidence_quote: 'Zweitfreigabe wenn Betrag über 5.000 EUR',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('String')
    })

    it('rejects string value for media_breaks (must be number)', async () => {
      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.record_slot as any).execute({
        step_title: 'Rechnungseingang',
        slot: 'frequency_per_month',
        value: 'monatlich',
        evidence_quote: 'das mache ich monatlich',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Zahl')
    })

    it('rejects non-array for hilfsmittel', async () => {
      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.record_slot as any).execute({
        step_title: 'Rechnungseingang',
        slot: 'hilfsmittel',
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

  // ── record_dependency (PROJ-26) ─────────────────────────────────────────────

  describe('record_dependency', () => {
    function makeTrackerWithIds(): StepEntry[] {
      return [
        makeStep({ id: 'S001', title: 'Schritt A' }),
        makeStep({ id: 'S002', title: 'Schritt B', reihenfolge: 2 }),
      ]
    }

    function mockWithTracker(tracker: StepEntry[]) {
      mockAdminFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { step_tracker: tracker }, error: null }),
      })
      mockAdminRpc.mockResolvedValue({ data: null, error: null })
    }

    it('records depends_on edge between two known steps', async () => {
      mockWithTracker(makeTrackerWithIds())
      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.record_dependency as any).execute({
        source_step_id: 'S001',
        target_step_id: 'S002',
        richtung: 'depends_on',
        typ: 'voraussetzung',
        beschreibung: 'S002 muss zuerst abgeschlossen sein',
      })
      expect(result.success).toBe(true)
      expect(result.abhaengigkeiten.depends_on).toHaveLength(1)
      expect(result.abhaengigkeiten.depends_on[0].schritt_id).toBe('S002')
      expect(result.abhaengigkeiten.depends_on[0].typ).toBe('voraussetzung')
      expect(mockAdminRpc).toHaveBeenCalledWith('patch_interview_step_field', expect.objectContaining({
        p_sub_path: ['abhaengigkeiten'],
      }))
    })

    it('records influences edge between two known steps', async () => {
      mockWithTracker(makeTrackerWithIds())
      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.record_dependency as any).execute({
        source_step_id: 'S001',
        target_step_id: 'S002',
        richtung: 'influences',
        typ: 'beeinflusst',
        beschreibung: null,
      })
      expect(result.success).toBe(true)
      expect(result.abhaengigkeiten.influences).toHaveLength(1)
      expect(result.abhaengigkeiten.influences[0].typ).toBe('beeinflusst')
    })

    it('sets nicht_befund_typ in Nicht-Befund-Modus', async () => {
      mockWithTracker(makeTrackerWithIds())
      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.record_dependency as any).execute({
        source_step_id: 'S001',
        nicht_befund_typ: 'nicht_zutreffend',
      })
      expect(result.success).toBe(true)
      expect(result.abhaengigkeiten.nicht_befund_typ).toBe('nicht_zutreffend')
      expect(result.abhaengigkeiten.depends_on).toHaveLength(0)
    })

    it('rejects self-reference (source_step_id === target_step_id)', async () => {
      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.record_dependency as any).execute({
        source_step_id: 'S001',
        target_step_id: 'S001',
        richtung: 'depends_on',
        typ: 'voraussetzung',
        beschreibung: null,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Selbstreferenz')
    })

    it('rejects phantom source (source_step_id not in step_tracker)', async () => {
      mockWithTracker(makeTrackerWithIds())
      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.record_dependency as any).execute({
        source_step_id: 'S099',
        target_step_id: 'S001',
        richtung: 'depends_on',
        typ: 'voraussetzung',
        beschreibung: null,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('S099')
    })

    it('rejects phantom target (target_step_id not in step_tracker)', async () => {
      mockWithTracker(makeTrackerWithIds())
      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.record_dependency as any).execute({
        source_step_id: 'S001',
        target_step_id: 'S099',
        richtung: 'depends_on',
        typ: 'voraussetzung',
        beschreibung: null,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('S099')
    })

    it('rejects type mismatch (influences-type passed to depends_on)', async () => {
      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.record_dependency as any).execute({
        source_step_id: 'S001',
        target_step_id: 'S002',
        richtung: 'depends_on',
        typ: 'beeinflusst',
        beschreibung: null,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('beeinflusst')
    })

    it('is idempotent: duplicate edge returns skipped:true without re-inserting', async () => {
      const withExistingEdge: StepEntry[] = [
        makeStep({
          id: 'S001',
          title: 'Schritt A',
          abhaengigkeiten: {
            depends_on: [{ schritt_id: 'S002', typ: 'voraussetzung', beschreibung: null }],
            influences: [],
            nicht_befund_typ: null,
          },
        }),
        makeStep({ id: 'S002', title: 'Schritt B', reihenfolge: 2 }),
      ]
      mockWithTracker(withExistingEdge)
      const tools = buildTools('iv-1', 'ws-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.record_dependency as any).execute({
        source_step_id: 'S001',
        target_step_id: 'S002',
        richtung: 'depends_on',
        typ: 'voraussetzung',
        beschreibung: null,
      })
      expect(result.success).toBe(true)
      expect(result.skipped).toBe(true)
    })
  })

  describe('detectDrillStops (F1)', () => {
    it('returns empty when no recent turns', () => {
      const step = makeStep({ status: 'walkthrough' })
      expect(detectDrillStops(undefined, [step])).toEqual([])
      expect(detectDrillStops([], [step])).toEqual([])
    })

    it('returns empty when no active step', () => {
      const step = makeStep({ status: 'done' })
      const turns = ['Wie lange dauert das?', 'Wie viele Minuten brauchst du?']
      expect(detectDrillStops(turns, [step])).toEqual([])
    })

    it('returns empty when slot has been filled (potenzial.duration_minutes)', () => {
      const step = makeStep({
        status: 'walkthrough',
        potenzial: {
          frequency_per_month: null,
          duration_minutes: { value: 30, quote: '30min', confidence: 'estimate', writeSource: 'analyst' },
          error_rate_percent: null,
          media_breaks: null,
        },
      })
      const turns = ['Wie lange dauert das?', 'Wie viele Minuten benötigst du?']
      expect(detectDrillStops(turns, [step])).toEqual([])
    })

    it('warns when same duration slot is targeted twice in recent turns', () => {
      const step = makeStep({ status: 'walkthrough' })
      const turns = [
        'Wie viele Minuten dauert dieser Schritt?',
        'Welcher Wert wäre eine grobe Schätzung für die Dauer pro Rechnung?',
      ]
      const result = detectDrillStops(turns, [step])
      expect(result).toHaveLength(1)
      expect(result[0]).toMatch(/duration_minutes/)
      expect(result[0]).toMatch(/NICHT erneut fragen/)
    })

    it('warns on repeated frequency question', () => {
      const step = makeStep({ status: 'walkthrough' })
      const turns = [
        'Wie viele Konten gleichst du ab?',
        'Welcher Wert wäre eine grobe Schätzung für die Anzahl?',
        'Wie viele Konten typischerweise pro Monat?',
      ]
      const result = detectDrillStops(turns, [step])
      expect(result.some(w => w.includes('frequency_per_month'))).toBe(true)
    })

    it('does not warn when only one turn matches a slot', () => {
      const step = makeStep({ status: 'walkthrough' })
      const turns = ['Wie lange dauert das?', 'Welche Systeme nutzt du dafür?']
      expect(detectDrillStops(turns, [step])).toEqual([])
    })

    it('F1b: triggers after 1 question when persona refused', () => {
      const step = makeStep({ status: 'walkthrough' })
      const turns = ['Wie viele Minuten dauert das im Durchschnitt?']
      const refuse = 'Eine exakte Minutenzahl lässt sich nicht festlegen, da der Aufwand stark variiert.'
      const result = detectDrillStops(turns, [step], refuse)
      expect(result).toHaveLength(1)
      expect(result[0]).toMatch(/Refuse-Pattern erkannt/)
    })

    it('F1b: still requires 1 question — no warn if zero asked', () => {
      const step = makeStep({ status: 'walkthrough' })
      const turns = ['Welche Systeme nutzt du?']
      const refuse = 'Das kann ich nicht exakt sagen, variiert stark.'
      expect(detectDrillStops(turns, [step], refuse)).toEqual([])
    })
  })

  describe('detectPersonaRefuse (F1b)', () => {
    it('detects "lässt sich nicht beziffern"', () => {
      expect(detectPersonaRefuse('Das lässt sich nicht pauschal beziffern.')).toBe(true)
    })
    it('detects "keine exakte Zahl"', () => {
      expect(detectPersonaRefuse('Hierzu führe ich keine exakte Aufzeichnung.')).toBe(true)
    })
    it('detects "variiert stark"', () => {
      expect(detectPersonaRefuse('Der Aufwand variiert stark je nach Belegqualität.')).toBe(true)
    })
    it('does not flag normal answers', () => {
      expect(detectPersonaRefuse('Ich bearbeite ca. 100 Rechnungen pro Monat.')).toBe(false)
    })
    it('handles undefined', () => {
      expect(detectPersonaRefuse(undefined)).toBe(false)
    })
  })

  describe('detectFillerPhrases (F1c question templates)', () => {
    it('detects "Welcher Wert wäre eine grobe Schätzung"', () => {
      const fillers = detectFillerPhrases('Welcher Wert wäre eine grobe Schätzung für die Dauer?')
      expect(fillers).toContain('Welcher Wert wäre eine grobe Schätzung')
    })
    it('detects opener + question template combined', () => {
      const text = 'Verstanden, das variiert. Welcher Wert wäre eine grobe Schätzung für die Anzahl?'
      const fillers = detectFillerPhrases(text)
      expect(fillers.length).toBeGreaterThanOrEqual(2)
      expect(fillers.some(f => f.includes('Verstanden'))).toBe(true)
      expect(fillers).toContain('Welcher Wert wäre eine grobe Schätzung')
    })
    it('does not flag non-template questions', () => {
      const fillers = detectFillerPhrases('Wie genau beginnt der Prozess für dich?')
      expect(fillers).toEqual([])
    })

    it('F1d: detects "Notiere ich als variabel"', () => {
      const fillers = detectFillerPhrases('Notiere ich als variabel. Wie geht es weiter?')
      expect(fillers).toContain('Notiere ich als variabel')
    })
    it('F1d: detects "halten wir das offen"', () => {
      const fillers = detectFillerPhrases('Verstanden, halten wir das offen — gehen wir weiter zu Schritt 2.')
      expect(fillers).toContain('halten wir das offen')
      expect(fillers).toContain('gehen wir weiter zu')
    })
    it('F1d: detects "Nächster Punkt"', () => {
      const fillers = detectFillerPhrases('Notiere ich als variabel. Nächster Punkt: Wie sieht der Abschluss aus?')
      expect(fillers).toContain('Notiere ich als variabel')
      expect(fillers).toContain('Nächster Punkt')
    })
  })
})
