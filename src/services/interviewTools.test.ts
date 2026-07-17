import { describe, it, expect, vi } from 'vitest'

// Defensive stub: interviewTools.ts itself has no supabase-admin dependency, but
// keep the jsdom test env safe against any transitive server-only import in the
// module graph (matches the pattern used across the other service tests).
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: vi.fn() }))

// PROJ-34/ADR-018: tools no longer write to Supabase; they stage WriteIntents
// through a TurnSession. Tests run against the in-memory MemoryTurnStore and
// assert the tool's LLM-facing result + the resulting snapshot/committed state.
// PROJ-44: moved from interviewAgent.test.ts — buildTools now lives in
// interviewTools.ts (interviewAgent.ts / createInterviewStream were deleted).
import { buildTools } from './interviewTools'
import { createMemoryTurnStore } from './turnStore/memoryTurnStore'
import type { StepEntry, RawExtraction } from './interviewSemantic'

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

/** Open a session over a seeded MemoryTurnStore and build the tools against it. */
async function setup(stepTracker: StepEntry[] = [], extractionsLog: RawExtraction[] = []) {
  const { store, backend } = createMemoryTurnStore({ stepTracker, extractionsLog })
  const session = await store.openTurn('iv-1', 'ws-1')
  const tools = buildTools(session)
  return { tools, session, backend }
}

// ─── Tool Handlers ────────────────────────────────────────────────────────────

