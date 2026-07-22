import { describe, it, expect } from 'vitest'
import { scoreDependencyCapture } from './dependencyCapture'
import type { StepEntry, Abhaengigkeiten } from '@/services/interviewSemantic'

const makeStep = (abhaengigkeiten: Abhaengigkeiten | null, title = 'Rechnungsprüfung', reihenfolge = 1): StepEntry => ({
  title,
  reihenfolge,
  abhaengigkeiten,
  potenzial: { frequency: null, duration: null, error_rate_percent: null, media_breaks: null },
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
  },
})

const deps = (o: Partial<Abhaengigkeiten> = {}): Abhaengigkeiten => ({ depends_on: [], influences: [], nicht_befund_typ: null, ...o })

describe('scoreDependencyCapture', () => {
  it('empty tracker → 0', () => {
    expect(scoreDependencyCapture([])).toBe(0)
  })

  it('null abhaengigkeiten → not captured', () => {
    expect(scoreDependencyCapture([makeStep(null)])).toBe(0)
  })

  it('depends_on edge → captured', () => {
    const step = makeStep(deps({ depends_on: [{ schritt_id: 'S001', typ: 'voraussetzung', beschreibung: null }] }))
    expect(scoreDependencyCapture([step])).toBe(1)
  })

  it('influences edge → captured', () => {
    const step = makeStep(deps({ influences: [{ schritt_id: 'S002', typ: 'beeinflusst', beschreibung: null }] }))
    expect(scoreDependencyCapture([step])).toBe(1)
  })

  it('explicit nicht_befund_typ → captured (deliberate no-finding counts)', () => {
    expect(scoreDependencyCapture([makeStep(deps({ nicht_befund_typ: 'nicht_zutreffend' }))])).toBe(1)
  })

  it('empty depends_on + influences + null nicht_befund → not captured', () => {
    expect(scoreDependencyCapture([makeStep(deps())])).toBe(0)
  })

  it('half of two distinct steps captured → 0.5', () => {
    const a = makeStep(deps({ depends_on: [{ schritt_id: 'S001', typ: 'voraussetzung', beschreibung: null }] }), 'Rechnungsprüfung', 1)
    const b = makeStep(null, 'Monatsabschluss', 2)
    expect(scoreDependencyCapture([a, b])).toBe(0.5)
  })
})
