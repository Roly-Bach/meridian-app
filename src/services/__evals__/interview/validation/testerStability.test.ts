import { describe, it, expect } from 'vitest'
import { compareRankings, aggregateQuality } from './testerStability'
import type { ScoreSet } from '../scorers'

describe('compareRankings', () => {
  it('identical scores → pairAgreement 1, top rank stable', () => {
    const r = compareRankings({ A: 3, B: 2, C: 1 }, { A: 3, B: 2, C: 1 })
    expect(r.rankingWeak).toEqual(['A', 'B', 'C'])
    expect(r.rankingStrong).toEqual(['A', 'B', 'C'])
    expect(r.pairAgreement).toBe(1)
    expect(r.topRankStable).toBe(true)
  })

  it('fully reversed ranking → pairAgreement 0, top rank unstable', () => {
    const r = compareRankings({ A: 3, B: 2, C: 1 }, { A: 1, B: 2, C: 3 })
    expect(r.rankingWeak).toEqual(['A', 'B', 'C'])
    expect(r.rankingStrong).toEqual(['C', 'B', 'A'])
    expect(r.pairAgreement).toBe(0)
    expect(r.topRankStable).toBe(false)
  })

  it('one swapped pair out of three → pairAgreement 0.6667, top rank stable', () => {
    // weak [A,B,C]; strong [A,C,B]. pairs (A,B)✓ (A,C)✓ (B,C)✗ → 2/3.
    const r = compareRankings({ A: 3, B: 2, C: 1 }, { A: 3, B: 1, C: 2 })
    expect(r.rankingWeak).toEqual(['A', 'B', 'C'])
    expect(r.rankingStrong).toEqual(['A', 'C', 'B'])
    expect(r.pairAgreement).toBe(0.6667)
    expect(r.topRankStable).toBe(true)
  })

  it('ties broken deterministically by model name', () => {
    const r = compareRankings({ A: 2, B: 2 }, { A: 2, B: 2 })
    expect(r.rankingWeak).toEqual(['A', 'B'])
    // tie in both → concordant
    expect(r.pairAgreement).toBe(1)
  })

  it('throws when the two maps cover different models', () => {
    expect(() => compareRankings({ A: 1, B: 2 }, { A: 1, C: 2 })).toThrow(/same models/)
  })
})

describe('aggregateQuality', () => {
  const mk = (dedup: number): ScoreSet => ({ dedupSlotCoverage: dedup } as ScoreSet)

  it('median of dedupSlotCoverage across runs (odd count)', () => {
    expect(aggregateQuality([mk(0.8), mk(0.9), mk(0.7)])).toBe(0.8)
  })

  it('median across even count averages the two middle values', () => {
    expect(aggregateQuality([mk(0.8), mk(0.9), mk(0.7), mk(1.0)])).toBe(0.85)
  })

  it('empty → 0', () => {
    expect(aggregateQuality([])).toBe(0)
  })
})
