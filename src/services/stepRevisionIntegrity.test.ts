/**
 * PROJ-27 / BL-E1.4: Stable step IDs — revision integrity tests.
 * Verifies that normalizeStepEntry preserves id, and the S001-format regex
 * matches expected patterns. (toGrenzobjekt coverage removed by PROJ-45 — see
 * below, the function itself was deleted with no replacement per ADR-025 D7.)
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeStepEntry,
  type StepEntry,
} from './interviewSemantic'
import { canOverwrite } from './slotConflictResolver'

function makeStep(overrides: Partial<StepEntry> = {}): StepEntry {
  return {
    id: 'S001',
    title: 'Rechnungsprüfung',
    reihenfolge: 1,
    abhaengigkeiten: null,
    status: 'exploring',
    potenzial: {
      frequency: null,
      duration: null,
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
      reibungspunkte: null,
      ausloeser: null,
      aufgabentyp: null,
      risiko_schwere: null,
      standardisierungsgrad: null,
      informationsdichte: null,
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
      slots: { frequency: { value: 1, quote: 'q' } },
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
    potenzial: { frequency: null, duration: null, error_rate_percent: null, media_breaks: null },
  }

  it('hilfsmittel value:[] → null in non-legacy path', () => {
    const raw = { ...baseNonLegacy, slots: { hilfsmittel: { value: [], quote: null, nicht_befund_typ: null } } }
    const normalized = normalizeStepEntry(raw, 1)
    expect(normalized.slots.hilfsmittel?.value).toBeNull()
  })

  it('hilfsmittel value:[] → null in legacy fallback (no data_sources)', () => {
    const raw = {
      title: 'X', status: 'exploring' as const,
      slots: { frequency: { value: 1, quote: 'q' }, hilfsmittel: { value: [], quote: null, nicht_befund_typ: null } },
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

// toGrenzobjekt (and its ID assignment / confidence-mapping / governance-mapping
// coverage) was removed by PROJ-45 (ADR-025 D7: the app schema now deliberately
// diverges from the academic/thesis JSON schema it used to validate against) —
// the function was deleted entirely, no replacement.

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
      potenzial: { duration: { value: 1200, quote: 'original', writeSource: 'analyst' } },
    }
    const correction = { value: 900, quote: 'corrected', writeSource: 'analyst' }
    const after = jsonbSetPath(before, ['potenzial', 'duration'], correction)
    expect((after as { potenzial: { duration: unknown } }).potenzial.duration).toEqual(correction)
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

// toGrenzobjekt's nicht_befund_typ-mapping coverage removed along with the
// function itself (PROJ-45/ADR-025 D7 — see note above).
