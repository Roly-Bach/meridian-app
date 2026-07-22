import { describe, it, expect } from 'vitest'
import { scoreSlotCoverage, scoreDedupCoverage } from './slotCoverage'
import type { StepEntry, SchemaSlotString, SchemaSlotStringArray, AbhaengigkeitsKante, EinflussKante, Abhaengigkeiten } from '@/services/interviewSemantic'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const tazite = (value: string): SchemaSlotString => ({
  value,
  quote: value,
  confidence: 'confirmed',
  nicht_befund_typ: null,
})

const taziteArray = (values: string[]): SchemaSlotStringArray => ({
  value: values,
  quote: values[0] ?? null,
  confidence: 'confirmed',
  nicht_befund_typ: null,
})

const taziteNichtZutreffend = (): SchemaSlotString => ({
  value: null,
  quote: null,
  nicht_befund_typ: 'nicht_zutreffend',
})

const makeStep = (
  overrides: Partial<StepEntry> = {},
  slotOverrides: Partial<StepEntry['slots']> = {},
): StepEntry => ({
  title: 'Rechnungsprüfung',
  reihenfolge: 1,
  abhaengigkeiten: null,
  potenzial: {
    frequency: null,
    duration: null,
    error_rate_percent: null,
    media_breaks: null,
  },
  status: 'done',
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
    ...slotOverrides,
  },
  ...overrides,
})

const abhaengigkeitsKante = (schritt_id: string): AbhaengigkeitsKante => ({
  schritt_id,
  typ: 'voraussetzung',
  beschreibung: null,
})

const einflussKante = (schritt_id: string): EinflussKante => ({
  schritt_id,
  typ: 'beeinflusst',
  beschreibung: null,
})

const abhaengigkeiten = (overrides: Partial<Abhaengigkeiten> = {}): Abhaengigkeiten => ({
  depends_on: [],
  influences: [],
  nicht_befund_typ: null,
  ...overrides,
})

const fullyFilledStep = (reihenfolge = 1): StepEntry =>
  makeStep(
    {
      title: 'Vollständiger Schritt',
      reihenfolge,
      abhaengigkeiten: abhaengigkeiten({ depends_on: [abhaengigkeitsKante('S002')] }),
    },
    {
      entscheidungslogik: tazite('Freigabe ab 5000 EUR'),
      tazite_cues: taziteArray(['Erfahrung nötig']),
      ausnahmen: taziteArray(['Eilbuchung']),
      inputs: taziteArray(['Eingangsrechnung']),
      outputs: taziteArray(['Buchungssatz']),
      hilfsmittel: taziteArray(['SAP FI']),
    },
  )

// ─── scoreSlotCoverage ────────────────────────────────────────────────────────

