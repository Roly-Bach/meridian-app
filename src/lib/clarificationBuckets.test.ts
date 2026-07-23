import { describe, it, expect } from 'vitest'
import { bucketsFor, resolveBucketValue, parseFreeNumericAnswer } from './clarificationBuckets'

describe('bucketsFor / resolveBucketValue (PROJ-43 AC2)', () => {
  it('falls back to the default variant when no direction was captured', () => {
    const buckets = bucketsFor('frequency', null)
    expect(buckets.map((b) => b.label)).toEqual(['Täglich', 'Wöchentlich', 'Mehrfach/Monat', 'Monatlich'])
  })

  it('returns direction-tailored buckets for "niedrig"', () => {
    const buckets = bucketsFor('frequency', 'niedrig')
    expect(buckets.map((b) => b.label)).toEqual(['Monatlich', 'Alle paar Monate', 'Ein paar Mal im Jahr', 'Seltener'])
  })

  it('returns direction-tailored buckets for "hoch"', () => {
    const buckets = bucketsFor('duration', 'hoch')
    expect(buckets.map((b) => b.label)).toEqual(['30–60 Min', '1–2 Std', '2–4 Std', '> 4 Std'])
  })

  it('resolveBucketValue maps a label back to its canonical value, matching the rendered variant', () => {
    expect(resolveBucketValue('error_rate_percent', 'hoch', 'Sehr häufig')).toBe(50)
    expect(resolveBucketValue('error_rate_percent', null, 'Sehr häufig')).toBeUndefined()
  })

  it('resolveBucketValue returns undefined for an unknown label', () => {
    expect(resolveBucketValue('frequency', null, 'Ständig')).toBeUndefined()
  })
})

describe('parseFreeNumericAnswer (AC3a)', () => {
  it('parses a bare integer', () => {
    expect(parseFreeNumericAnswer('12')).toBe(12)
  })

  it('parses a German-decimal-comma number', () => {
    expect(parseFreeNumericAnswer('12,5')).toBe(12.5)
  })

  it('parses a hyphen range as its mean', () => {
    expect(parseFreeNumericAnswer('10-15')).toBe(12.5)
  })

  it('parses a "bis"-worded range as its mean', () => {
    expect(parseFreeNumericAnswer('10 bis 20')).toBe(15)
  })

  it('parses an en-dash range', () => {
    expect(parseFreeNumericAnswer('10–15')).toBe(12.5)
  })

  it('returns null for unparseable input — never guesses', () => {
    expect(parseFreeNumericAnswer('keine Ahnung')).toBeNull()
    expect(parseFreeNumericAnswer('')).toBeNull()
    expect(parseFreeNumericAnswer('   ')).toBeNull()
  })
})
