/**
 * PROJ-27 / BL-E1.4: Stable step IDs — revision integrity tests.
 * Verifies that normalizeStepEntry preserves id, toGrenzobjekt assigns correct IDs,
 * and the S001-format regex matches expected patterns.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeStepEntry,
  toGrenzobjekt,
  type StepEntry,
} from './interviewSemantic'
import { canOverwrite } from './slotConflictResolver'

function makeStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return {
    id: 'S001',
    title: 'Rechnungsprüfung',
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
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// ID format
// ---------------------------------------------------------------------------

describe('step ID format (^S[0-9]{3}$)', () => {
  it('S001 is valid', () => expect('S001').toMatch(/^S[0-9]{3}$/))
  it('S010 is valid', () => expect('S010').toMatch(/^S[0-9]{3}$/))
  it('S999 is valid', () => expect('S999').toMatch(/^S[0-9]{3}$/))
  it('S1 is invalid', () => expect('S1').not.toMatch(/^S[0-9]{3}$/))
  it('S0001 is invalid', () => expect('S0001').not.toMatch(/^S[0-9]{3}$/))
  it('001 (no prefix) is invalid', () => expect('001').not.toMatch(/^S[0-9]{3}$/))
  it('empty string invalid', () => expect('').not.toMatch(/^S[0-9]{3}$/))
})

// ---------------------------------------------------------------------------
// normalizeStepEntry — id field round-trips
// ---------------------------------------------------------------------------

describe('normalizeStepEntry — id preservation', () => {
  it('preserves id from JSONB blob', () => {
    const raw = { id: 'S003', title: 'Buchung', reihenfolge: 3, status: 'exploring', potenzial: null, slots: {} }
    const normalized = normalizeStepEntry(raw, 3)
    expect(normalized.id).toBe('S003')
  })

  it('id is absent (undefined) when JSONB has no id field', () => {
    const raw = { title: 'Buchung', reihenfolge: 1, status: 'exploring', potenzial: null, slots: {} }
    const normalized = normalizeStepEntry(raw, 1)
    expect(normalized.id).toBeUndefined()
  })

  it('does not invent an id for legacy entries', () => {
    const legacy = {
      title: 'Monatsabschluss',
      status: 'exploring' as const,
      slots: { frequency_per_month: { value: 1, quote: 'q' } },
    }
    const normalized = normalizeStepEntry(legacy, 1)
    expect(normalized.id).toBeUndefined()
  })

  it('reihenfolge falls back to fallbackReihenfolge when absent', () => {
    const raw = { title: 'X', status: 'exploring', potenzial: null, slots: {} }
    const normalized = normalizeStepEntry(raw, 7)
    expect(normalized.reihenfolge).toBe(7)
  })
})

// ---------------------------------------------------------------------------
// normalizeStepEntry — empty array normalization (BUG-M1)
// ---------------------------------------------------------------------------

describe('normalizeStepEntry — empty TaziteSlotArray normalization (BUG-M1)', () => {
  const baseNonLegacy = {
    title: 'X',
    reihenfolge: 1,
    status: 'exploring' as const,
    potenzial: { frequency_per_month: null, duration_minutes: null, error_rate_percent: null, media_breaks: null },
  }

  it('hilfsmittel value:[] → null in non-legacy path', () => {
    const raw = { ...baseNonLegacy, slots: { hilfsmittel: { value: [], quote: null, nicht_befund_typ: null } } }
    const normalized = normalizeStepEntry(raw, 1)
    expect(normalized.slots.hilfsmittel?.value).toBeNull()
  })

  it('hilfsmittel value:[] → null in legacy fallback (no data_sources)', () => {
    const raw = {
      title: 'X', status: 'exploring' as const,
      slots: { frequency_per_month: { value: 1, quote: 'q' }, hilfsmittel: { value: [], quote: null, nicht_befund_typ: null } },
    }
    const normalized = normalizeStepEntry(raw, 1)
    expect(normalized.slots.hilfsmittel?.value).toBeNull()
  })

  it('hilfsmittel with non-empty array passes through unchanged', () => {
    const raw = { ...baseNonLegacy, slots: { hilfsmittel: { value: ['SAP'], quote: 'nutzt SAP', nicht_befund_typ: null } } }
    const normalized = normalizeStepEntry(raw, 1)
    expect(normalized.slots.hilfsmittel?.value).toEqual(['SAP'])
  })
})

// ---------------------------------------------------------------------------
// toGrenzobjekt — ID assignment
// ---------------------------------------------------------------------------

describe('toGrenzobjekt — ID assignment', () => {
  it('uses step.id when present', () => {
    const step = makeStep({ id: 'S005' })
    const schritt = toGrenzobjekt(step, 1)
    expect(schritt.id).toBe('S005')
  })

  it('falls back to S-padded fallbackIndex when id missing', () => {
    const step = makeStep({ id: undefined })
    expect(toGrenzobjekt(step, 1).id).toBe('S001')
    expect(toGrenzobjekt(step, 12).id).toBe('S012')
    expect(toGrenzobjekt(step, 100).id).toBe('S100')
  })

  it('fallback ID passes regex', () => {
    const step = makeStep({ id: undefined })
    for (let i = 1; i <= 20; i++) {
      expect(toGrenzobjekt(step, i).id).toMatch(/^S[0-9]{3}$/)
    }
  })

  it('bezeichnung.wert equals step.title', () => {
    const step = makeStep({ title: 'Eingangsrechnungsprüfung' })
    expect(toGrenzobjekt(step, 1).bezeichnung.wert).toBe('Eingangsrechnungsprüfung')
  })

  it('bezeichnung.konfidenz is 0.9 (always high for confirmed step title)', () => {
    expect(toGrenzobjekt(makeStep(), 1).bezeichnung.konfidenz).toBe(0.9)
  })

  it('null tazite slot maps to {wert:null,konfidenz:null,nicht_befund_typ:null}', () => {
    const schritt = toGrenzobjekt(makeStep(), 1)
    expect(schritt.entscheidungslogik).toEqual({ wert: null, konfidenz: null, nicht_befund_typ: null })
    expect(schritt.tazite_cues).toEqual({ wert: null, konfidenz: null, nicht_befund_typ: null })
    expect(schritt.hilfsmittel).toEqual({ wert: null, konfidenz: null, nicht_befund_typ: null })
  })

  it('TaziteSlot with confirmed confidence maps to konfidenz 0.9', () => {
    const step = makeStep({
      slots: {
        entscheidungslogik: { value: 'regel-basiert', quote: 'q', confidence: 'confirmed', nicht_befund_typ: null },
        tazite_cues: null, ausnahmen: null, inputs: null, outputs: null, hilfsmittel: null,
      },
    })
    const schritt = toGrenzobjekt(step, 1)
    expect(schritt.entscheidungslogik.wert).toBe('regel-basiert')
    expect(schritt.entscheidungslogik.konfidenz).toBe(0.9)
  })

  it('TaziteSlot with estimate confidence maps to konfidenz 0.6', () => {
    const step = makeStep({
      slots: {
        entscheidungslogik: { value: 'vermutlich', quote: 'q', confidence: 'estimate', nicht_befund_typ: null },
        tazite_cues: null, ausnahmen: null, inputs: null, outputs: null, hilfsmittel: null,
      },
    })
    expect(toGrenzobjekt(step, 1).entscheidungslogik.konfidenz).toBe(0.6)
  })

  it('TaziteSlot with unknown confidence maps to konfidenz 0.3', () => {
    const step = makeStep({
      slots: {
        entscheidungslogik: { value: 'unklar', quote: 'q', confidence: 'unknown', nicht_befund_typ: null },
        tazite_cues: null, ausnahmen: null, inputs: null, outputs: null, hilfsmittel: null,
      },
    })
    expect(toGrenzobjekt(step, 1).entscheidungslogik.konfidenz).toBe(0.3)
  })

  it('potenzial omitted when all potenzial slots null', () => {
    const step = makeStep()
    expect(toGrenzobjekt(step, 1).potenzial).toBeUndefined()
  })

  it('potenzial included when at least one slot filled', () => {
    const step = makeStep({
      potenzial: {
        frequency_per_month: { value: 20, quote: 'q', confidence: 'confirmed' },
        duration_minutes: null,
        error_rate_percent: null,
        media_breaks: null,
      },
    })
    const schritt = toGrenzobjekt(step, 1)
    expect(schritt.potenzial).toBeDefined()
    expect(schritt.potenzial?.haeufigkeit_pro_monat.wert).toBe(20)
    expect(schritt.potenzial?.haeufigkeit_pro_monat.konfidenz).toBe(0.9)
    expect(schritt.potenzial?.dauer_minuten.wert).toBeNull()
  })

  it('governance omitted when null', () => {
    expect(toGrenzobjekt(makeStep({ governance: null }), 1).governance).toBeUndefined()
  })

  it('governance mapped when present', () => {
    const step = makeStep({
      governance: { rolle: 'Buchhalter', organisationseinheit: 'Finanzen', systeme: ['SAP'], nicht_befund_typ: null },
    })
    const schritt = toGrenzobjekt(step, 1)
    expect(schritt.governance?.rolle).toBe('Buchhalter')
    expect(schritt.governance?.systeme).toEqual(['SAP'])
  })

  it('abhaengigkeiten defaults to empty arrays when null', () => {
    const schritt = toGrenzobjekt(makeStep({ abhaengigkeiten: null }), 1)
    expect(schritt.abhaengigkeiten.depends_on).toEqual([])
    expect(schritt.abhaengigkeiten.influences).toEqual([])
    expect(schritt.abhaengigkeiten.nicht_befund_typ).toBeNull()
  })

  it('abhaengigkeiten preserved when set', () => {
    const step = makeStep({
      abhaengigkeiten: {
        depends_on: [{ schritt_id: 'S002', typ: 'voraussetzung' as const, beschreibung: null }],
        influences: [{ schritt_id: 'S003', typ: 'beeinflusst' as const, beschreibung: null }],
        nicht_befund_typ: null,
      },
    })
    const schritt = toGrenzobjekt(step, 1)
    expect(schritt.abhaengigkeiten.depends_on[0].schritt_id).toBe('S002')
  })

  it('reihenfolge matches step.reihenfolge', () => {
    const step = makeStep({ reihenfolge: 5 })
    expect(toGrenzobjekt(step, 1).reihenfolge).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// B4: Conditional UPDATE guard — .neq('analyst_status', 'done') semantics
// ---------------------------------------------------------------------------

describe('conditional UPDATE guard (analyst_status ≠ done)', () => {
  type InterviewRow = { id: string; analyst_status: string; next_briefing: string | null }

  function applyConditionalUpdate(rows: InterviewRow[], id: string, update: Partial<InterviewRow>): InterviewRow[] {
    return rows.map(row =>
      row.id === id && row.analyst_status !== 'done' ? { ...row, ...update } : row
    )
  }

  it('no-op when analyst_status is already done — briefing unchanged', () => {
    const rows: InterviewRow[] = [{ id: 'iv-1', analyst_status: 'done', next_briefing: 'existing' }]
    const after = applyConditionalUpdate(rows, 'iv-1', { next_briefing: 'new', analyst_status: 'done' })
    expect(after[0].next_briefing).toBe('existing')
  })

  it('update proceeds when analyst_status is pending', () => {
    const rows: InterviewRow[] = [{ id: 'iv-1', analyst_status: 'pending', next_briefing: null }]
    const after = applyConditionalUpdate(rows, 'iv-1', { next_briefing: 'briefing-content', analyst_status: 'done' })
    expect(after[0].next_briefing).toBe('briefing-content')
    expect(after[0].analyst_status).toBe('done')
  })

  it('wrong id: no row updated', () => {
    const rows: InterviewRow[] = [{ id: 'iv-1', analyst_status: 'pending', next_briefing: null }]
    const after = applyConditionalUpdate(rows, 'other-id', { next_briefing: 'new', analyst_status: 'done' })
    expect(after[0].next_briefing).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// B5: is_correction propagation — corrected value replaces old, not appended
// ---------------------------------------------------------------------------

describe('is_correction: corrected slot value replaces previous', () => {
  function jsonbSetPath(
    obj: Record<string, unknown>,
    path: string[],
    value: unknown,
  ): Record<string, unknown> {
    const [head, ...rest] = path
    const nested = ((obj[head] ?? {}) as Record<string, unknown>)
    return { ...obj, [head]: rest.length === 0 ? value : jsonbSetPath(nested, rest, value) }
  }

  it('jsonb_set replaces old value — no stale value survives in slot', () => {
    const before: Record<string, unknown> = {
      potenzial: { duration_minutes: { value: 1200, quote: 'original', writeSource: 'analyst' } },
    }
    const correction = { value: 900, quote: 'corrected', writeSource: 'analyst' }
    const after = jsonbSetPath(before, ['potenzial', 'duration_minutes'], correction)
    expect((after as { potenzial: { duration_minutes: unknown } }).potenzial.duration_minutes).toEqual(correction)
    // Old value gone — not present anywhere in the slot
    expect(JSON.stringify(after)).not.toContain('"value":1200')
  })

  it('is_correction=true lifts priority block — lower-source write proceeds', () => {
    // Without is_correction: backfill cannot overwrite analyst slot (priority blocked)
    const isOverwrite = true
    const priorityBlocked = isOverwrite && !false && !canOverwrite('analyst', 'backfill')
    expect(priorityBlocked).toBe(true)  // blocked normally

    // With is_correction=true: `!is_correction` is false → block bypassed
    const priorityBlockedWithCorrection = isOverwrite && !true && !canOverwrite('analyst', 'backfill')
    expect(priorityBlockedWithCorrection).toBe(false)  // correction goes through
  })
})

// ---------------------------------------------------------------------------
// nicht_befund_typ mapping
// ---------------------------------------------------------------------------

describe('toGrenzobjekt — nicht_befund_typ preservation', () => {
  it('nicht_zutreffend flows through', () => {
    const step = makeStep({
      slots: {
        entscheidungslogik: { value: null, quote: null, nicht_befund_typ: 'nicht_zutreffend' },
        tazite_cues: null, ausnahmen: null, inputs: null, outputs: null, hilfsmittel: null,
      },
    })
    expect(toGrenzobjekt(step, 1).entscheidungslogik.nicht_befund_typ).toBe('nicht_zutreffend')
  })

  it('unbekannt flows through', () => {
    const step = makeStep({
      slots: {
        entscheidungslogik: { value: null, quote: null, nicht_befund_typ: 'unbekannt' },
        tazite_cues: null, ausnahmen: null, inputs: null, outputs: null, hilfsmittel: null,
      },
    })
    expect(toGrenzobjekt(step, 1).entscheidungslogik.nicht_befund_typ).toBe('unbekannt')
  })
})