describe('scoreSlotCoverage', () => {
  it('returns 0 for empty tracker', () => {
    expect(scoreSlotCoverage([])).toBe(0)
  })

  it('bare step: title + reihenfolge = 2/9', () => {
    expect(scoreSlotCoverage([makeStep()])).toBeCloseTo(2 / 9)
  })

  it('returns 1.0 when all 9 O1–O6 fields filled', () => {
    expect(scoreSlotCoverage([fullyFilledStep()])).toBe(1.0)
  })

  it('nicht_befund_typ counts as filled even with null value', () => {
    const step = makeStep({}, { entscheidungslogik: taziteNichtZutreffend() })
    // bezeichnung + reihenfolge + entscheidungslogik = 3/9
    expect(scoreSlotCoverage([step])).toBeCloseTo(3 / 9)
  })

  it('potenzial fields do NOT count toward O1–O6 coverage', () => {
    const step = makeStep({
      potenzial: {
        frequency: { value: 90, quote: '90', confidence: 'confirmed', nicht_befund_typ: null },
        duration: { value: 30, quote: '30', confidence: 'confirmed', nicht_befund_typ: null },
        error_rate_percent: null,
        media_breaks: null,
      },
    })
    // Only title + reihenfolge = 2/9 (potenzial not counted)
    expect(scoreSlotCoverage([step])).toBeCloseTo(2 / 9)
  })

  it('AbhaengigkeitsKante in depends_on = filled', () => {
    const step = makeStep({ abhaengigkeiten: abhaengigkeiten({ depends_on: [abhaengigkeitsKante('S002')] }) })
    // bezeichnung + reihenfolge + abhaengigkeiten = 3/9
    expect(scoreSlotCoverage([step])).toBeCloseTo(3 / 9)
  })

  it('EinflussKante in influences = filled', () => {
    const step = makeStep({ abhaengigkeiten: abhaengigkeiten({ influences: [einflussKante('S003')] }) })
    expect(scoreSlotCoverage([step])).toBeCloseTo(3 / 9)
  })

  it('abhaengigkeiten empty arrays + keine nicht_befund_typ = not filled', () => {
    const step = makeStep({ abhaengigkeiten: abhaengigkeiten() })
    expect(scoreSlotCoverage([step])).toBeCloseTo(2 / 9)
  })

  it('abhaengigkeiten with nicht_befund_typ = filled', () => {
    const step = makeStep({ abhaengigkeiten: abhaengigkeiten({ nicht_befund_typ: 'nicht_zutreffend' }) })
    expect(scoreSlotCoverage([step])).toBeCloseTo(3 / 9)
  })

  it('backward-compat: PROJ-25 unknown[] elements tolerated (no crash)', () => {
    // Old sessions may have string[] in depends_on — runtime still counts length >= 1
    const oldFormat = { depends_on: ['Vorstufe'] as unknown as AbhaengigkeitsKante[], influences: [], nicht_befund_typ: null } satisfies Abhaengigkeiten
    const step = makeStep({ abhaengigkeiten: oldFormat })
    expect(() => scoreSlotCoverage([step])).not.toThrow()
    expect(scoreSlotCoverage([step])).toBeCloseTo(3 / 9)
  })

  it('calculates correctly across two steps', () => {
    const step1 = fullyFilledStep(1)  // 9/9
    const step2 = makeStep({ reihenfolge: 2, title: 'Freigabe' })  // 2/9
    // (9 + 2) / (2 × 9) = 11/18
    expect(scoreSlotCoverage([step1, step2])).toBeCloseTo(11 / 18)
  })
})

// ─── scoreDedupCoverage ───────────────────────────────────────────────────────

describe('scoreDedupCoverage', () => {
  it('returns 0 for empty tracker', () => {
    expect(scoreDedupCoverage([])).toBe(0)
  })

  it('deduped single step = same as scoreSlotCoverage', () => {
    const step = fullyFilledStep()
    expect(scoreDedupCoverage([step])).toBe(1.0)
  })

  it('two semantically identical steps merge: union of fields', () => {
    const step1 = makeStep({ title: 'Rechnungsprüfung: Erstprüfung', reihenfolge: 1 }, {
      entscheidungslogik: tazite('Freigabe'),
    })
    const step2 = makeStep({ title: 'Rechnungsprüfung: Zweitprüfung', reihenfolge: 2 }, {
      tazite_cues: taziteArray(['Erfahrung nötig']),
    })
    // Both share colon-parent "Rechnungsprüfung" → merged into one group
    // group has: bezeichnung + reihenfolge + entscheidungslogik + tazite_cues = 4 fields
    // 4/9 as one group
    const score = scoreDedupCoverage([step1, step2])
    // scoreDedupCoverage merges → 4/9 ≈ 0.444
    expect(score).toBeGreaterThan(2 / 9)   // better than bare step
    expect(score).toBeLessThan(1.0)
  })
})

// scoreGovernanceCoverage was removed by PROJ-45 (ADR-025: governance field deleted
// from StepEntry entirely, no replacement) — this describe block tested it and was
// deleted along with it.
