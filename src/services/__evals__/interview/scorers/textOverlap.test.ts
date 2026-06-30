import { describe, it, expect } from 'vitest'
import { tokenizeContent, tokenContainment } from './textOverlap'

describe('tokenizeContent', () => {
  it('drops stopwords and <3-char tokens, keeps content words', () => {
    const t = tokenizeContent('Ich bearbeite im Monat 80 bis 100 Rechnungen')
    expect(t.has('bearbeite')).toBe(true)
    expect(t.has('monat')).toBe(true)
    expect(t.has('100')).toBe(true)
    expect(t.has('rechnungen')).toBe(true)
    expect(t.has('ich')).toBe(false) // stopword
    expect(t.has('im')).toBe(false) // stopword
    expect(t.has('80')).toBe(false) // <3 chars
  })
})

describe('tokenContainment', () => {
  it('verbatim quote → 1.0', () => {
    expect(tokenContainment('Rechnungen prüfen in SAP', 'Ich muss Rechnungen prüfen in SAP FI')).toBe(1)
  })

  it('paraphrase with shared content words → high containment (where prefix match would fail)', () => {
    // Old 10-char prefix would compare "rechnungsp..." — a paraphrase that reorders words fails it.
    const quote = 'Rechnungen werden geprüft und gebucht'
    const transcript = 'Am Ende werden die eingehenden Rechnungen geprüft, kontiert und dann gebucht.'
    expect(tokenContainment(quote, transcript)).toBeGreaterThanOrEqual(0.5)
  })

  it('fabrication with no shared content words → 0', () => {
    expect(tokenContainment('240 Minuten gedauert', 'Das dauert einen nennenswerten Teil meiner Arbeitszeit')).toBe(0)
  })

  it('empty quote → 1 (nothing to verify)', () => {
    expect(tokenContainment('', 'whatever')).toBe(1)
  })
})