describe('Tool Handlers', () => {
  // ── register_step ───────────────────────────────────────────────────────────

  describe('register_step', () => {
    it('adds new step to empty step_tracker', async () => {
      const { tools, session } = await setup([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.register_step as any).execute({ title: 'Rechnungseingang' })

      expect(result.success).toBe(true)
      expect(result.step_tracker).toHaveLength(1)
      expect(result.step_tracker[0].title).toBe('Rechnungseingang')
      expect(result.step_tracker[0].status).toBe('exploring')
      expect(result.step_tracker[0].potenzial.frequency_per_month).toBeNull()
      // staged into the live snapshot
      expect(session.snapshot().stepTracker).toHaveLength(1)
    })

    it('initializes walkthrough fields as empty arrays and null', async () => {
      const { tools } = await setup([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.register_step as any).execute({ title: 'Rechnungseingang' })

      expect(result.success).toBe(true)
      expect(result.step_tracker[0].process_steps).toEqual([])
      expect(result.step_tracker[0].friction_points).toEqual([])
      expect(result.step_tracker[0].friction_tools).toEqual([])
      expect(result.step_tracker[0].pain_point_primary).toBeNull()
    })

    it('deduplicates case-insensitively and returns deduplicated flag', async () => {
      const { tools, session } = await setup([makeStep({ title: 'Rechnungseingang buchen' })])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.register_step as any).execute({ title: 'RECHNUNGSEINGANG BUCHEN' })

      expect(result.success).toBe(true)
      expect(result.deduplicated).toBe(true)
      // no new step staged
      expect(session.snapshot().stepTracker).toHaveLength(1)
    })

    it('deduplicates via German process suffix normalization (Mahnwesen vs Mahnprozess)', async () => {
      const { tools } = await setup([makeStep({ title: 'Mahnwesen' })])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.register_step as any).execute({ title: 'Mahnprozess' })

      expect(result.success).toBe(true)
      expect(result.deduplicated).toBe(true)
    })

    it('does NOT deduplicate when normalized roots differ (≥4 chars)', async () => {
      const { tools, session } = await setup([makeStep({ title: 'Rechnungsprüfung' })])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.register_step as any).execute({ title: 'Monatsabschluss' })

      expect(result.success).toBe(true)
      expect(result.deduplicated).toBeUndefined()
      expect(result.step_tracker).toHaveLength(2)
      expect(session.snapshot().stepTracker).toHaveLength(2)
    })
  })

  // ── record_slot ─────────────────────────────────────────────────────────────

  describe('record_slot', () => {
    it('fills potenzial slot with value and evidence_quote', async () => {
      const { tools, session } = await setup([makeStep({ title: 'Rechnungseingang' })])
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
      // PROJ-38: stored as a slot OBJECT (value lives at .value), not a stringified blob
      const slot = session.snapshot().stepTracker[0].potenzial.frequency_per_month
      expect(slot).toMatchObject({ value: 20 })
    })

    it('rejects short evidence_quote (Grounding Guard)', async () => {
      const { tools } = await setup([])
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
      const { tools, session } = await setup(tracker)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tools.record_slot as any).execute({
        step_title: 'Rechnungseingang',
        slot: 'ausnahmen',
        value: ['Storno'],
        evidence_quote: 'Storno ist eine Ausnahme',
      })

      expect(session.snapshot().stepTracker[0].status).toBe('done')
    })

    it('does not set status to done when multiple tazite slots are still missing', async () => {
      const { tools, session } = await setup([makeStep({ title: 'Rechnungseingang' })])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tools.record_slot as any).execute({
        step_title: 'Rechnungseingang',
        slot: 'frequency_per_month',
        value: 20,
        evidence_quote: 'etwa 20 mal im Monat',
      })

      expect(session.snapshot().stepTracker[0].status).not.toBe('done')
    })

    it('rejects non-string value for entscheidungslogik (must be string)', async () => {
      const { tools } = await setup([])
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
      const { tools } = await setup([])
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
      const { tools } = await setup([])
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
      const { tools } = await setup([])
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

  // ── update_walkthrough_data ─────────────────────────────────────────────────

  describe('update_walkthrough_data', () => {
    it('replaces process_steps on a second call (no additive duplication)', async () => {
      const tracker = [
        makeStep({ title: 'Rechnungseingang', process_steps: ['Rechnung öffnen', 'Datum prüfen'] }),
      ]
      const { tools, session } = await setup(tracker)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.update_walkthrough_data as any).execute({
        step_title: 'Rechnungseingang',
        process_steps: ['Betrag kontrollieren'],
      })

      expect(result.success).toBe(true)
      expect(session.snapshot().stepTracker[0].process_steps).toEqual(['Betrag kontrollieren'])
    })

    it('returns success false when step is not found', async () => {
      const { tools } = await setup([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.update_walkthrough_data as any).execute({
        step_title: 'Nicht vorhanden',
        process_steps: ['Irgendwas'],
      })

      expect(result.success).toBe(false)
    })

    it("transitions status from 'exploring' to 'walkthrough' on first call", async () => {
      const { tools, session } = await setup([makeStep({ title: 'Rechnungseingang', status: 'exploring' })])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tools.update_walkthrough_data as any).execute({
        step_title: 'Rechnungseingang',
        friction_points: ['Langer Genehmigungsprozess'],
      })

      expect(session.snapshot().stepTracker[0].status).toBe('walkthrough')
    })
  })

  // ── link_bottleneck ─────────────────────────────────────────────────────────

  describe('link_bottleneck', () => {
    it('creates knowledge_object with step_ref in content and updates extractions_log', async () => {
      const { tools, session, backend } = await setup([], [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tools.link_bottleneck as any).execute({
        step_title: 'Rechnungseingang',
        description: 'Manuelles Kopieren aus SAP dauert 30 Minuten',
        severity: 'high',
      })

      expect(result.success).toBe(true)
      expect(result.step_title).toBe('Rechnungseingang')

      // commit persists the two targets (knowledge_objects insert + extractions_log append)
      await session.commit()
      expect(backend.state.knowledgeObjects).toHaveLength(1)
      expect(backend.state.knowledgeObjects[0]).toMatchObject({
        type: 'pain_point',
        content: expect.objectContaining({ step_ref: 'Rechnungseingang', severity: 'high' }),
      })
      expect(backend.state.extractionsLog).toHaveLength(1)
      expect(backend.state.extractionsLog[0]).toMatchObject({
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

    it('records depends_on edge between two known steps', async () => {
      const { tools, session } = await setup(makeTrackerWithIds())
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
      expect(session.snapshot().stepTracker[0].abhaengigkeiten?.depends_on).toHaveLength(1)
    })

    it('records influences edge between two known steps', async () => {
      const { tools } = await setup(makeTrackerWithIds())
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
      const { tools } = await setup(makeTrackerWithIds())
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
      const { tools } = await setup(makeTrackerWithIds())
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
      const { tools } = await setup(makeTrackerWithIds())
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
      const { tools } = await setup(makeTrackerWithIds())
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
      const { tools } = await setup(makeTrackerWithIds())
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
      const { tools } = await setup(withExistingEdge)
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
})
